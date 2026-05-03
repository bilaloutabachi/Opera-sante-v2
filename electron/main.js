// Opera sante - Electron main process.
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

const isDev = process.argv.includes('--dev');
const BACKEND_PORT = 8001;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;

let mainWindow = null;
let backendProcess = null;

function resourcePath(relPath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relPath);
  }
  return path.join(__dirname, relPath);
}

function userDataDbPath() {
  const userData = app.getPath('userData');
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  return path.join(userData, 'opera.db');
}

// Tuer tout processus qui occupe le port 8001
function killPort() {
  try {
    const result = execSync(`netstat -ano | findstr :${BACKEND_PORT}`, { encoding: 'utf8' });
    const lines = result.split('\n');
    const pids = new Set();
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5 && parts[1].includes(`:${BACKEND_PORT}`)) {
        const pid = parts[4];
        if (pid && pid !== '0') pids.add(pid);
      }
    });
    pids.forEach(pid => {
      try {
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
        console.log(`Killed PID ${pid} on port ${BACKEND_PORT}`);
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* port not in use, good */ }
}

function killBackend() {
  if (backendProcess) {
    try { execSync(`taskkill /F /PID ${backendProcess.pid} /T`, { stdio: 'ignore' }); } catch (e) { /* ignore */ }
    try { backendProcess.kill('SIGKILL'); } catch (e) { /* ignore */ }
    backendProcess = null;
  }
  killPort();
}

function startBackend() {
  // Nettoyer le port avant de demarrer
  killPort();

  const dbPath = userDataDbPath();
  const env = {
    ...process.env,
    OPERA_DB_PATH: dbPath,
    PYTHONIOENCODING: 'utf-8',
  };

  let command, args;
  if (app.isPackaged) {
    const exeName = process.platform === 'win32' ? 'opera-backend.exe' : 'opera-backend';
    command = path.join(process.resourcesPath, 'backend-dist', exeName);
    args = [];
  } else {
    command = process.platform === 'win32' ? 'python' : 'python3';
    args = [path.join(__dirname, '..', 'backend', 'server.py')];
  }

  console.log(`Starting backend: ${command}`);
  console.log(`DB path: ${dbPath}`);

  backendProcess = spawn(command, args, {
    env,
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (data) => console.log(`[backend] ${data}`));
  backendProcess.stderr.on('data', (data) => console.error(`[backend] ${data}`));
  backendProcess.on('exit', (code) => {
    console.log(`Backend exited with code ${code}`);
    if (code !== 0 && !app.isQuitting) {
      dialog.showErrorBox(
        'Opera sante',
        `Le serveur interne s'est arrete (code ${code}). L'application va se fermer.`
      );
      app.quit();
    }
  });
}

async function waitForBackend(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/`);
      if (res.ok) return true;
    } catch (e) { /* not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Opera sante',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#fafaf9',
    show: false,
  });

  if (app.isPackaged) {
    const indexPath = path.join(process.resourcesPath, 'frontend-dist', 'index.html');
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => (mainWindow = null));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  startBackend();
  const ok = await waitForBackend();
  if (!ok) {
    dialog.showErrorBox(
      'Opera sante',
      "Impossible de demarrer le serveur interne (timeout 30 s)."
    );
    app.quit();
    return;
  }
  createWindow();

  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Sauvegarder la base',
          click: async () => {
            const res = await dialog.showSaveDialog(mainWindow, {
              title: 'Sauvegarder la base Opera sante',
              defaultPath: `opera-sante-backup-${new Date().toISOString().slice(0, 10)}.db`,
              filters: [{ name: 'Base SQLite', extensions: ['db'] }],
            });
            if (!res.canceled && res.filePath) {
              try {
                fs.copyFileSync(userDataDbPath(), res.filePath);
                dialog.showMessageBox(mainWindow, {
                  message: 'Sauvegarde effectuee',
                  detail: res.filePath,
                });
              } catch (e) {
                dialog.showErrorBox('Erreur', String(e));
              }
            }
          },
        },
        {
          label: 'Restaurer une sauvegarde',
          click: async () => {
            const res = await dialog.showOpenDialog(mainWindow, {
              title: 'Choisir une sauvegarde a restaurer',
              filters: [{ name: 'Base SQLite', extensions: ['db'] }],
              properties: ['openFile'],
            });
            if (!res.canceled && res.filePaths[0]) {
              const confirm = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['Annuler', 'Restaurer et redemarrer'],
                defaultId: 0,
                cancelId: 0,
                message: "Restaurer cette sauvegarde ?",
                detail: "Vos donnees actuelles seront REMPLACEES. L'application redemarrera.",
              });
              if (confirm.response === 1) {
                try {
                  killBackend();
                  fs.copyFileSync(res.filePaths[0], userDataDbPath());
                  app.relaunch();
                  app.exit();
                } catch (e) {
                  dialog.showErrorBox('Erreur', String(e));
                }
              }
            }
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils developpeur', visible: isDev },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Reduire' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein ecran' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'A propos',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'Opera sante',
              message: 'Opera sante v1.0',
              detail: `Gestion de cabinet dentaire - application locale.\n\nBase de donnees:\n${userDataDbPath()}`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on('before-quit', () => {
  app.isQuitting = true;
  killBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});