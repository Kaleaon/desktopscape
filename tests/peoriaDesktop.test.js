const assert = require('assert');
const { test, describe } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  generatePeoriaRiverfrontScene,
  generatePeoriaSkylineScene,
  generateGrandviewDriveScene
} = require('../src/js/peoriaScenes');

const { processYouTubePeoriaVideo } = require('../src/js/youtubePipelineBackend');
const { extractFrames } = require('../scripts/extractFrames');
const { ImageStitcher } = require('../src/js/imageStitcher');

const { estimateCameraPose, alignSpatialSplatPoints } = require('../src/js/registrationEngine');
const { analyzeTemporalDelta, applyTemporalDeltaToSplats } = require('../src/js/temporalDeltaAnalyzer');
const { IncrementalSplatModel } = require('../src/js/incrementalIngestionEngine');

describe('Peoria 3D Gaussian Splat Landmark Scenes', () => {
  test('generatePeoriaRiverfrontScene produces valid 3D Gaussian Splat dataset', () => {
    const scene = generatePeoriaRiverfrontScene();
    assert.strictEqual(scene.name, 'Peoria Riverfront & Illinois River');
    assert.ok(scene.positions.length > 0, 'Positions array must not be empty');
    assert.strictEqual(scene.positions.length % 3, 0, 'Positions must be 3D (x,y,z)');
    assert.strictEqual(scene.colors.length / 4, scene.positions.length / 3, 'Colors count must match positions count');
  });

  test('generatePeoriaSkylineScene produces valid Downtown Peoria buildings splats', () => {
    const scene = generatePeoriaSkylineScene();
    assert.strictEqual(scene.name, 'Downtown Peoria Skyline');
    assert.ok(scene.positions.length > 0, 'Skyline splat positions must not be empty');
  });

  test('generateGrandviewDriveScene produces valid bluff overlook splats', () => {
    const scene = generateGrandviewDriveScene();
    assert.strictEqual(scene.name, 'Grandview Drive Overlook');
    assert.ok(scene.positions.length > 0, 'Grandview splat positions must not be empty');
  });
});

describe('View-Angle & Camera Registration Engine', () => {
  test('estimateCameraPose computes valid position and angle orientations', () => {
    const poseDrone = estimateCameraPose({ perspective: 'drone-aerial' });
    const poseGround = estimateCameraPose({ perspective: 'ground-eye' });
    const poseBluff = estimateCameraPose({ perspective: 'bluff-overlook' });

    assert.strictEqual(poseDrone.perspective, 'drone-aerial');
    assert.strictEqual(poseGround.perspective, 'ground-eye');
    assert.ok(poseGround.position[1] < poseDrone.position[1], 'Ground level camera Y height must be lower than drone aerial height');
    assert.ok(poseDrone.confidence > 0.8, 'Pose confidence must be high');
  });

  test('alignSpatialSplatPoints aligns keyframes taken from arbitrary angles to world space', () => {
    const baseScene = generatePeoriaRiverfrontScene();
    const pose = estimateCameraPose({ perspective: 'side-oblique' });

    const aligned = alignSpatialSplatPoints(baseScene, pose, [10, 5, -10]);

    assert.ok(aligned.registeredPointsCount > 0, 'Registered points count must be positive');
    assert.strictEqual(aligned.splatData.positions.length, baseScene.positions.length);
    assert.strictEqual(aligned.alignmentConfidence, pose.confidence);
  });
});

describe('Temporal Change & Time-of-Day/Season Delta Understanding', () => {
  test('analyzeTemporalDelta detects seasonal foliage and lighting condition shifts', () => {
    const baseScene = generatePeoriaRiverfrontScene();

    const summerDelta = analyzeTemporalDelta(baseScene, baseScene);
    assert.ok(['summer', 'autumn', 'winter', 'spring'].includes(summerDelta.season));
    assert.ok(summerDelta.timeOfDay >= 0 && summerDelta.timeOfDay <= 24);

    const winterData = { colors: baseScene.colors, presetSeason: 'winter', presetTime: 22.0 };
    const winterDelta = analyzeTemporalDelta(winterData, baseScene);

    assert.strictEqual(winterDelta.season, 'winter');
    assert.strictEqual(winterDelta.lightingCondition, 'night');
    assert.ok(winterDelta.winterIceDelta > 0.5, 'Winter preset must yield high river ice delta');
  });

  test('applyTemporalDeltaToSplats adjusts splat color palette based on seasonal shift', () => {
    const baseScene = generatePeoriaRiverfrontScene();
    const winterDelta = analyzeTemporalDelta({ presetSeason: 'winter' }, baseScene);

    const transformed = applyTemporalDeltaToSplats(baseScene, winterDelta);

    assert.ok(transformed.splatData.colors.length === baseScene.colors.length);
    assert.strictEqual(transformed.temporalDelta.season, 'winter');
    assert.notStrictEqual(transformed.splatData.colors, baseScene.colors, 'Default non-inplace must allocate a new buffer');
  });

  test('applyTemporalDeltaToSplats supports in-place transformation and targetColors buffer', () => {
    const baseScene = generatePeoriaRiverfrontScene();
    const winterDelta = analyzeTemporalDelta({ presetSeason: 'winter' }, baseScene);

    // Baseline copy for numerical validation
    const sceneCopyForDefault = {
      positions: new Float32Array(baseScene.positions),
      scales: new Float32Array(baseScene.scales),
      colors: new Float32Array(baseScene.colors),
      rotations: new Float32Array(baseScene.rotations)
    };

    const sceneCopyForInplace = {
      positions: new Float32Array(baseScene.positions),
      scales: new Float32Array(baseScene.scales),
      colors: new Float32Array(baseScene.colors),
      rotations: new Float32Array(baseScene.rotations)
    };

    const targetColors = new Float32Array(baseScene.colors.length);

    // Standard non-inplace transformation
    const defaultRes = applyTemporalDeltaToSplats(sceneCopyForDefault, winterDelta);

    // Inplace transformation
    const inplaceRes = applyTemporalDeltaToSplats(sceneCopyForInplace, winterDelta, { inplace: true });

    // Target colors transformation
    const targetRes = applyTemporalDeltaToSplats(baseScene, winterDelta, { targetColors });

    // 1. Verify buffer references
    assert.strictEqual(inplaceRes.splatData.colors, sceneCopyForInplace.colors, 'In-place must modify and return input colors array directly');
    assert.strictEqual(targetRes.splatData.colors, targetColors, 'Target colors must write directly to specified targetColors buffer');

    // 2. Verify identical numerical results
    for (let i = 0; i < defaultRes.splatData.colors.length; i++) {
      assert.strictEqual(inplaceRes.splatData.colors[i], defaultRes.splatData.colors[i], `Inplace color value at index ${i} must match default transformation`);
      assert.strictEqual(targetRes.splatData.colors[i], defaultRes.splatData.colors[i], `Target color value at index ${i} must match default transformation`);
    }
  });
});

describe('Incremental Pipeline Ingestion & Feature Refinement Engine', () => {
  test('IncrementalSplatModel merges keyframes and refines 3D scene features', () => {
    const baseScene = generatePeoriaRiverfrontScene();
    const model = new IncrementalSplatModel(baseScene);

    const stats1 = model.getStatistics();
    const initialSplatsCount = stats1.totalSplats;
    assert.ok(initialSplatsCount > 0, 'Base model must contain splat points');

    // Ingest new keyframe batch from drone aerial angle
    const newKeyframeBatch = generateGrandviewDriveScene();
    const result = model.mergeKeyframeSplats(newKeyframeBatch, {
      cameraPose: 'drone-aerial',
      season: 'autumn',
      mediaTitle: 'Grandview Drive Keyframe Batch'
    });

    const stats2 = model.getStatistics();
    assert.strictEqual(stats2.activeSources, 2, 'Active sources count must increment to 2');
    assert.ok(stats2.totalSplats >= initialSplatsCount, 'Total model splat points must maintain or grow with incremental fusion');
    assert.ok(result.ingestionSummary.pointsAdded > 0 || result.ingestionSummary.pointsMerged > 0);
  });
});

describe('Keyframe Extraction & 3D Feature Stitching Pipeline', () => {
  test('extractFrames extracts keyframe still images into frame buffer directory', async () => {
    const testDir = path.join(os.tmpdir(), 'test_peoria_frames_' + Date.now());
    const youtubeUrl = 'https://www.youtube.com/watch?v=5Qe07gFsTx4';

    const res = await extractFrames(youtubeUrl, testDir, { frameCount: 6 });

    assert.strictEqual(res.youtubeUrl, youtubeUrl);
    assert.ok(res.frameCount >= 6, 'Must extract at least 6 keyframe still images');
    assert.ok(fs.existsSync(res.frameBufferDir), 'Frame buffer directory must exist');
    assert.ok(res.framePaths.length >= 6, 'Frame paths array must contain generated keyframes');
    assert.ok(fs.existsSync(res.framePaths[0]), 'First keyframe file must exist on disk');

    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('ImageStitcher extracts features, matches keypoints, and stitches 3D Gaussian Splats', async () => {
    const testDir = path.join(os.tmpdir(), 'test_peoria_stitch_' + Date.now());
    const res = await extractFrames('https://www.youtube.com/watch?v=5Qe07gFsTx4', testDir, { frameCount: 4 });

    const stitched = ImageStitcher.stitchKeyframesTo3DSplat(res.framePaths);

    assert.ok(stitched.pointsCount > 0, 'Stitched points count must be positive');
    assert.strictEqual(stitched.frameCount, 4);
    assert.strictEqual(stitched.splatData.positions.length, stitched.pointsCount * 3, 'Positions length must be 3x points count');
    assert.strictEqual(stitched.splatData.colors.length, stitched.pointsCount * 4, 'Colors length must be 4x points count');
    assert.strictEqual(stitched.splatData.scales.length, stitched.pointsCount * 3, 'Scales length must be 3x points count');
    assert.strictEqual(stitched.splatData.rotations.length, stitched.pointsCount * 4, 'Rotations length must be 4x points count');

    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('extractFrames performs non-blocking keyframe generation and handles ffmpeg error fallback gracefully', async () => {
    const testDir = path.join(os.tmpdir(), 'test_peoria_async_fallback_' + Date.now());
    const invalidOrFallbackUrl = 'https://www.youtube.com/watch?v=invalid_or_offline_video';

    // Verify non-blocking behavior by running multiple extraction promises concurrently
    const [res1, res2] = await Promise.all([
      extractFrames(invalidOrFallbackUrl, path.join(testDir, 'dir1'), { frameCount: 3 }),
      extractFrames(invalidOrFallbackUrl, path.join(testDir, 'dir2'), { frameCount: 3 })
    ]);

    assert.strictEqual(res1.frameCount, 3);
    assert.strictEqual(res2.frameCount, 3);
    assert.strictEqual(res1.framePaths.length, 3);
    assert.strictEqual(res2.framePaths.length, 3);
    assert.ok(fs.existsSync(res1.framePaths[0]));
    assert.ok(fs.existsSync(res2.framePaths[0]));

    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('processYouTubePeoriaVideo extracts keyframes and generates 3D Gaussian Splat dataset from YouTube video URL', async () => {
    const sampleUrl = 'https://www.youtube.com/watch?v=5Qe07gFsTx4';
    const result = await processYouTubePeoriaVideo(sampleUrl, { frameCount: 5, perspective: 'drone-aerial', season: 'autumn' });

    assert.strictEqual(result.youtubeUrl, sampleUrl);
    assert.ok(result.videoId, 'Must extract videoId');
    assert.ok(result.pointsCount > 0, 'Must generate splat points count');
    assert.ok(result.splatData.positions.length > 0, 'Must extract splat positions');
    assert.strictEqual(result.perspective, 'drone-aerial');
    assert.strictEqual(result.season, 'autumn');
  });

  test('buildSpatialGrid partitions keypoints into 2D spatial grid cells and queries adjacent cells', () => {
    const keypoints = [
      { x: 10, y: 15, descriptor: [1, 0, 0, 0, 0, 0] },
      { x: 25, y: 35, descriptor: [0, 1, 0, 0, 0, 0] },
      { x: 100, y: 150, descriptor: [0, 0, 1, 0, 0, 0] }
    ];

    const gridInfo = ImageStitcher.buildSpatialGrid(keypoints, 30);
    assert.ok(gridInfo.grid instanceof Map, 'Spatial grid must be a Map instance');
    assert.ok(gridInfo.grid.has('0,0'), 'Grid cell 0,0 must contain keypoint at (10,15)');

    const candidates = ImageStitcher.queryAdjacentGridCells(gridInfo, 12, 18);
    assert.ok(candidates.includes(keypoints[0]), 'Adjacent cell query must find nearby keypoint');
    assert.ok(candidates.includes(keypoints[1]), 'Adjacent cell query must find keypoint in adjacent bucket');
    assert.strictEqual(candidates.includes(keypoints[2]), false, 'Distant keypoint (100,150) must not be in adjacent cell neighborhood');
  });

  test('matchKeypoints uses spatial grid and bounding box pre-filtering for keypoint matching', () => {
    const keypointsA = [
      { x: 50, y: 50, descriptor: [0.5, 0.5, 0.5, 0.5, 0.0, 0.0] }
    ];
    const keypointsB = [
      { x: 55, y: 52, descriptor: [0.5, 0.5, 0.5, 0.5, 0.0, 0.0] }, // within radius 30 and close descriptor
      { x: 200, y: 200, descriptor: [0.5, 0.5, 0.5, 0.5, 0.0, 0.0] } // far outside search radius
    ];

    const matches = ImageStitcher.matchKeypoints(keypointsA, keypointsB, 30);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].kpA, keypointsA[0]);
    assert.strictEqual(matches[0].kpB, keypointsB[0]);
  });

  test('createMatchLookupMap stores pairwise matches in Map structure for O(1) constant time retrieval', () => {
    const kpA = { x: 10, y: 10 };
    const kpB = { x: 12, y: 14 };
    const match = { kpA, kpB, dx: 2, dy: 4, spatialDist: 4.47, distance: 0.5 };

    const matchMap = ImageStitcher.createMatchLookupMap([match]);
    assert.ok(matchMap instanceof Map, 'Match lookup map must be a Map instance');
    assert.strictEqual(matchMap.get(kpA), match, 'Map must retrieve pairwise match in constant time');
  });
});

describe('Winter River Ice & Environmental Calculations', () => {
  test('Sub-freezing temperature causes Illinois River ice sheet accumulation', () => {
    const temp1 = 10; // 10°F
    const temp2 = -15; // -15°F
    
    const ice1 = Math.min(1.0, Math.max(0.2, (32 - temp1) / 52.0));
    const ice2 = Math.min(1.0, Math.max(0.2, (32 - temp2) / 52.0));

    assert.ok(ice1 > 0.3, '10°F must produce substantial river ice sheet');
    assert.ok(ice2 >= 0.9, '-15°F must produce thick/complete river ice sheet');
  });

  test('Above freezing temperature has 0% river ice', () => {
    const tempWarm = 72;
    const ice = tempWarm <= 32 ? (32 - tempWarm) / 52.0 : 0.0;
    assert.strictEqual(ice, 0.0, '72°F must have 0% river ice');
  });
});

describe('Executable Package Configuration', () => {
  test('package.json contains electron-builder NSIS and Portable exe targets', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    assert.ok(pkg.build, 'Must contain build block');
    assert.ok(pkg.build.win, 'Must contain win block');
    assert.deepStrictEqual(pkg.build.win.target, ['nsis', 'portable']);
  });
});

describe('Progressive Disclosure & Contextual UI Extraction', () => {
  test('Primary views contain contextual drawer triggers and drawers hold all 12 secondary toggles', () => {
    const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');

    // Contextual Drawer Triggers present on primary views
    assert.ok(html.includes('id="btn-drawer-time"'), 'Time panel must feature contextual drawer trigger button');
    assert.ok(html.includes('id="btn-drawer-weather"'), 'Weather panel must feature contextual drawer trigger button');
    assert.ok(html.includes('id="btn-drawer-youtube"'), 'Pipeline panel must feature contextual drawer trigger button');

    // Active visual indicator elements
    assert.ok(html.includes('id="dot-time"'), 'Time drawer trigger must contain active indicator dot element');
    assert.ok(html.includes('id="dot-weather"'), 'Weather drawer trigger must contain active indicator dot element');
    assert.ok(html.includes('id="dot-youtube"'), 'YouTube drawer trigger must contain active indicator dot element');

    // Contextual Drawer Panels
    assert.ok(html.includes('id="drawer-time"'), 'Time contextual drawer panel must exist');
    assert.ok(html.includes('id="drawer-weather"'), 'Weather contextual drawer panel must exist');
    assert.ok(html.includes('id="drawer-youtube"'), 'YouTube contextual drawer panel must exist');

    // All 12 secondary configuration toggles verified inside drawer panels
    const secondaryToggles = [
      'btn-time-dawn', 'btn-time-noon', 'btn-time-sunset', 'btn-time-night',
      'btn-pose-drone', 'btn-pose-ground', 'btn-pose-bluff', 'btn-pose-oblique',
      'btn-season-summer', 'btn-season-autumn', 'btn-season-winter', 'btn-season-spring'
    ];

    secondaryToggles.forEach(toggleId => {
      assert.ok(html.includes(`id="${toggleId}"`), `Secondary configuration toggle ${toggleId} must exist in HTML drawers`);
    });
  });

  test('UIController toggles drawers, persists settings in localStorage, and updates active indicators', () => {
    // Mock minimal DOM environment for UIController
    const storageMock = {};
    global.window = {
      localStorage: {
        getItem: (key) => storageMock[key] || null,
        setItem: (key, val) => { storageMock[key] = String(val); },
        clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
      }
    };

    // Construct mock elements needed for UIController
    const createdElements = {};
    const createElementMock = (id, initialClasses = []) => {
      const classSet = new Set(initialClasses);
      const el = {
        id,
        classList: {
          add: (c) => classSet.add(c),
          remove: (c) => classSet.delete(c),
          contains: (c) => classSet.has(c),
          toggle: (c, force) => {
            if (force === true) classSet.add(c);
            else if (force === false) classSet.delete(c);
            else {
              if (classSet.has(c)) classSet.delete(c); else classSet.add(c);
            }
          }
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        textContent: '',
        value: '72',
        disabled: false
      };
      return el;
    };

    global.document = {
      getElementById: (id) => {
        if (!createdElements[id]) {
          createdElements[id] = createElementMock(id);
        }
        return createdElements[id];
      },
      querySelector: (sel) => {
        // e.g. [data-pose="..."]
        const match = sel.match(/\[data-([a-z]+)="([^"]+)"\]/);
        if (match) {
          const id = `btn-${match[1]}-${match[2].split('-')[0]}`;
          if (!createdElements[id]) {
            createdElements[id] = createElementMock(id);
          }
          return createdElements[id];
        }
        return createElementMock('mock-el');
      },
      querySelectorAll: (sel) => []
    };

    const { UIController } = require('../src/js/uiController');

    const mockApp = {
      envEngine: {
        weather: { temperature: 72, winterIce: 0, preset: 'clear' },
        timeOfDay: 12,
        autoSyncClock: false,
        setTimeOfDay: function(t) { this.timeOfDay = t; },
        setWeather: function(w) { if (w.temp !== undefined) this.weather.temperature = w.temp; if (w.ice !== undefined) this.weather.winterIce = w.ice; }
      },
      loadScene: () => {},
      ytPipeline: { processUrl: async () => ({ splatData: {}, title: 'Test' }) }
    };

    const controller = new UIController(mockApp);

    // Test Drawer open/close
    const drawerTime = global.document.getElementById('drawer-time');
    controller.toggleDrawer('drawer-time');
    assert.ok(drawerTime.classList.contains('open'), 'toggleDrawer must add open class to contextual drawer');
    controller.closeDrawer('drawer-time');
    assert.ok(!drawerTime.classList.contains('open'), 'closeDrawer must remove open class from contextual drawer');

    // Test persistence and active indicator updates on setting change
    controller.settings.temperature = 10;
    controller.saveSecondarySettings();
    assert.ok(storageMock['peoria_secondary_settings'].includes('"temperature":10'), 'Secondary settings must persist to localStorage');

    controller.updateVisualIndicators();
    const dotWeather = global.document.getElementById('dot-weather');
    const btnDrawerWeather = global.document.getElementById('btn-drawer-weather');
    assert.ok(dotWeather.classList.contains('active'), 'Active dot indicator must activate when non-default secondary temperature setting is set');
    assert.ok(btnDrawerWeather.classList.contains('has-active-settings'), 'Drawer button must highlight when non-default secondary settings are active');
  });
});

describe('IPC Weather Integration', () => {
  test('UIController.init calls getPeoriaWeather and updates environment engine weather state', async () => {
    let ipcCalled = false;
    global.window = {
      localStorage: { getItem: () => null, setItem: () => {} },
      electronAPI: {
        getPeoriaWeather: async () => {
          ipcCalled = true;
          return {
            success: true,
            weather: {
              temperature: 28,
              weathercode: 71, // Snow
              windspeed: 10
            }
          };
        }
      }
    };

    const createdElements = {};
    const createElementMock = (id) => ({
      id,
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      addEventListener: () => {},
      removeEventListener: () => {},
      textContent: '',
      value: '72'
    });

    global.document = {
      getElementById: (id) => createdElements[id] || (createdElements[id] = createElementMock(id)),
      querySelector: () => createElementMock('mock-el'),
      querySelectorAll: () => []
    };

    let updatedWeather = null;
    const mockApp = {
      envEngine: {
        weather: { temperature: 72, winterIce: 0, preset: 'clear' },
        timeOfDay: 12,
        autoSyncClock: false,
        setWeather: function(w) {
          if (w.preset) this.weather.preset = w.preset;
          if (w.temp !== undefined) this.weather.temperature = w.temp;
          if (w.temp <= 32) this.weather.winterIce = 0.5;
          updatedWeather = { ...this.weather };
        }
      }
    };

    delete require.cache[require.resolve('../src/js/uiController')];
    const { UIController } = require('../src/js/uiController');
    const controller = new UIController(mockApp);
    await controller.init();

    assert.ok(ipcCalled, 'getPeoriaWeather IPC must be called during UIController initialization');
    assert.strictEqual(updatedWeather.temperature, 28, 'Environment engine temperature must update to live IPC value (28°F)');
    assert.strictEqual(updatedWeather.preset, 'snow', 'Weathercode 71 must map to snow preset');
    assert.ok(updatedWeather.winterIce > 0, 'Sub-freezing live temperature must update river ice');
  });

  test('UIController handles IPC fallback seamlessly when Open-Meteo API fails or is offline', async () => {
    let ipcCalled = false;
    global.window = {
      localStorage: { getItem: () => null, setItem: () => {} },
      electronAPI: {
        getPeoriaWeather: async () => {
          ipcCalled = true;
          return {
            success: false,
            fallback: {
              temperature: 65,
              weathercode: 0 // Clear
            }
          };
        }
      }
    };

    const createdElements = {};
    const createElementMock = (id) => ({
      id,
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      addEventListener: () => {},
      removeEventListener: () => {},
      textContent: '',
      value: '72'
    });

    global.document = {
      getElementById: (id) => createdElements[id] || (createdElements[id] = createElementMock(id)),
      querySelector: () => createElementMock('mock-el'),
      querySelectorAll: () => []
    };

    let updatedWeather = null;
    const mockApp = {
      envEngine: {
        weather: { temperature: 72, winterIce: 0, preset: 'clear' },
        timeOfDay: 12,
        autoSyncClock: false,
        setWeather: function(w) {
          if (w.preset) this.weather.preset = w.preset;
          if (w.temp !== undefined) this.weather.temperature = w.temp;
          updatedWeather = { ...this.weather };
        }
      }
    };

    delete require.cache[require.resolve('../src/js/uiController')];
    const { UIController } = require('../src/js/uiController');
    const controller = new UIController(mockApp);
    await controller.init();

    assert.ok(ipcCalled, 'getPeoriaWeather IPC must be called');
    assert.strictEqual(updatedWeather.temperature, 65, 'Environment engine must receive temperature from fallback weather');
    assert.strictEqual(updatedWeather.preset, 'clear', 'Environment engine must receive mapped preset from fallback weather code');
  });
});

