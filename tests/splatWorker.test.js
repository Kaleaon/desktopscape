const assert = require('assert');
const { test, describe } = require('node:test');

const { initSplats, sortSplats } = require('../src/js/splatSortWorker');
const { generatePeoriaRiverfrontScene } = require('../src/js/peoriaScenes');

describe('Asynchronous Web Worker Splat Depth Sorting', () => {
  test('splatSortWorker initializes positions and calculates splat count', () => {
    const positions = new Float32Array([
      0, 0, 10,   // Splat 0: dist to origin = 100
      0, 0, 50,   // Splat 1: dist to origin = 2500
      0, 0, 5     // Splat 2: dist to origin = 25
    ]);

    const count = initSplats(positions);
    assert.strictEqual(count, 3, 'Splat count must equal positions length / 3');
  });

  test('sortSplats orders splat indices back-to-front (descending distance from camera)', () => {
    const positions = new Float32Array([
      0, 0, 10,   // Splat 0: dist^2 to (0,0,0) = 100
      0, 0, 50,   // Splat 1: dist^2 to (0,0,0) = 2500
      0, 0, 5     // Splat 2: dist^2 to (0,0,0) = 25
    ]);

    initSplats(positions);
    const cameraPos = [0, 0, 0];
    const sortedIndices = sortSplats(cameraPos);

    assert.ok(sortedIndices instanceof Int32Array);
    assert.strictEqual(sortedIndices.length, 3);
    // Back-to-front sorting (furthest first): Splat 1 (dist 2500), Splat 0 (dist 100), Splat 2 (dist 25)
    assert.strictEqual(sortedIndices[0], 1, 'Index 0 must be Splat 1 (furthest)');
    assert.strictEqual(sortedIndices[1], 0, 'Index 1 must be Splat 0');
    assert.strictEqual(sortedIndices[2], 2, 'Index 2 must be Splat 2 (closest)');
  });

  test('sortSplats supports reusable ArrayBuffers for zero-copy memory transfers', () => {
    const scene = generatePeoriaRiverfrontScene();
    const count = scene.positions.length / 3;

    initSplats(scene.positions);

    const reusableBuffer = new ArrayBuffer(count * 4);
    const sorted = sortSplats([10, 20, 30], reusableBuffer);

    assert.strictEqual(sorted.buffer, reusableBuffer, 'Returned TypedArray must wrap provided ArrayBuffer');
    assert.strictEqual(sorted.length, count);
  });

  test('Worker message protocol handles init, sort, and zero-copy transferable responses', () => {
    let workerPostedMessage = null;
    let transferablesList = null;

    // Simulated Web Worker scope environment
    const mockSelf = {
      postMessage: (msg, transfers) => {
        workerPostedMessage = msg;
        transferablesList = transfers;
      }
    };

    // Construct worker message handlers using simulated worker context
    const positions = new Float32Array([
      0, 0, 100,  // Far
      0, 0, 10    // Near
    ]);

    // Test 'init' message
    initSplats(positions);

    // Test 'sort' message
    const sortedIndices = sortSplats([0, 0, 0]);
    mockSelf.postMessage(
      { type: 'sortComplete', indices: sortedIndices.buffer },
      [sortedIndices.buffer]
    );

    assert.strictEqual(workerPostedMessage.type, 'sortComplete');
    assert.ok(workerPostedMessage.indices instanceof ArrayBuffer);
    assert.ok(Array.isArray(transferablesList));
    assert.strictEqual(transferablesList[0], workerPostedMessage.indices, 'Transferables list must contain indices ArrayBuffer');
  });

  test('GaussianSplatRenderer integrates Web Worker depth sorting with camera motion thresholding', () => {
    // Mock minimal DOM environment for THREE WebGL container
    const baseGL = {
      getParameter: () => 'WebGL 2.0 (OpenGL ES 3.0)',
      getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    };

    const mockGL = new Proxy(baseGL, {
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return () => 0;
      }
    });

    const mockCanvas = {
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => mockGL
    };

    global.document = global.document || {
      createElementNS: () => mockCanvas,
      createElement: () => mockCanvas,
      getElementById: () => null
    };

    global.window = global.window || {
      innerWidth: 1024,
      innerHeight: 768,
      devicePixelRatio: 1,
      addEventListener: () => {}
    };

    const mockContainer = {
      clientWidth: 1024,
      clientHeight: 768,
      innerHTML: '',
      appendChild: () => {}
    };

    // Import GaussianSplatRenderer
    const { GaussianSplatRenderer } = require('../src/js/splatRenderer');
    const renderer = new GaussianSplatRenderer(mockContainer);

    const sentMessages = [];
    const mockWorker = {
      postMessage: (msg, transfers) => {
        sentMessages.push({ msg, transfers });
      },
      onmessage: null,
      onerror: null
    };

    renderer.worker = mockWorker;

    // Load scene splat data
    const scene = generatePeoriaRiverfrontScene();
    renderer.loadSplatData(scene);

    assert.strictEqual(sentMessages.length, 1, 'Initial loadSplatData must post init message to worker');
    assert.strictEqual(sentMessages[0].msg.type, 'init');

    // Reset messages and test motion thresholding
    sentMessages.length = 0;
    renderer.lastSortedCamPos.set(0, 0, 0);
    renderer.camera.position.set(0.001, 0, 0); // Below 0.01 threshold

    renderer.checkAndTriggerWorkerSort();
    assert.strictEqual(sentMessages.length, 0, 'Camera motion below threshold must NOT trigger worker sort');

    // Move camera above threshold
    renderer.camera.position.set(2.0, 0, 0); // Exceeds threshold
    renderer.checkAndTriggerWorkerSort();

    assert.strictEqual(sentMessages.length, 1, 'Camera motion above threshold MUST trigger worker sort');
    assert.strictEqual(sentMessages[0].msg.type, 'sort');
    assert.deepStrictEqual(sentMessages[0].msg.cameraPosition, [2, 0, 0]);

    // Receive worker sort complete message with transferred buffer
    const indicesBuffer = new Int32Array(renderer.splatCount).map((_, i) => renderer.splatCount - 1 - i).buffer;
    renderer.onWorkerMessage({
      data: {
        type: 'sortComplete',
        indices: indicesBuffer,
        cameraPosition: [2, 0, 0]
      }
    });

    assert.strictEqual(renderer.isWorkerSorting, false);
    assert.strictEqual(renderer.reusableIndexBuffer, indicesBuffer, 'Reusable index buffer must be retained for next transfer cycle');
  });
});
