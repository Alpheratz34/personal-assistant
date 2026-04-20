const { ipcRenderer } = require('electron');

document.getElementById('btn-min').addEventListener('click',   () => ipcRenderer.send('window-control', 'minimize'));
document.getElementById('btn-max').addEventListener('click',   () => ipcRenderer.send('window-control', 'maximize'));
document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('window-control', 'close'));
