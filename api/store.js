// Capa de datos: memoria + persistencia en JSON. Para producción, reemplazar
// solo este módulo por SQLite/Postgres sin tocar el resto.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
let db = { clases: {} };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* primer arranque */ }

let timer;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  }, 300);
}

module.exports = { db, save };
