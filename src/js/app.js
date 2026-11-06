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

    // Load Default Base Scene (Peoria Riverfront & Illinois River)
    this.loadScene('riverfront');

    // Start Render Loop
    this.lastTime = performance.now();
    this.animate();
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  setCustomSplatData(data) {
    this.customSplatData = data;
  }

  async loadScene(sceneKey) {
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
    const delta = (now - this.lastTime) / 1000.0;
    this.lastTime = now;

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
