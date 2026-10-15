const $ = id => document.getElementById(id);
let clave = sessionStorage.getItem('clave') || '';
let codigo = sessionStorage.getItem('codigo') || '';
let qrTimer, listTimer, barTimer;

const api = (url, opts = {}) => fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'x-docente-key': clave, ...(opts.headers || {}) } })
  .then(async r => { const d = r.headers.get('content-type')?.includes('json') ? await r.json() : r; if (!r.ok) throw new Error(d.error || 'Error'); return d; });
const msg = (el, t, ok) => { el.className = 'msg ' + (ok ? 'ok' : 'err'); el.textContent = t; };
// textContent siempre: los nombres vienen de los alumnos
const td = t => { const e = document.createElement('td'); e.textContent = t; return e; };

async function entrar() {
  try {
    await api('/api/clases');
    sessionStorage.setItem('clave', clave);
    $('panelLogin').classList.add('hidden'); $('panelNueva').classList.remove('hidden');
    const cfg = await fetch('/api/config').then(r => r.json());
    $('step').textContent = cfg.qrStepS; $('avisoIp').classList.toggle('hidden', cfg.ipCheck);
    if (codigo) mostrarClase();
  } catch (e) { msg($('msgLogin'), e.message); }
}
$('btnLogin').onclick = () => { clave = $('clave').value; entrar(); };
$('clave').onkeydown = e => { if (e.key === 'Enter') $('btnLogin').click(); };

$('btnCrear').onclick = async () => {
  try {
    const c = await api('/api/clases', { method: 'POST', body: JSON.stringify({ nombre: $('nombre').value, duracionMin: $('duracion').value, umbral: $('umbral').value }) });
    codigo = c.codigo; sessionStorage.setItem('codigo', codigo); mostrarClase();
  } catch (e) { msg($('msgNueva'), e.message); }
};

function mostrarClase() {
  $('panelNueva').classList.add('hidden'); $('panelQr').classList.remove('hidden'); $('panelLista').classList.remove('hidden');
  $('codigo').textContent = codigo;
  cargarQr(); cargarLista(); clearInterval(listTimer); listTimer = setInterval(cargarLista, 5000);
}

async function cargarQr() {
  clearTimeout(qrTimer);
  try {
    const d = await api(`/api/clases/${codigo}/qr`);
    $('qrImg').src = d.qr;
    const total = d.expiraEnMs, t0 = Date.now();
    clearInterval(barTimer);
    barTimer = setInterval(() => { $('qrBar').style.width = Math.max(0, 100 - ((Date.now() - t0) / total) * 100) + '%'; }, 200);
    qrTimer = setTimeout(cargarQr, d.expiraEnMs + 100);
  } catch (e) { clearInterval(barTimer); }
}

async function cargarLista() {
  try {
    const r = await api(`/api/clases/${codigo}/reporte`);
    $('nPres').textContent = r.presenciales.length; $('nVirt').textContent = r.virtuales.length;
    $('tPres').replaceChildren(...r.presenciales.map(p => { const tr = document.createElement('tr'); tr.append(td(p.nombre), td(p.dni), td(new Date(p.ts).toLocaleTimeString())); return tr; }));
    $('tVirt').replaceChildren(...r.virtuales.map(v => {
      const tr = document.createElement('tr'); const est = td(v.estado); est.className = v.estado === 'Presente' ? 'ok' : 'bad';
      tr.append(td(v.nombre), td(v.dni), td(v.camaraOn ? 'Encendida' : 'Apagada'), td(v.porcentaje + '%'), est); return tr;
    }));
    if (r.cerrada) { clearInterval(listTimer); clearTimeout(qrTimer); clearInterval(barTimer); $('qrImg').classList.add('hidden'); }
  } catch (e) { /* reintenta en el próximo ciclo */ }
}

$('btnProyector').onclick = () => {
  document.body.classList.toggle('proyector');
  $('btnProyector').textContent = document.body.classList.contains('proyector') ? 'Salir del modo proyector' : 'Modo proyector';
  if (document.body.classList.contains('proyector')) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.fullscreenElement && document.exitFullscreen();
};
$('btnCerrar').onclick = async () => {
  if (!confirm('¿Cerrar la clase? Ya no se podrá marcar asistencia.')) return;
  await api(`/api/clases/${codigo}/cerrar`, { method: 'POST' }); sessionStorage.removeItem('codigo');
  await cargarLista(); $('btnCerrar').classList.add('hidden'); $('btnProyector').classList.add('hidden');
};
$('btnCsv').onclick = async () => {
  const r = await api(`/api/clases/${codigo}/reporte.csv`); const blob = await r.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `asistencia-${codigo}.csv`; a.click();
};

if (clave) entrar();
