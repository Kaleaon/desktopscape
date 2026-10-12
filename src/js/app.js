import { GaussianSplatRenderer } from './splatRenderer.js';
import { EnvironmentEngine } from './environmentEngine.js';
import { YouTubePipelineClient } from './youtubePipeline.js';
import { UIController } from './uiController.js';
import {
  generatePeoriaRiverfrontScene,
  generatePeoriaSkylineScene,
  generateGrandviewDriveScene
} from './peoriaScenes.js';

class PeoriaDesktopscapeApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Core 3D Gaussian Splat Engine
    this.splatRenderer = new GaussianSplatRenderer(this.container);

    // 2. Weather & Environmental Solar System
    this.envEngine = new EnvironmentEngine(this.splatRenderer, this.container);

    // 3. YouTube 4K Video Splat Pipeline
    this.ytPipeline = new YouTubePipelineClient(this);

    // 4. UI Controls Overlay
    this.uiController = new UIController(this);

    // Load Default Scene (Peoria Riverfront & Illinois River)
    this.loadScene('riverfront');

    // Start Render Loop
    this.lastTime = performance.now();
    this.animate();
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
      case 'riverfront':
      default:
        sceneData = generatePeoriaRiverfrontScene();
        break;
    }

    this.splatRenderer.loadSplatData(sceneData);
    this.envEngine.updateLighting();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = (now - this.lastTime) / 1000.0;
    this.lastTime = now;

    // Slowly rotate camera around Peoria scene in Orbit mode
    const camRadius = 140;
    const camAngle = now * 0.0001;
    this.splatRenderer.camera.position.x = Math.sin(camAngle) * camRadius;
    this.splatRenderer.camera.position.z = Math.cos(camAngle) * camRadius;
    this.splatRenderer.camera.lookAt(0, 10, 0);

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
