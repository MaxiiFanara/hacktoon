# Asistencia Cervantes

Monolito Node/Express: `api/` (servidor), `front end/` (HTML/CSS/JS), `extension/` (Chrome).

## Correr
    npm install
    DOCENTE_KEY=tuclave CERVANTES_IPS="200.45.10.20" PUBLIC_URL="https://tu-dominio" npm start

- `CERVANTES_IPS`: IPs públicas (o prefijos terminados en ".") permitidas. Vacío = sin validar (desarrollo).
- Si el server corre en la LAN del aula, usá el prefijo de la red, ej. `192.168.1.`.
- `PUBLIC_URL`: URL que verán los celulares (en LAN, `http://192.168.1.50:3000`). Si el server está detrás de proxy: `TRUST_PROXY=true`.

## Uso
1. Docente: `/docente.html` -> crear clase -> Modo proyector (QR rotativo cada 25 s). Pasa el código de 5 letras a los virtuales.
2. Presenciales: escanean el QR; el server valida token vigente + IP.
3. Virtuales: Chrome -> `chrome://extensions` -> Modo desarrollador -> Cargar descomprimida -> carpeta `extension/`. En el popup: servidor, código, nombre, DNI. Entrar a Teams Web.
4. Cierre de clase -> reporte y CSV. Virtual presente si % cámara >= umbral (75% por defecto).
# hacktoon
