const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let mainWindow = null;
let tray = null;
let isDesktopWallpaperMode = false;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(800, height),
    minWidth: 900,
    minHeight: 600,
    title: 'Peoria 4K Gaussian Splat Desktop Engine',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0d14'
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Create simple 16x16 icon programmatically if asset file missing
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let icon = fs.existsSync(iconPath) 
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Peoria 4K Gaussian Splat Desktop Engine');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Peoria Gaussian Splat Desktopscape', enabled: false },
    { type: 'separator' },
    {
      label: 'Toggle Live Desktop Wallpaper Mode',
      type: 'checkbox',
      checked: isDesktopWallpaperMode,
      click: () => toggleDesktopWallpaperMode()
    },
    { type: 'separator' },
    {
      label: 'Peoria Landmark Scenes',
      submenu: [
        { label: 'Peoria Riverfront & Illinois River', click: () => sendToWindow('switch-scene', 'riverfront') },
        { label: 'Downtown Peoria Skyline', click: () => sendToWindow('switch-scene', 'skyline') },
        { label: 'Grandview Drive Overlook', click: () => sendToWindow('switch-scene', 'grandview') }
      ]
    },
    {
      label: 'Time of Day',
      submenu: [
        { label: 'Auto Sync Local Time', click: () => sendToWindow('set-time-mode', 'auto') },
        { label: 'Sunrise', click: () => sendToWindow('set-time', 6.5) },
        { label: 'Midday / Noon', click: () => sendToWindow('set-time', 12.0) },
        { label: 'Sunset / Golden Hour', click: () => sendToWindow('set-time', 18.5) },
        { label: 'Night Lighting', click: () => sendToWindow('set-time', 22.0) }
      ]
    },
    {
      label: 'Weather & Winter River Ice',
      submenu: [
        { label: 'Clear Skies', click: () => sendToWindow('set-weather', { preset: 'clear' }) },
        { label: 'Rain on Peoria River', click: () => sendToWindow('set-weather', { preset: 'rain' }) },
        { label: 'Heavy Snowfall', click: () => sendToWindow('set-weather', { preset: 'snow' }) },
        { label: 'River Ice Freeze (Winter)', click: () => sendToWindow('set-weather', { preset: 'winter-ice', temp: -10, ice: 1.0 }) },
        { label: 'River Fog & Haze', click: () => sendToWindow('set-weather', { preset: 'fog' }) }
      ]
    },
    { type: 'separator' },
    { label: 'Show Application Dashboard', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: 'Quit Peoria Desktopscape', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
}

function toggleDesktopWallpaperMode() {
  if (!mainWindow) return;
  isDesktopWallpaperMode = !isDesktopWallpaperMode;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  if (isDesktopWallpaperMode) {
    mainWindow.setBounds({ x: 0, y: 0, width, height });
    mainWindow.setFrameless ? mainWindow.setFrameless(true) : null;
    mainWindow.setSkipTaskbar(true);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(false);
    sendToWindow('desktop-mode-changed', true);
  } else {
    mainWindow.setSkipTaskbar(false);
    mainWindow.setResizable(true);
    mainWindow.setSize(1280, 800);
    mainWindow.center();
    sendToWindow('desktop-mode-changed', false);
  }
}

function sendToWindow(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// IPC Handlers
ipcMain.handle('get-peoria-weather', async () => {
  // Peoria, IL coordinates: 40.6936° N, 89.5890° W
  return new Promise((resolve) => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=40.6936&longitude=-89.5890&current_weather=true';
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ success: true, weather: json.current_weather });
        } catch (e) {
          resolve({ success: false, fallback: getSimulatedPeoriaWeather() });
        }
      });
    }).on('error', () => {
      resolve({ success: false, fallback: getSimulatedPeoriaWeather() });
    });
  });
});

ipcMain.handle('process-youtube-url', async (event, url) => {
  try {
    const { processYouTubePeoriaVideo } = require('../src/js/youtubePipelineBackend');
    const result = await processYouTubePeoriaVideo(url);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function getSimulatedPeoriaWeather() {
  const month = new Date().getMonth();
  const isWinter = month === 11 || month === 0 || month === 1; // Dec, Jan, Feb
  return {
    temperature: isWinter ? -5 : 22,
    windspeed: 12.5,
    weathercode: isWinter ? 71 : 0, // 71 = Snow, 0 = Clear
    is_day: 1,
    location: 'Peoria, IL'
  };
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
