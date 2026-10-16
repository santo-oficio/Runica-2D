// Proceso principal de Runika 2D (Electron).
// Arranca el servidor de juego empaquetado, espera a que responda
// y abre la ventana. Funciona igual en dev (npx electron .) y
// en la app instalada (resources/app/...).
import electron from 'electron/main';
const { app, BrowserWindow } = electron;
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(__dirname, '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

let URL = '';

function waitForServer(url, timeoutMs = 20000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - t0 > timeoutMs) reject(new Error('servidor no responde'));
        else setTimeout(tryOnce, 200);
      });
    };
    tryOnce();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.loadURL(URL);
  win.webContents.on('did-fail-load', () => {
    setTimeout(() => win.loadURL(URL), 1000);
  });
}

async function start() {
  const PORT = await freePort();
  URL = `http://127.0.0.1:${PORT}/`;
  process.env.RUNIKA_ROOT = APP_ROOT;
  process.env.RUNIKA_DB_DIR = path.join(app.getPath('userData'), 'db');
  process.env.RUNIKA_PORT = String(PORT);
  try {
    await import(pathToFileURL(path.join(APP_ROOT, 'electron-app', 'server.mjs')).href);
  } catch (err) {
    console.error('Runika 2D: error arrancando el servidor', err);
    app.quit();
    return;
  }
  try {
    await waitForServer(URL);
  } catch (err) {
    console.error('Runika 2D:', err.message);
    app.quit();
    return;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.whenReady().then(start);
app.on('window-all-closed', () => { app.quit(); });
