// Envía los heartbeats al servidor de asistencia (el fetch desde el service worker evita
// bloqueos de contenido mixto/CORS de la página de Teams).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'heartbeat') return;
  (async () => {
    const { servidor, codigo, nombre, dni } = await chrome.storage.local.get(['servidor', 'codigo', 'nombre', 'dni']);
    if (!servidor || !codigo || !nombre || !dni) return sendResponse({ ok: false, error: 'Configuración incompleta' });
    try {
      const r = await fetch(`${servidor.replace(/\/$/, '')}/api/virtual/evento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, nombre, dni, camara: msg.camara })
      });
      const d = await r.json();
      await chrome.storage.local.set({ ultimo: { ts: Date.now(), camara: msg.camara, ok: r.ok, error: d.error || null } });
      sendResponse(d);
    } catch (e) {
      await chrome.storage.local.set({ ultimo: { ts: Date.now(), camara: msg.camara, ok: false, error: 'Sin conexión con el servidor' } });
      sendResponse({ ok: false });
    }
  })();
  return true;
});
