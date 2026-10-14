import { GaussianSplatRenderer } from './splatRenderer.js';
import { EnvironmentEngine } from './environmentEngine.js';
import { YouTubePipelineClient } from './youtubePipeline.js';
import { UIController } from './uiController.js';
import { IncrementalSplatModel } from './incrementalIngestionEngine.js';
import {
  generatePeoriaRiverfrontScene,
  generatePeoriaSkylineScene,
  generateGrandviewDriveScene
} from './peoriaScenes.js';

class PeoriaDesktopscapeApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    this.cameraMode = 'orbit'; // 'orbit' or 'tour'
    this.customSplatData = null;

    // 1. Core 3D Gaussian Splat Engine
    this.splatRenderer = new GaussianSplatRenderer(this.container);

    // 2. Weather & Environmental Solar System
    this.envEngine = new EnvironmentEngine(this.splatRenderer, this.container);

    // 3. YouTube 4K Video Splat Pipeline
    this.ytPipeline = new YouTubePipelineClient(this);

    // 4. Incremental Scene Model & Fusion State
    this.incrementalModel = new IncrementalSplatModel();

    // 5. UI Controls Overlay
    this.uiController = new UIController(this);

    // 6. Adaptive Render Governor State
    this.isVisible = true;
    this.targetFps = 60;
    this.lowFps = 1;
    this.lastRenderTime = performance.now();
    this.lastTime = performance.now();

    this.initVisibilityListeners();

    // Load Default Base Scene (Peoria Riverfront & Illinois River)
    this.loadScene('riverfront');

    // Start Render Loop
    this.animate();
  }

  initVisibilityListeners() {
    // Document Page Visibility API Listener
    if (typeof document !== 'undefined' && 'hidden' in document) {
      document.addEventListener('visibilitychange', () => {
        this.setVisibility(!document.hidden);
      });
    }

    // Electron Context Bridge IPC Listener
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.onWindowVisibilityChanged) {
      window.electronAPI.onWindowVisibilityChanged((visible) => {
        this.setVisibility(visible);
      });
    }
  }

  setVisibility(visible) {
    const isVis = Boolean(visible);
    if (this.isVisible === isVis) return;

    this.isVisible = isVis;

    if (this.isVisible) {
      // Transitioning to visible: reset time tracking and resume delta to prevent frame jumps upon resumption
      const now = performance.now();
      this.lastTime = now;
      this.lastRenderTime = now;
      if (this.envEngine) {
        this.envEngine.resumeDelta();
      }
      // Instantly resume full 60 FPS rendering within 50ms
      this.renderFrame(now);
    } else {
      // Transitioning to hidden/minimized: pause env engine delta
      if (this.envEngine) {
        this.envEngine.pauseDelta();
      }
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  setCustomSplatData(data) {
    this.customSplatData = data;
  }

  loadScene(sceneKey) {
    let sceneData;
    switch (sceneKey) {
      case 'skyline':
        sceneData = generatePeoriaSkylineScene();
        break;
      case 'grandview':
        sceneData = generateGrandviewDriveScene();
        break;
      case 'custom':
        if (this.customSplatData) {
          sceneData = this.customSplatData;
        } else {
          sceneData = generatePeoriaRiverfrontScene();
        }
        break;
      case 'riverfront':
      default:
        sceneData = generatePeoriaRiverfrontScene();
        break;
    }

    this.incrementalModel.initFromBaseScene(sceneData);
    const fusedData = this.incrementalModel.getSplatData();

    this.splatRenderer.loadSplatData(fusedData);
    this.envEngine.updateLighting();

    if (this.uiController && this.uiController.updateIngestionStats) {
      this.uiController.updateIngestionStats(this.incrementalModel.getStatistics());
    }
  }

  ingestMediaIncremental(splatData, options = {}) {
    const result = this.incrementalModel.mergeKeyframeSplats(splatData, options);
    const updatedModelData = this.incrementalModel.getSplatData();

    this.splatRenderer.loadSplatData(updatedModelData);
    this.envEngine.updateLighting();

    if (this.uiController && this.uiController.updateIngestionStats) {
      this.uiController.updateIngestionStats(this.incrementalModel.getStatistics());
    }

    return result;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const targetInterval = this.isVisible ? (1000 / this.targetFps) : (1000 / this.lowFps); // 1 FPS when hidden
    const elapsedSinceLastRender = now - this.lastRenderTime;

    if (elapsedSinceLastRender >= targetInterval - 1) {
      this.renderFrame(now);
    }
  }

  renderFrame(now = performance.now()) {
    const rawDelta = (now - this.lastTime) / 1000.0;
    this.lastTime = now;
    this.lastRenderTime = now;

    // Cap delta during suspended/low-FPS state to prevent frame jumps upon resumption
    const delta = this.isVisible ? Math.min(rawDelta, 0.1) : 0.016;

    if (this.cameraMode === 'tour') {
      // Smooth camera path along Illinois River riverfront
      const t = (now * 0.0002) % (Math.PI * 2);
      this.splatRenderer.camera.position.x = Math.sin(t) * 110;
      this.splatRenderer.camera.position.y = 20 + Math.sin(t * 2) * 5;
      this.splatRenderer.camera.position.z = Math.cos(t) * 80 + 30;
      this.splatRenderer.camera.lookAt(Math.sin(t + 0.3) * 60, 10, Math.cos(t + 0.3) * 30);
    } else {
      // Slowly rotate camera around Peoria scene in Orbit mode
      const camRadius = 140;
      const camAngle = now * 0.0001;
      this.splatRenderer.camera.position.x = Math.sin(camAngle) * camRadius;
      this.splatRenderer.camera.position.y = 45;
      this.splatRenderer.camera.position.z = Math.cos(camAngle) * camRadius;
      this.splatRenderer.camera.lookAt(0, 10, 0);
    }

    // Update Environmental Particles & Weather
    this.envEngine.update(delta);

    // Render 3D Gaussian Splats
    this.splatRenderer.render(delta);
  }
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.peoriaApp = new PeoriaDesktopscapeApp();
});
