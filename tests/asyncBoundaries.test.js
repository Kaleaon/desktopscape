const assert = require('assert');
const { test, describe } = require('node:test');

// Mock minimal DOM environment for testing AsyncBoundary in Node.js
class MockElement {
  constructor(id = '', className = '') {
    this.id = id;
    this.className = className;
    this.innerHTML = '';
    this.children = [];
    this.eventListeners = {};
    this.dataset = {};
    this.classList = {
      add: (c) => { if (!this.className.includes(c)) this.className += ' ' + c; },
      remove: (c) => { this.className = this.className.replace(c, '').trim(); },
      toggle: (c, val) => {
        if (val === undefined) val = !this.className.includes(c);
        if (val) this.classList.add(c); else this.classList.remove(c);
      },
      contains: (c) => this.className.includes(c)
    };
  }

  addEventListener(event, fn) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(fn);
  }

  dispatchEvent(event) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(fn => fn({ target: this }));
    }
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      return this.findChildById(id);
    }
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      return this.findChildByClass(cls);
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    if (selector.startsWith('.')) {
      const cls = selector.substring(1);
      this.collectChildrenByClass(cls, results);
    }
    return results;
  }

  findChildById(id) {
    if (this.innerHTML.includes(`id="${id}"`)) {
      const elem = new MockElement(id);
      elem.parent = this;
      return elem;
    }
    return null;
  }

  findChildByClass(cls) {
    if (this.innerHTML.includes(`class="${cls}"`) || this.innerHTML.includes(`class="`) && this.innerHTML.includes(cls)) {
      const elem = new MockElement('', cls);
      elem.parent = this;
      return elem;
    }
    return null;
  }

  collectChildrenByClass(cls, results) {
    if (this.innerHTML.includes(cls)) {
      results.push(new MockElement('', cls));
    }
  }

  click() {
    this.dispatchEvent('click');
  }
}

// Set up global document mock before importing ESM module
global.document = {
  elements: {},
  getElementById(id) {
    if (!this.elements[id]) {
      this.elements[id] = new MockElement(id);
    }
    return this.elements[id];
  },
  querySelector(sel) {
    return new MockElement();
  },
  querySelectorAll(sel) {
    return [new MockElement()];
  }
};

describe('Localized Async Boundaries & Contextual Retry Engine', async () => {
  const { AsyncBoundary, AsyncBoundaryManager, PANEL_TYPES, ERROR_CODES } = await import('../src/js/asyncBoundary.js');

  test('Requirement 1: Component-level error boundary isolates request failures', async () => {
    const container = global.document.getElementById('panel-scenes');
    const boundary = new AsyncBoundary({
      panelId: 'panel-scenes',
      panelType: PANEL_TYPES.SCENES
    });

    const failingTask = async () => {
      throw new Error('Scene server unavailable');
    };

    let caughtError = null;
    try {
      await boundary.execute(failingTask);
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, 'Boundary must catch and rethrow component failure');
    assert.strictEqual(boundary.state, 'ERROR');
    assert.ok(boundary.lastError.code === ERROR_CODES.SCENE_FETCH_ERROR);
    assert.ok(container.innerHTML.includes('error-boundary-card'), 'Must render isolated error card HTML');
  });

  test('Requirement 2: Render layout-matched skeleton loading placeholders when fetch exceeds 200ms', async () => {
    const panelTypes = [PANEL_TYPES.SCENES, PANEL_TYPES.TIME, PANEL_TYPES.WEATHER, PANEL_TYPES.YOUTUBE];

    for (const pType of panelTypes) {
      const container = global.document.getElementById(`panel-${pType}`);
      const boundary = new AsyncBoundary({
        panelId: `panel-${pType}`,
        panelType: pType,
        loadingThreshold: 50 // reduced threshold for test speed
      });

      const slowTask = () => new Promise((resolve) => setTimeout(() => resolve('done'), 100));

      const execPromise = boundary.execute(slowTask);

      // Wait for threshold to trigger skeleton
      await new Promise(r => setTimeout(r, 70));

      assert.strictEqual(boundary.state, 'LOADING');
      assert.ok(container.innerHTML.includes(`skeleton-panel`), `Skeleton panel must render for ${pType}`);
      assert.ok(container.innerHTML.includes(`skeleton-${pType}`), `Panel-specific skeleton layout matching target dimensions must render for ${pType}`);

      await execPromise;
      assert.strictEqual(boundary.state, 'SUCCESS');
    }
  });

  test('Requirement 3: Inline retry controls with exponential backoff', async () => {
    const boundary = new AsyncBoundary({
      panelId: 'panel-weather',
      panelType: PANEL_TYPES.WEATHER,
      baseBackoffDelay: 10, // fast delay for test
      maxBackoffDelay: 50
    });

    let attempts = 0;
    const task = async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Weather API timeout');
      }
      return 'Forecast synced successfully';
    };

    try {
      await boundary.execute(task);
    } catch (e) {
      // expected first failure
    }

    assert.strictEqual(boundary.state, 'ERROR');
    assert.strictEqual(attempts, 1);

    // Exponential backoff calculation test
    assert.strictEqual(boundary.getBackoffDelay(1), 10);
    assert.strictEqual(boundary.getBackoffDelay(2), 20);
    assert.strictEqual(boundary.getBackoffDelay(3), 40);
    assert.strictEqual(boundary.getBackoffDelay(4), 50); // Capped at maxBackoffDelay

    // Trigger retry
    const result = await boundary.retry();

    assert.strictEqual(result, 'Forecast synced successfully');
    assert.strictEqual(attempts, 2);
    assert.strictEqual(boundary.state, 'SUCCESS');
    assert.strictEqual(boundary.retryCount, 0);
  });

  test('Requirement 4: Diagnostic status codes and fallback navigation options', async () => {
    let fallbackTriggered = false;

    const boundary = new AsyncBoundary({
      panelId: 'panel-youtube',
      panelType: PANEL_TYPES.YOUTUBE,
      onFallbackNavigate: (type) => {
        fallbackTriggered = true;
      }
    });

    const pipelineTask = async () => {
      const err = new Error('4K YouTube stream unavailable');
      err.code = ERROR_CODES.PIPELINE_PROCESS_ERROR;
      throw err;
    };

    try {
      await boundary.execute(pipelineTask);
    } catch (e) {
      // expected
    }

    assert.strictEqual(boundary.lastError.code, ERROR_CODES.PIPELINE_PROCESS_ERROR);
    assert.ok(boundary.lastError.message.includes('4K YouTube stream unavailable'));

    boundary.handleFallbackNavigation();

    assert.strictEqual(fallbackTriggered, true);
    assert.strictEqual(boundary.state, 'IDLE');
    assert.strictEqual(boundary.retryCount, 0);
  });

  test('Acceptance Criteria: All 4 core asynchronous views isolated via AsyncBoundaryManager', async () => {
    let navigateTab = null;
    const manager = new AsyncBoundaryManager({
      onFallbackNavigate: (pType) => { navigateTab = pType; }
    });

    for (const pType of [PANEL_TYPES.SCENES, PANEL_TYPES.TIME, PANEL_TYPES.WEATHER, PANEL_TYPES.YOUTUBE]) {
      manager.registerPanel(pType, `panel-${pType}`, { baseBackoffDelay: 5 });

      // Test successful execution
      const res = await manager.executePanelTask(pType, async () => `data-${pType}`);
      assert.strictEqual(res, `data-${pType}`);
      assert.strictEqual(manager.getBoundary(pType).state, 'SUCCESS');
    }
  });
});
