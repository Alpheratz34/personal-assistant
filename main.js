const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Configuración de la ventana de tu app
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#000000', // Fondo negro inicial mientras carga
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Carga tu archivo principal
  win.loadFile('index.html');

  // Opcional: Abre las herramientas de desarrollo automáticamente para ver errores
  // win.webContents.openDevTools();
}

// Cuando Electron esté listo, crea la ventana
app.whenReady().then(createWindow);

// Cerrar la app cuando todas las ventanas se cierren (excepto en Mac)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});