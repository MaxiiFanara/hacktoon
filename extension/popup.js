const campos = ['servidor', 'codigo', 'nombre', 'dni'];
const $ = id => document.getElementById(id);

chrome.storage.local.get([...campos, 'ultimo']).then(d => {
  campos.forEach(c => { $(c).value = d[c] || (c === 'servidor' ? 'http://localhost:3000' : ''); });
  if (d.ultimo) {
    const seg = Math.round((Date.now() - d.ultimo.ts) / 1000);
    $('estado').textContent = `Último envío hace ${seg}s · cámara ${d.ultimo.camara ? 'ENCENDIDA' : 'apagada'} · ${d.ultimo.ok ? 'OK' : 'ERROR: ' + d.ultimo.error}`;
  } else $('estado').textContent = 'Aún no se envió nada. Entrá a una reunión de Teams en Chrome.';
});

$('guardar').onclick = async () => {
  const v = Object.fromEntries(campos.map(c => [c, $(c).value.trim()]));
  v.codigo = v.codigo.toUpperCase();
  await chrome.storage.local.set(v);
  $('estado').textContent = 'Guardado. Ya podés entrar a Teams.';
};
