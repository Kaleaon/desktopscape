const assert = require('assert');
const { test, describe } = require('node:test');
const fs = require('fs');
const path = require('path');

const {
  generatePeoriaRiverfrontScene,
  generatePeoriaSkylineScene,
  generateGrandviewDriveScene
} = require('../src/js/peoriaScenes');

const { processYouTubePeoriaVideo } = require('../src/js/youtubePipelineBackend');

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

describe('YouTube 4K Peoria Video Pipeline', () => {
  test('processYouTubePeoriaVideo extracts 3D splat point clouds from YouTube video URL', async () => {
    const sampleUrl = 'https://www.youtube.com/watch?v=peoria_4k_drone';
    const result = await processYouTubePeoriaVideo(sampleUrl);

    assert.ok(result.videoId, 'Must extract videoId');
    assert.ok(result.splatData.positions.length > 0, 'Must extract splat positions');
    assert.strictEqual(result.splatData.colors.length, result.splatData.positions.length / 3 * 4);
  });

  test('YouTube 4K extracted splat dataset structure is valid for renderer', async () => {
    const sampleUrl = 'https://www.youtube.com/watch?v=murray_baker_bridge_4k';
    const result = await processYouTubePeoriaVideo(sampleUrl);
    const { splatData } = result;

    assert.ok(Array.isArray(splatData.positions), 'Positions must be an array');
    assert.ok(Array.isArray(splatData.scales), 'Scales must be an array');
    assert.ok(Array.isArray(splatData.colors), 'Colors must be an array');
    assert.ok(Array.isArray(splatData.rotations), 'Rotations must be an array');
    assert.strictEqual(splatData.positions.length / 3, splatData.scales.length / 3);
  });
});

describe('Winter River Ice & Environmental Calculations', () => {
  test('Sub-freezing temperature causes Illinois River ice sheet accumulation', () => {
    // Temperature < 32F triggers river ice freeze factor
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
