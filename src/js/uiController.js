/**
 * User Interface Controller for Peoria Gaussian Splat Desktop Engine.
 * Binds DOM controls, time/weather sliders, scene switches, view-angle registration,
 * temporal delta selectors, and incremental ingestion interactions.
 */

import { translateError } from './errorTranslationMiddleware.js';
import { AsyncBoundaryManager, PANEL_TYPES, ERROR_CODES } from './asyncBoundary.js';

export class UIController {
  constructor(app) {
    this.app = app;
    this.selectedPose = 'drone-aerial';
    this.selectedSeason = 'summer';

    this.initBoundaryManager();
    this.initDOM();
    this.bindEvents();
  }

  initBoundaryManager() {
    this.boundaryManager = new AsyncBoundaryManager({
      onFallbackNavigate: (panelType) => {
        if (panelType !== PANEL_TYPES.SCENES) {
          this.switchTab('scenes');
        } else {
          this.switchScene('riverfront');
        }
      }
    });

    this.boundaryManager.registerPanel(PANEL_TYPES.SCENES, 'panel-scenes');
    this.boundaryManager.registerPanel(PANEL_TYPES.TIME, 'panel-time');
    this.boundaryManager.registerPanel(PANEL_TYPES.WEATHER, 'panel-weather');
    this.boundaryManager.registerPanel(PANEL_TYPES.YOUTUBE, 'panel-youtube');
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

    // Incremental Statistics DOM
    this.statSplatCount = document.getElementById('stat-splat-count');
    this.statSourcesCount = document.getElementById('stat-sources-count');
    this.statPose = document.getElementById('stat-pose');
    this.statSeason = document.getElementById('stat-season');
  }

  switchTab(tabKey) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const btn = document.querySelector(`.tab-btn[data-tab="${tabKey}"]`);
    if (btn) btn.classList.add('active');

    const panel = document.getElementById(`panel-${tabKey}`);
    if (panel) panel.classList.add('active');
  }

  bindEvents() {
    // Collapsible Dashboard Toggle
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        if (this.dashboard) this.dashboard.classList.toggle('collapsed');
      });
    }

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        this.switchTab(target);
      });
    });

    // Scene Selection Buttons
    const btnRf = document.getElementById('btn-scene-riverfront');
    if (btnRf) btnRf.addEventListener('click', () => this.switchScene('riverfront'));
    const btnSky = document.getElementById('btn-scene-skyline');
    if (btnSky) btnSky.addEventListener('click', () => this.switchScene('skyline'));
    const btnGv = document.getElementById('btn-scene-grandview');
    if (btnGv) btnGv.addEventListener('click', () => this.switchScene('grandview'));
    const btnCust = document.getElementById('btn-scene-custom');
    if (btnCust) btnCust.addEventListener('click', () => this.switchScene('custom'));

    // Camera Perspective Buttons
    const btnCamOrb = document.getElementById('btn-cam-orbit');
    if (btnCamOrb) btnCamOrb.addEventListener('click', () => this.setCameraMode('orbit'));
    const btnCamTour = document.getElementById('btn-cam-tour');
    if (btnCamTour) btnCamTour.addEventListener('click', () => this.setCameraMode('tour'));

    // Camera Registration Pose Selection
    ['drone', 'ground', 'bluff', 'oblique'].forEach(poseKey => {
      const btn = document.getElementById(`btn-pose-${poseKey}`);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[id^="btn-pose-"]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedPose = btn.dataset.pose;
          if (this.statPose) this.statPose.textContent = btn.textContent.split(' ')[1] || this.selectedPose;
        });
      }
    });

    // Seasonal Delta Selection
    ['summer', 'autumn', 'winter', 'spring'].forEach(seasonKey => {
      const btn = document.getElementById(`btn-season-${seasonKey}`);
      if (btn) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[id^="btn-season-"]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectedSeason = btn.dataset.season;
          if (this.statSeason) this.statSeason.textContent = seasonKey.charAt(0).toUpperCase() + seasonKey.slice(1);
        });
      }
    });

    // Reset Model Button
    const resetBtn = document.getElementById('btn-reset-model');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.switchScene('riverfront');
        if (this.ytStatus) this.ytStatus.textContent = 'Reset base model to Peoria Riverfront.';
      });
    }

    // Time Sliders & Presets
    if (this.sliderTime) {
      this.sliderTime.addEventListener('input', (e) => {
        const hours = parseFloat(e.target.value);
        this.app.envEngine.autoSyncClock = false;
        this.setTime(hours);
      });
    }

    const btnDawn = document.getElementById('btn-time-dawn');
    if (btnDawn) btnDawn.addEventListener('click', () => this.setTime(6.0));
    const btnNoon = document.getElementById('btn-time-noon');
    if (btnNoon) btnNoon.addEventListener('click', () => this.setTime(12.0));
    const btnSunset = document.getElementById('btn-time-sunset');
    if (btnSunset) btnSunset.addEventListener('click', () => this.setTime(18.5));
    const btnNight = document.getElementById('btn-time-night');
    if (btnNight) btnNight.addEventListener('click', () => this.setTime(22.0));

    const btnSync = document.getElementById('btn-toggle-autosync');
    if (btnSync) {
      btnSync.addEventListener('click', () => {
        this.app.envEngine.autoSyncClock = !this.app.envEngine.autoSyncClock;
        btnSync.classList.toggle('active', this.app.envEngine.autoSyncClock);
      });
    }

    // Weather Presets
    const btnWxClear = document.getElementById('btn-wx-clear');
    if (btnWxClear) btnWxClear.addEventListener('click', () => this.setWeather('clear'));
    const btnWxRain = document.getElementById('btn-wx-rain');
    if (btnWxRain) btnWxRain.addEventListener('click', () => this.setWeather('rain'));
    const btnWxSnow = document.getElementById('btn-wx-snow');
    if (btnWxSnow) btnWxSnow.addEventListener('click', () => this.setWeather('snow'));
    const btnWxFog = document.getElementById('btn-wx-fog');
    if (btnWxFog) btnWxFog.addEventListener('click', () => this.setWeather('fog'));

    // Sliders
    if (this.sliderIce) {
      this.sliderIce.addEventListener('input', (e) => {
        const ice = parseFloat(e.target.value);
        this.boundaryManager.executePanelTask(PANEL_TYPES.WEATHER, async () => {
          this.app.envEngine.setWeather({ ice });
          this.updateIceDisplay(ice);
        });
      });
    }

    if (this.sliderTemp) {
      this.sliderTemp.addEventListener('input', (e) => {
        const temp = parseInt(e.target.value);
        this.boundaryManager.executePanelTask(PANEL_TYPES.WEATHER, async () => {
          this.app.envEngine.setWeather({ temp });
          this.updateTempDisplay(temp);
          this.updateIceDisplay(this.app.envEngine.weather.winterIce);
          if (this.sliderIce) this.sliderIce.value = this.app.envEngine.weather.winterIce;
        });
      });
    }

    // YouTube 4K & Incremental Ingestion
    const btnProcYt = document.getElementById('btn-process-youtube');
    if (btnProcYt) {
      btnProcYt.addEventListener('click', () => {
        const url = (this.ytInput && this.ytInput.value.trim()) || 'https://www.youtube.com/watch?v=5Qe07gFsTx4';
        this.processYouTubeUrl(url);
      });
    }

    const btnSample1 = document.getElementById('btn-yt-sample1');
    if (btnSample1) {
      btnSample1.addEventListener('click', () => {
        if (this.ytInput) this.ytInput.value = 'https://www.youtube.com/watch?v=5Qe07gFsTx4';
        this.processYouTubeUrl('https://www.youtube.com/watch?v=5Qe07gFsTx4');
      });
    }

    const btnSample2 = document.getElementById('btn-yt-sample2');
    if (btnSample2) {
      btnSample2.addEventListener('click', () => {
        if (this.ytInput) this.ytInput.value = 'https://www.youtube.com/watch?v=5Qe07gFsTx4';
        this.processYouTubeUrl('https://www.youtube.com/watch?v=5Qe07gFsTx4');
      });
    }

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
      window.electronAPI.onSetWeather((params) => this.setWeather(params.preset || 'clear'));
      window.electronAPI.onDesktopModeChanged((isDesktop) => {
        const badge = document.getElementById('mode-badge');
        if (badge) {
          badge.textContent = isDesktop ? 'WALLPAPER' : 'WINDOW';
          badge.className = isDesktop ? 'badge badge-green' : 'badge badge-ice';
        }
      });
    }
  }

  async switchScene(sceneName) {
    document.querySelectorAll('#panel-scenes .btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-scene-${sceneName}`);
    if (btn) btn.classList.add('active');

    return this.boundaryManager.executePanelTask(PANEL_TYPES.SCENES, async () => {
      await this.app.loadScene(sceneName);
      if (this.widgetScene) this.widgetScene.textContent = sceneName.charAt(0).toUpperCase() + sceneName.slice(1);
    });
  }

  async setTime(hours) {
    if (this.sliderTime) this.sliderTime.value = hours;
    return this.boundaryManager.executePanelTask(PANEL_TYPES.TIME, async () => {
      await this.app.envEngine.setTimeOfDay(hours);
      this.updateTimeDisplay(hours);
    });
  }

  async setWeather(preset) {
    document.querySelectorAll('#panel-weather .btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-wx-${preset}`);
    if (btn) btn.classList.add('active');

    return this.boundaryManager.executePanelTask(PANEL_TYPES.WEATHER, async () => {
      await this.app.envEngine.setWeather({ preset });
      if (this.sliderTemp) this.sliderTemp.value = this.app.envEngine.weather.temperature;
      if (this.sliderIce) this.sliderIce.value = this.app.envEngine.weather.winterIce;

      this.updateTempDisplay(this.app.envEngine.weather.temperature);
      this.updateIceDisplay(this.app.envEngine.weather.winterIce);
    });
  }

  updateTimeDisplay(hours) {
    if (!this.timeVal) return;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = m < 10 ? '0' + m : m;
    this.timeVal.textContent = `${displayH}:${displayM} ${ampm}`;
  }

  updateTempDisplay(temp) {
    if (this.tempVal) this.tempVal.textContent = `${temp}°F`;
    if (this.widgetTemp) this.widgetTemp.textContent = `${temp}°F | ${this.app.envEngine.weather.preset.toUpperCase()}`;
  }

  updateIceDisplay(iceFraction) {
    const pct = Math.round(iceFraction * 100);
    if (this.iceVal) this.iceVal.textContent = `${pct}% Frozen`;
    if (this.widgetIce) this.widgetIce.textContent = `Ice: ${pct}%`;
  }

  updateIngestionStats(stats) {
    if (!stats) return;
    if (this.statSplatCount) this.statSplatCount.textContent = stats.totalSplats.toLocaleString();
    if (this.statSourcesCount) this.statSourcesCount.textContent = stats.activeSources;
    if (this.statPose) this.statPose.textContent = stats.lastIngestion ? stats.lastIngestion.perspective : this.selectedPose;
    if (this.statSeason) this.statSeason.textContent = stats.lastIngestion ? stats.lastIngestion.season : this.selectedSeason;
  }

  showToast(title, message, recoveryAction = null, type = 'error') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-header">
        <span class="toast-title">${title}</span>
        <button class="toast-close">&times;</button>
      </div>
      <div class="toast-message">${message}</div>
      ${recoveryAction ? `<div class="toast-recovery"><span>${recoveryAction}</span></div>` : ''}
    `;

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      });
    }

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  }

  showAlertModal(title, message, recoveryAction = null) {
    const overlay = document.getElementById('alert-modal-overlay');
    const titleEl = document.getElementById('alert-modal-title');
    const bodyEl = document.getElementById('alert-modal-body');
    const recoveryEl = document.getElementById('alert-modal-recovery');
    const closeBtn = document.getElementById('alert-modal-close-btn');

    if (!overlay) return;

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;
    if (recoveryEl) {
      if (recoveryAction) {
        recoveryEl.textContent = `Suggested Recovery: ${recoveryAction}`;
        recoveryEl.style.display = 'block';
      } else {
        recoveryEl.style.display = 'none';
      }
    }

    overlay.classList.add('active');

    if (closeBtn) {
      const handleClose = () => {
        overlay.classList.remove('active');
        closeBtn.removeEventListener('click', handleClose);
      };
      closeBtn.addEventListener('click', handleClose);
    }
  }

  handleError(err) {
    const translated = translateError(err);
    this.showToast(translated.title, translated.message, translated.recoveryAction, 'error');
    if (this.ytStatus) {
      this.ytStatus.textContent = `${translated.title}: ${translated.message}`;
    }
    return translated;
  }

  async processYouTubeUrl(url) {
    return this.boundaryManager.executePanelTask(PANEL_TYPES.YOUTUBE, async () => {
      if (this.ytStatus) this.ytStatus.textContent = 'Extracting spatial keyframe images and performing 3D feature stitching...';
      const options = {
        perspective: this.selectedPose,
        season: this.selectedSeason,
        presetTime: this.app.envEngine.timeOfDay
      };

      const result = await this.app.ytPipeline.processUrl(url, options, (msg) => {
        if (this.ytStatus) this.ytStatus.textContent = msg;
      });

      if (this.app.ingestMediaIncremental) {
        this.app.ingestMediaIncremental(result.splatData, {
          mediaTitle: result.title,
          cameraPose: this.selectedPose,
          season: this.selectedSeason
        });
      } else {
        this.app.splatRenderer.loadSplatData(result.splatData);
      }

      if (this.ytStatus) {
        this.ytStatus.textContent = `Successfully extracted & stitched 3D Gaussian Splats from keyframe images! (${result.title})`;
      }

      this.showToast('3D Processing Complete', `Successfully extracted splats from ${result.title}`, 'Model updated with new spatial points.', 'success');

      const customBtn = document.getElementById('btn-scene-custom');
      if (customBtn) {
        customBtn.disabled = false;
        customBtn.textContent = '📹 Custom Fused Model';
        document.querySelectorAll('#panel-scenes .btn').forEach(b => b.classList.remove('active'));
        customBtn.classList.add('active');
      }
    });
  }

  async simulateNetworkFailure(panelType, errorCode, errorMessage) {
    const error = new Error(errorMessage || `Simulated network disruption on ${panelType} panel.`);
    error.code = errorCode || ERROR_CODES.NETWORK_DISRUPTION;

    return this.boundaryManager.executePanelTask(panelType, async () => {
      throw error;
    }).catch(() => {
      // Intentionally caught by localized AsyncBoundary
    });
  }
}

