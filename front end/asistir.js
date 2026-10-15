const $ = id => document.getElementById(id);
const p = new URLSearchParams(location.search);
const codigo = p.get('c'), token = p.get('t');
const show = (t, ok) => { $('res').className = 'msg ' + (ok ? 'ok' : 'err'); $('res').textContent = t; };

try { $('nombre').value = localStorage.getItem('nombre') || ''; $('dni').value = localStorage.getItem('dni') || ''; } catch {}

if (!codigo || !token) { $('form').classList.add('hidden'); show('Escaneá el QR que se muestra en el aula.', false); }
else fetch(`/api/clases/${encodeURIComponent(codigo)}/info`).then(r => r.json())
  .then(d => { $('clase').textContent = d.error ? d.error : `Clase: ${d.nombre}`; })
  .catch(() => { $('clase').textContent = 'No se pudo contactar al servidor'; });

$('enviar').onclick = async () => {
  $('enviar').disabled = true;
  try {
    const r = await fetch('/api/asistencia/presencial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, token, nombre: $('nombre').value, dni: $('dni').value }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    try { localStorage.setItem('nombre', $('nombre').value); localStorage.setItem('dni', $('dni').value); } catch {}
    $('form').classList.add('hidden');
    show(d.repetido ? `${d.nombre}, ya estabas registrado/a.` : `¡Listo ${d.nombre}! Quedaste presente.`, true);
  } catch (e) { show(e.message, false); $('enviar').disabled = false; }
};
