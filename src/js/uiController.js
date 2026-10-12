/**
 * User Interface Controller for Peoria Gaussian Splat Desktop Engine.
 * Binds DOM controls, time/weather sliders, scene switches, and YouTube pipeline interactions.
 */

export class UIController {
  constructor(app) {
    this.app = app;
    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.dashboard = document.getElementById('dashboard');
    this.toggleBtn = document.getElementById('dashboard-toggle');
    this.widgetScene = document.getElementById('widget-scene');
    this.widgetTemp = document.getElementById('widget-temp');
    this.widgetIce = document.getElementById('widget-ice');
    this.timeVal = document.getElementById('time-val');
    this.tempVal = document.getElementById('temp-val');
    this.iceVal = document.getElementById('ice-val');
    this.sliderTime = document.getElementById('slider-time');
    this.sliderTemp = document.getElementById('slider-temp');
    this.sliderIce = document.getElementById('slider-ice');
    this.ytInput = document.getElementById('youtube-url-input');
    this.ytStatus = document.getElementById('youtube-status');
  }

  bindEvents() {
    // Collapsible Dashboard Toggle
    this.toggleBtn.addEventListener('click', () => {
      this.dashboard.classList.toggle('collapsed');
    });

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const target = btn.dataset.tab;
        document.getElementById(`panel-${target}`).classList.add('active');
      });
    });

    // Scene Selection Buttons
    document.getElementById('btn-scene-riverfront').addEventListener('click', () => this.switchScene('riverfront'));
    document.getElementById('btn-scene-skyline').addEventListener('click', () => this.switchScene('skyline'));
    document.getElementById('btn-scene-grandview').addEventListener('click', () => this.switchScene('grandview'));
    document.getElementById('btn-scene-custom').addEventListener('click', () => this.switchScene('custom'));

    // Camera Perspective Buttons
    document.getElementById('btn-cam-orbit').addEventListener('click', () => this.setCameraMode('orbit'));
    document.getElementById('btn-cam-tour').addEventListener('click', () => this.setCameraMode('tour'));

    // Time Sliders & Presets
    this.sliderTime.addEventListener('input', (e) => {
      const hours = parseFloat(e.target.value);
      this.app.envEngine.autoSyncClock = false;
      this.app.envEngine.setTimeOfDay(hours);
      this.updateTimeDisplay(hours);
    });

    document.getElementById('btn-time-dawn').addEventListener('click', () => this.setTime(6.0));
    document.getElementById('btn-time-noon').addEventListener('click', () => this.setTime(12.0));
    document.getElementById('btn-time-sunset').addEventListener('click', () => this.setTime(18.5));
    document.getElementById('btn-time-night').addEventListener('click', () => this.setTime(22.0));

    document.getElementById('btn-toggle-autosync').addEventListener('click', () => {
      this.app.envEngine.autoSyncClock = !this.app.envEngine.autoSyncClock;
      document.getElementById('btn-toggle-autosync').classList.toggle('active', this.app.envEngine.autoSyncClock);
    });

    // Weather Presets
    document.getElementById('btn-wx-clear').addEventListener('click', () => this.setWeather('clear'));
    document.getElementById('btn-wx-rain').addEventListener('click', () => this.setWeather('rain'));
    document.getElementById('btn-wx-snow').addEventListener('click', () => this.setWeather('snow'));
    document.getElementById('btn-wx-fog').addEventListener('click', () => this.setWeather('fog'));

    // Sliders
    this.sliderIce.addEventListener('input', (e) => {
      const ice = parseFloat(e.target.value);
      this.app.envEngine.setWeather({ ice });
      this.updateIceDisplay(ice);
    });

    this.sliderTemp.addEventListener('input', (e) => {
      const temp = parseInt(e.target.value);
      this.app.envEngine.setWeather({ temp });
      this.updateTempDisplay(temp);
      this.updateIceDisplay(this.app.envEngine.weather.winterIce);
      this.sliderIce.value = this.app.envEngine.weather.winterIce;
    });

    // YouTube 4K Ingestion
    document.getElementById('btn-process-youtube').addEventListener('click', () => {
      const url = this.ytInput.value.trim() || 'https://www.youtube.com/watch?v=peoria_4k_drone';
      this.processYouTubeUrl(url);
    });

    document.getElementById('btn-yt-sample1').addEventListener('click', () => {
      this.ytInput.value = 'https://www.youtube.com/watch?v=peoria_illinois_4k_drone';
      this.processYouTubeUrl(this.ytInput.value);
    });

    document.getElementById('btn-yt-sample2').addEventListener('click', () => {
      this.ytInput.value = 'https://www.youtube.com/watch?v=murray_baker_bridge_4k';
      this.processYouTubeUrl(this.ytInput.value);
    });

    // Electron IPC Listeners
    if (window.electronAPI) {
      window.electronAPI.onSwitchScene((scene) => this.switchScene(scene));
      window.electronAPI.onSetTimeMode((mode) => {
        if (mode === 'auto') {
          this.app.envEngine.autoSyncClock = true;
          const syncBtn = document.getElementById('btn-toggle-autosync');
          if (syncBtn) syncBtn.classList.add('active');
        }
      });
      window.electronAPI.onSetTime((hour) => this.setTime(hour));
      window.electronAPI.onSetWeather((params) => {
        if (typeof params === 'string') {
          this.setWeather(params);
        } else if (params && params.preset) {
          this.setWeather(params.preset);
        } else {
          this.app.envEngine.setWeather(params);
        }
      });
      window.electronAPI.onDesktopModeChanged((isDesktop) => {
        const badge = document.getElementById('mode-badge');
        if (badge) {
          badge.textContent = isDesktop ? 'DESKTOP WALLPAPER' : 'WINDOW';
          badge.className = isDesktop ? 'badge badge-green' : 'badge badge-ice';
        }
      });
    }
  }

  setCameraMode(mode) {
    document.querySelectorAll('#btn-cam-orbit, #btn-cam-tour').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-cam-${mode}`);
    if (btn) btn.classList.add('active');

    this.app.setCameraMode(mode);
    const camVal = document.getElementById('camera-val');
    if (camVal) {
      camVal.textContent = mode === 'tour' ? 'River Tour' : 'Orbit View';
    }
  }

  switchScene(sceneName) {
    document.querySelectorAll('#panel-scenes .btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-scene-${sceneName}`);
    if (btn) btn.classList.add('active');

    this.app.loadScene(sceneName);
    this.widgetScene.textContent = sceneName.charAt(0).toUpperCase() + sceneName.slice(1);
  }

  setTime(hours) {
    this.sliderTime.value = hours;
    this.app.envEngine.setTimeOfDay(hours);
    this.updateTimeDisplay(hours);
  }

  setWeather(preset) {
    document.querySelectorAll('#panel-weather .btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-wx-${preset}`);
    if (btn) btn.classList.add('active');

    this.app.envEngine.setWeather({ preset });
    this.sliderTemp.value = this.app.envEngine.weather.temperature;
    this.sliderIce.value = this.app.envEngine.weather.winterIce;

    this.updateTempDisplay(this.app.envEngine.weather.temperature);
    this.updateIceDisplay(this.app.envEngine.weather.winterIce);
  }

  updateTimeDisplay(hours) {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m < 10 ? '0' + m : m;
    this.timeVal.textContent = `${displayH}:${displayM} ${ampm}`;
  }

  updateTempDisplay(temp) {
    this.tempVal.textContent = `${temp}°F`;
    this.widgetTemp.textContent = `${temp}°F | ${this.app.envEngine.weather.preset.toUpperCase()}`;
  }

  updateIceDisplay(iceFraction) {
    const pct = Math.round(iceFraction * 100);
    this.iceVal.textContent = `${pct}% Frozen`;
    this.widgetIce.textContent = `Ice: ${pct}%`;
  }

  async processYouTubeUrl(url) {
    this.ytStatus.textContent = 'Processing YouTube 4K Peoria video spatial frames...';
    try {
      const result = await this.app.ytPipeline.processUrl(url, (msg) => {
        this.ytStatus.textContent = msg;
      });

      this.ytStatus.textContent = `Successfully extracted 3D Gaussian Splat from video! (${result.title})`;
      this.app.setCustomSplatData(result.splatData);
      this.app.splatRenderer.loadSplatData(result.splatData);
      
      const customBtn = document.getElementById('btn-scene-custom');
      customBtn.disabled = false;
      customBtn.textContent = '📹 Custom 4K Splat';
      document.querySelectorAll('#panel-scenes .btn').forEach(b => b.classList.remove('active'));
      customBtn.classList.add('active');
    } catch (err) {
      this.ytStatus.textContent = `Error processing video: ${err.message}`;
    }
  }
}
