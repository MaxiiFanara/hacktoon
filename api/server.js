const express = require('express');
const crypto = require('crypto');
const path = require('path');
const QRCode = require('qrcode');
const { db, save } = require('./store');

const PORT = process.env.PORT || 3000;
const DOCENTE_KEY = process.env.DOCENTE_KEY || 'cervantes';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
// IPs (exactas) o prefijos (terminados en "." o ":") permitidos para marcar presencial.
// Ej: CERVANTES_IPS="200.45.10.20,192.168.1."  Vacío = no se valida (modo desarrollo).
const ALLOWED_IPS = (process.env.CERVANTES_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
const QR_STEP_S = 25;                // el QR cambia cada 25 s
const HEARTBEAT_MAX_GAP_MS = 45_000; // huecos mayores no cuentan como cámara encendida

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
app.use(express.json({ limit: '10kb' }));

// CORS abierto solo para el endpoint que usa la extensión
app.use('/api/virtual', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- helpers ----------
const clientIp = req => (req.ip || '').replace(/^::ffff:/, '');
const ipPermitida = ip => ALLOWED_IPS.length === 0 || ALLOWED_IPS.some(a => (a.endsWith('.') || a.endsWith(':')) ? ip.startsWith(a) : ip === a);
const stepNow = () => Math.floor(Date.now() / (QR_STEP_S * 1000));
const tokenFor = (secret, step) => crypto.createHmac('sha256', secret).update(String(step)).digest('hex').slice(0, 8);
const tokenValido = (secret, t) => [stepNow(), stepNow() - 1].some(s => {
  const a = Buffer.from(tokenFor(secret, s)), b = Buffer.from(String(t || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
});
const nuevoCodigo = () => {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => abc[crypto.randomInt(abc.length)]).join(''); } while (db.clases[c]);
  return c;
};
const baseUrl = req => PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const limpiar = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const limpiarDni = s => String(s ?? '').replace(/\D/g, '').slice(0, 12);

function docente(req, res, next) {
  if (req.get('x-docente-key') !== DOCENTE_KEY) return res.status(401).json({ error: 'Clave de docente incorrecta' });
  next();
}
function getClase(req, res) {
  const c = db.clases[String(req.params.id || req.body?.codigo || '').toUpperCase()];
  if (!c) { res.status(404).json({ error: 'Clase no encontrada' }); return null; }
  return c;
}
function denominadorMs(c) {
  const fin = Math.min(c.cerrada ? c.fin : Date.now(), c.inicio + c.duracionMin * 60_000);
  return Math.max(fin - c.inicio, 1);
}
function reporte(c) {
  const den = denominadorMs(c);
  const presenciales = Object.values(c.presenciales).map(p => ({ ...p, estado: 'Presente' }));
  const virtuales = Object.values(c.virtuales).map(v => {
    const pct = Math.min(100, Math.round((v.camOnMs / den) * 100));
    return { nombre: v.nombre, dni: v.dni, camaraOn: v.lastState, minutosCamara: +(v.camOnMs / 60000).toFixed(1), porcentaje: pct, estado: pct >= c.umbral ? 'Presente' : 'Ausente (cámara insuficiente)' };
  });
  return { codigo: c.id, nombre: c.nombre, inicio: c.inicio, duracionMin: c.duracionMin, umbral: c.umbral, cerrada: c.cerrada, presenciales, virtuales };
}

// ---------- docente ----------
app.get('/api/config', (req, res) => res.json({ ipCheck: ALLOWED_IPS.length > 0, qrStepS: QR_STEP_S }));

app.post('/api/clases', docente, (req, res) => {
  const nombre = limpiar(req.body.nombre) || 'Clase';
  const duracionMin = Math.min(Math.max(parseInt(req.body.duracionMin) || 60, 5), 600);
  const umbral = Math.min(Math.max(parseInt(req.body.umbral) || 75, 1), 100);
  const id = nuevoCodigo();
  db.clases[id] = { id, nombre, secret: crypto.randomBytes(24).toString('hex'), inicio: Date.now(), duracionMin, umbral, cerrada: false, fin: null, presenciales: {}, virtuales: {} };
  save();
  res.json({ codigo: id, nombre, duracionMin, umbral });
});

app.get('/api/clases', docente, (req, res) =>
  res.json(Object.values(db.clases).sort((a, b) => b.inicio - a.inicio).map(({ id, nombre, inicio, cerrada }) => ({ codigo: id, nombre, inicio, cerrada }))));

app.get('/api/clases/:id/qr', docente, async (req, res) => {
  const c = getClase(req, res); if (!c) return;
  if (c.cerrada) return res.status(409).json({ error: 'La clase está cerrada' });
  const step = stepNow();
  const url = `${baseUrl(req)}/asistir.html?c=${c.id}&t=${tokenFor(c.secret, step)}`;
  const expiraEnMs = (step + 1) * QR_STEP_S * 1000 - Date.now();
  res.json({ url, qr: await QRCode.toDataURL(url, { margin: 1, width: 600 }), expiraEnMs });
});

app.post('/api/clases/:id/cerrar', docente, (req, res) => {
  const c = getClase(req, res); if (!c) return;
  if (!c.cerrada) { c.cerrada = true; c.fin = Date.now(); save(); }
  res.json(reporte(c));
});

app.get('/api/clases/:id/reporte', docente, (req, res) => { const c = getClase(req, res); if (c) res.json(reporte(c)); });

app.get('/api/clases/:id/reporte.csv', docente, (req, res) => {
  const c = getClase(req, res); if (!c) return;
  const r = reporte(c);
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const filas = [['Modalidad', 'Nombre', 'DNI', 'Porcentaje cámara', 'Estado']];
  r.presenciales.forEach(p => filas.push(['Presencial', p.nombre, p.dni, '', p.estado]));
  r.virtuales.forEach(v => filas.push(['Virtual', v.nombre, v.dni, v.porcentaje + '%', v.estado]));
  res.type('text/csv').send('﻿' + filas.map(f => f.map(esc).join(',')).join('\n'));
});

// ---------- alumno presencial ----------
app.get('/api/clases/:id/info', (req, res) => {
  const c = getClase(req, res); if (c) res.json({ nombre: c.nombre, cerrada: c.cerrada });
});

app.post('/api/asistencia/presencial', (req, res) => {
  const c = getClase(req, res); if (!c) return;
  if (c.cerrada) return res.status(409).json({ error: 'La clase ya está cerrada' });
  const ip = clientIp(req);
  if (!ipPermitida(ip)) return res.status(403).json({ error: 'Tenés que estar conectado al Wi-Fi de Cervantes para marcar presente.' });
  if (!tokenValido(c.secret, req.body.token)) return res.status(410).json({ error: 'El QR venció. Escaneá el que está en pantalla ahora.' });
  const dni = limpiarDni(req.body.dni), nombre = limpiar(req.body.nombre);
  if (dni.length < 6 || !nombre) return res.status(400).json({ error: 'Completá nombre y DNI válidos' });
  if (c.presenciales[dni]) return res.json({ ok: true, repetido: true, nombre: c.presenciales[dni].nombre });
  c.presenciales[dni] = { nombre, dni, ts: Date.now(), ip };
  save();
  res.json({ ok: true, nombre });
});

// ---------- alumno virtual (extensión de Chrome) ----------
app.post('/api/virtual/evento', (req, res) => {
  const c = getClase(req, res); if (!c) return;
  if (c.cerrada) return res.status(409).json({ error: 'La clase ya está cerrada' });
  const dni = limpiarDni(req.body.dni), nombre = limpiar(req.body.nombre);
  if (dni.length < 6 || !nombre) return res.status(400).json({ error: 'Nombre/DNI inválidos' });
  const now = Date.now();
  const v = c.virtuales[dni] ||= { nombre, dni, camOnMs: 0, lastTs: now, lastState: false };
  // Suma el tramo anterior solo si el estado previo era "cámara on" y el hueco es razonable
  const gap = now - v.lastTs;
  if (v.lastState && gap > 0 && gap <= HEARTBEAT_MAX_GAP_MS) v.camOnMs += gap;
  v.nombre = nombre; v.lastTs = now; v.lastState = !!req.body.camara;
  save();
  res.json({ ok: true });
});

// ---------- front ----------
app.use(express.static(path.join(__dirname, '..', 'front end')));

app.listen(PORT, () => {
  console.log(`Asistencia Cervantes en http://localhost:${PORT}  (docente: /docente.html)`);
  console.log(`Clave docente: ${DOCENTE_KEY === 'cervantes' ? '"cervantes" (default, cambiala con DOCENTE_KEY)' : '(personalizada)'}`);
  if (!ALLOWED_IPS.length) console.log('AVISO: CERVANTES_IPS vacío -> NO se valida la red (modo desarrollo).');
});
