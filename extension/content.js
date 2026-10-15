// Detecta el estado de la cámara en Teams Web y lo reporta al background cada 15 s (heartbeat).
const HEARTBEAT_MS = 15000;
let trackLive = false;

window.addEventListener('message', e => {
  if (e.source === window && e.data?.source === 'cct-inject') trackLive = !!e.data.trackLive;
});

// Teams cambia su DOM seguido: se prueban varios selectores y textos (es/en).
const SELECTORS = ['#video-button', '[data-tid="toggle-video"]', 'button[data-tid*="video"]', 'button[id*="video-button"]'];
const ON_RE = /(turn camera off|apagar (la )?c[aá]mara|desactivar (la )?c[aá]mara|desactivar el v[ií]deo|camera on)/i;
const OFF_RE = /(turn camera on|encender (la )?c[aá]mara|activar (la )?c[aá]mara|activar el v[ií]deo|camera off)/i;

// Devuelve true/false si encuentra el botón, o null si no (no estamos en una reunión).
function camaraPorDom() {
  for (const sel of SELECTORS) {
    const b = document.querySelector(sel);
    if (!b) continue;
    const label = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''}`;
    if (ON_RE.test(label)) return true;
    if (OFF_RE.test(label)) return false;
    const pressed = b.getAttribute('aria-pressed') ?? b.getAttribute('aria-checked');
    if (pressed !== null) return pressed === 'true';
  }
  return null;
}

function estadoCamara() {
  const dom = camaraPorDom();
  return dom !== null ? dom : trackLive; // si no hay botón visible, se usa la pista de video
}

function enReunion() {
  return camaraPorDom() !== null || document.querySelector('[data-tid="calling-screen"], #hangup-button, [data-tid="hangup-main-btn"]');
}

setInterval(() => {
  if (!enReunion() && !trackLive) return; // fuera de reunión no se reporta nada
  chrome.runtime.sendMessage({ type: 'heartbeat', camara: estadoCamara() }).catch(() => {});
}, HEARTBEAT_MS);
