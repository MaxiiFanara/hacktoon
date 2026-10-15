// Corre en el contexto de la página (MAIN world). Solo observa el estado de las pistas de video
// de getUserMedia; nunca lee ni envía frames de imagen.
(() => {
  if (window.__cctHooked || !navigator.mediaDevices?.getUserMedia) return;
  window.__cctHooked = true;
  const tracks = new Set();
  const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    const stream = await orig(constraints);
    stream.getVideoTracks().forEach(t => tracks.add(t));
    return stream;
  };
  const live = () => [...tracks].some(t => t.readyState === 'live' && t.enabled && !t.muted);
  setInterval(() => window.postMessage({ source: 'cct-inject', trackLive: live() }, '*'), 2000);
})();
