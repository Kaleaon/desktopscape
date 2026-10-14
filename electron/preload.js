const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPeoriaWeather: () => ipcRenderer.invoke('get-peoria-weather'),
  processYouTubeUrl: (url) => ipcRenderer.invoke('process-youtube-url', url),
  onSwitchScene: (callback) => ipcRenderer.on('switch-scene', (e, scene) => callback(scene)),
  onSetTimeMode: (callback) => ipcRenderer.on('set-time-mode', (e, mode) => callback(mode)),
  onSetTime: (callback) => ipcRenderer.on('set-time', (e, hour) => callback(hour)),
  onSetWeather: (callback) => ipcRenderer.on('set-weather', (e, params) => callback(params)),
  onDesktopModeChanged: (callback) => ipcRenderer.on('desktop-mode-changed', (e, isDesktop) => callback(isDesktop)),
  onWindowVisibilityChanged: (callback) => ipcRenderer.on('window-visibility-changed', (e, isVisible) => callback(isVisible))
});
