import { app, BrowserWindow, session } from 'electron';

// Aceptar certificados SSL autofirmados locales sin alertas de seguridad
app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    title: 'Ringo Club - Gestión de Socios',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('https://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // a) Asignar ruta de datos de usuario antes de importar el servidor
    process.env.RINGO_DATA_DIR = app.getPath('userData');

    // Importación dinámica para asegurar que db.js lea RINGO_DATA_DIR
    const { startServer } = await import('../server/server.js');

    // b) Iniciar servidor Express en el puerto 3000
    await startServer(3000);

    // c) Conceder permisos de cámara sin interrupciones para captura y escaneo QR
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media') {
        return callback(true);
      }
      callback(true);
    });

    // d) Crear la ventana principal de la aplicación
    createWindow();
  } catch (error) {
    console.error('Error al inicializar la aplicación Electron:', error);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
