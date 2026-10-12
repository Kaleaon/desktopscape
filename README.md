# Peoria 4K Gaussian Splat Desktop Engine (`desktopscape`)

[![Peoria 3D Gaussian Splats](https://img.shields.io/badge/Peoria-3D%20Gaussian%20Splats-brightgreen)](#)
[![Electron](https://img.shields.io/badge/Electron-v33.0.0-blue)](#)
[![Three.js](https://img.shields.io/badge/Three.js-v0.170.0-orange)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

An interactive, photorealistic **3D Gaussian Splatting Desktopscape Engine** depicting Peoria, Illinois landmarks, including the Peoria Riverfront, Murray Baker Bridge (I-74), Downtown Peoria Skyline, and Grandview Drive Overlook.

Built with WebGL, Three.js, and Electron, this engine features dynamic solar positioning, weather particle simulations (rain, snow, fog), Peoria Illinois River winter ice freeze dynamics, YouTube 4K video ingestion to 3D Gaussian Splats, and live desktop wallpaper mode with system tray integration.

---

## Key Features

### 1. Peoria 3D Gaussian Splat Landmark Scenes
- **Peoria Riverfront & Illinois River**: High-density 3D splats representing the Peoria Riverfront Museum complex, public docks, promenade, and the Murray Baker Bridge truss across the Illinois River.
- **Downtown Peoria Skyline**: High-rise buildings including Caterpillar World HQ, Twin Towers, Peoria Civic Center, and Commerce Bank Building with night lighting windows.
- **Grandview Drive Overlook**: Bluff foliage, scenic parkway grass, and elevated overlooks over Peoria Lake.

### 2. Environmental Physics & Winter River Ice Simulation
- **Dynamic Solar Cycle**: Real-time solar azimuth and elevation calculation from 0 to 24 hours (Dawn, Midday, Sunset/Golden Hour, Night City Lights).
- **Weather System**: Particle overlays for Peoria rainstorms, heavy snowfall, and river basin fog/haze.
- **Illinois River Ice Freeze**: Sub-freezing temperature calculations (32°F down to -20°F) dynamically render ice floes and thick winter ice sheet coverage over the river with custom WebGL shaders.

### 3. YouTube 4K Peoria Video Ingestion Pipeline
- Process 4K YouTube videos (drone footage, aerial views of Murray Baker Bridge, city walkthroughs).
- Extracts spatial keyframes and synthesizes customized 3D Gaussian Splats in real time.

### 4. Live Desktop Wallpaper & Tray Controls
- Toggle between interactive **Windowed Mode** and **Live Desktop Wallpaper Mode** (frameless, skip-taskbar, background layer).
- System tray context menu allowing scene switching, solar quick presets, weather toggles, and local clock auto-sync.

---

## Project Architecture

```
desktopscape/
├── assets/                  # Icons and app branding
│   └── icon.png
├── electron/                # Main process & desktop integration
│   ├── main.js              # BrowserWindow, system tray, IPC handlers
│   └── preload.js           # ContextBridge API exposing IPC methods
├── src/                     # WebGL renderer & frontend UI
│   ├── index.html           # Desktopscape UI overlay and canvas
│   ├── styles.css           # Modern dark theme styles & widgets
│   └── js/
│       ├── app.js                   # Application coordinator & animation loop
│       ├── splatRenderer.js         # WebGL 3D Gaussian Splats & water shaders
│       ├── environmentEngine.js     # Solar time, weather, & river ice logic
│       ├── peoriaScenes.js          # Procedural 3D Gaussian Splat landmark datasets
│       ├── youtubePipeline.js       # Client-side video ingestion bridge
│       ├── youtubePipelineBackend.js# Keyframe feature extraction & point cloud generation
│       └── uiController.js          # Dashboard UI bindings & IPC event listeners
├── scripts/                 # Build & validation scripts
│   ├── build.js             # Asset generation & executable builder validator
│   ├── generateAssets.js    # Programmatic icon generator
│   ├── packageExe.js        # Windows .exe packaging validator
│   └── renderTestScreenshots.js # Renderer for high-res screenshots
└── tests/                   # Node test suite
    └── peoriaDesktop.test.js# Automated tests for scenes, ice math, & pipeline
```

---

## Quick Start & Usage

### 1. Installation
```bash
npm install
```

### 2. Run in Development
Launch the Electron desktop app:
```bash
npm start
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build & Package
Validate and prepare Windows executable packaging (`.exe` via `electron-builder` NSIS & Portable targets):
```bash
npm run build
```

### 5. Render Test Screenshots
Generate high-resolution preview screenshots (`/tmp/peoria_splat_desktop.png`, etc.):
```bash
npm run render-test
```

---

## License

MIT License. See `LICENSE` for details.
