/**
 * Localized Async Boundaries with Contextual Retry Handlers and Skeleton Loaders.
 * 
 * Provides component-level error isolation, layout-matched skeleton placeholders
 * during data fetches (>200ms threshold), exponential backoff retry controls,
 * and diagnostic error recovery for core Peoria Desktopscape UI views.
 */

export const PANEL_TYPES = {
  SCENES: 'scenes',
  TIME: 'time',
  WEATHER: 'weather',
  YOUTUBE: 'youtube'
};

export const ERROR_CODES = {
  SCENE_FETCH_ERROR: 'ERR_SCENE_FETCH_500',
  SOLAR_SYNC_ERROR: 'ERR_SOLAR_SYNC_408',
  WEATHER_FETCH_ERROR: 'ERR_WEATHER_FETCH_503',
  PIPELINE_PROCESS_ERROR: 'ERR_PIPELINE_422',
  NETWORK_DISRUPTION: 'ERR_NETWORK_DISRUPTION_504',
  UNKNOWN_ERROR: 'ERR_UNKNOWN_500'
};

export class AsyncBoundary {
  constructor(options = {}) {
    this.panelId = options.panelId;
    this.panelType = options.panelType || 'scenes';
    this.container = typeof options.panelId === 'string' 
      ? document.getElementById(options.panelId) 
      : options.panelId;

    this.loadingThreshold = options.loadingThreshold !== undefined ? options.loadingThreshold : 200; // ms
    this.baseBackoffDelay = options.baseBackoffDelay || 1000; // ms
    this.maxBackoffDelay = options.maxBackoffDelay || 10000; // ms

    this.state = 'IDLE'; // IDLE, LOADING, SUCCESS, ERROR
    this.retryCount = 0;
    this.lastError = null;
    this.activeFetchId = 0;
    this.lastTaskFn = null;
    this.lastTaskArgs = [];
    this.originalContent = null;
    this.onFallbackNavigate = options.onFallbackNavigate || null;

    if (this.container) {
      this.cacheOriginalContent();
    }
  }

  cacheOriginalContent() {
    if (this.container && !this.originalContent) {
      this.originalContent = this.container.innerHTML;
    }
  }

  restoreOriginalContent() {
    if (this.container && this.originalContent !== null) {
      this.container.innerHTML = this.originalContent;
    }
  }

  /**
   * Calculates exponential backoff delay based on retry attempt count.
   * Delay = min(baseBackoffDelay * 2^(retryCount - 1), maxBackoffDelay)
   */
  getBackoffDelay(retryCount = this.retryCount) {
    if (retryCount <= 0) return 0;
    const exponential = Math.pow(2, retryCount - 1);
    return Math.min(this.baseBackoffDelay * exponential, this.maxBackoffDelay);
  }

  /**
   * Executes an asynchronous task wrapped within this AsyncBoundary.
   */
  async execute(taskFn, args = [], options = {}) {
    this.cacheOriginalContent();
    this.lastTaskFn = taskFn;
    this.lastTaskArgs = args;

    const fetchId = ++this.activeFetchId;
    this.state = 'LOADING';

    let thresholdReached = false;
    let thresholdTimer = null;

    // Trigger skeleton loader if fetch duration exceeds loadingThreshold (200ms)
    const thresholdPromise = new Promise((resolve) => {
      thresholdTimer = setTimeout(() => {
        if (this.activeFetchId === fetchId && this.state === 'LOADING') {
          thresholdReached = true;
          this.renderSkeleton();
        }
        resolve();
      }, this.loadingThreshold);
    });

    try {
      const result = await taskFn(...args);

      if (thresholdTimer) clearTimeout(thresholdTimer);

      if (this.activeFetchId === fetchId) {
        this.state = 'SUCCESS';
        this.retryCount = 0;
        this.lastError = null;
        
        // If skeleton was rendered or panel needs content restored/updated
        if (thresholdReached) {
          this.restoreOriginalContent();
        }
        
        if (options.onSuccess) {
          options.onSuccess(result);
        }
      }
      return result;
    } catch (err) {
      if (thresholdTimer) clearTimeout(thresholdTimer);

      if (this.activeFetchId === fetchId) {
        this.state = 'ERROR';
        this.lastError = this.normalizeError(err);
        this.renderErrorCard(this.lastError, options);

        if (options.onError) {
          options.onError(this.lastError);
        }
      }
      throw err;
    }
  }

  /**
   * Normalize errors into structured objects with diagnostic status codes.
   */
  normalizeError(err) {
    let message = (err && err.message) || 'An unexpected request failure occurred.';
    let code = (err && err.code) || (err && err.statusCode);

    if (!code) {
      switch (this.panelType) {
        case PANEL_TYPES.SCENES:
          code = ERROR_CODES.SCENE_FETCH_ERROR;
          break;
        case PANEL_TYPES.TIME:
          code = ERROR_CODES.SOLAR_SYNC_ERROR;
          break;
        case PANEL_TYPES.WEATHER:
          code = ERROR_CODES.WEATHER_FETCH_ERROR;
          break;
        case PANEL_TYPES.YOUTUBE:
          code = ERROR_CODES.PIPELINE_PROCESS_ERROR;
          break;
        default:
          code = ERROR_CODES.UNKNOWN_ERROR;
          break;
      }
    }

    return {
      message,
      code,
      details: err && err.stack ? err.stack : null,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Renders layout-matched skeleton loader matching target component dimensions.
   */
  renderSkeleton() {
    if (!this.container) return;

    let skeletonHTML = '';

    switch (this.panelType) {
      case PANEL_TYPES.SCENES:
        skeletonHTML = `
          <div class="skeleton-panel scenes-skeleton" data-testid="skeleton-scenes">
            <div class="skeleton-group">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-grid-2">
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
              </div>
            </div>
            <div class="skeleton-group" style="margin-top: 16px;">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-grid-2">
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
              </div>
            </div>
          </div>
        `;
        break;

      case PANEL_TYPES.TIME:
        skeletonHTML = `
          <div class="skeleton-panel time-skeleton" data-testid="skeleton-time">
            <div class="skeleton-group">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-slider shimmer"></div>
            </div>
            <div class="skeleton-group" style="margin-top: 16px;">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-grid-2">
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
              </div>
            </div>
            <div class="skeleton-group" style="margin-top: 16px;">
              <div class="skeleton-btn shimmer full-width"></div>
            </div>
          </div>
        `;
        break;

      case PANEL_TYPES.WEATHER:
        skeletonHTML = `
          <div class="skeleton-panel weather-skeleton" data-testid="skeleton-weather">
            <div class="skeleton-group">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-grid-2">
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
              </div>
            </div>
            <div class="skeleton-group" style="margin-top: 16px;">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-slider shimmer"></div>
            </div>
            <div class="skeleton-group" style="margin-top: 16px;">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-slider shimmer"></div>
            </div>
          </div>
        `;
        break;

      case PANEL_TYPES.YOUTUBE:
      default:
        skeletonHTML = `
          <div class="skeleton-panel youtube-skeleton" data-testid="skeleton-youtube">
            <div class="skeleton-group">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-input shimmer"></div>
            </div>
            <div class="skeleton-group" style="margin-top: 12px;">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-grid-2">
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
              </div>
            </div>
            <div class="skeleton-group" style="margin-top: 12px;">
              <div class="skeleton-label shimmer"></div>
              <div class="skeleton-grid-2">
                <div class="skeleton-btn shimmer"></div>
                <div class="skeleton-btn shimmer"></div>
              </div>
            </div>
            <div class="skeleton-box shimmer" style="margin-top: 12px; height: 36px;"></div>
            <div class="skeleton-card shimmer" style="margin-top: 12px; height: 80px;"></div>
          </div>
        `;
        break;
    }

    this.container.innerHTML = skeletonHTML;
  }

  /**
   * Renders error boundary fallback card with diagnostic codes and retry handlers.
   */
  renderErrorCard(error, options = {}) {
    if (!this.container) return;

    const backoffDelayMs = this.getBackoffDelay(this.retryCount + 1);
    const backoffSec = (backoffDelayMs / 1000).toFixed(1);

    const cardHTML = `
      <div class="error-boundary-card" data-testid="error-boundary-card" data-panel-type="${this.panelType}">
        <div class="error-card-header">
          <span class="error-icon">⚠️</span>
          <span class="error-title">Component Data Fetch Failed</span>
        </div>
        <div class="error-code-badge">${error.code || 'ERR_FETCH_FAILED'}</div>
        <p class="error-message">${this.escapeHTML(error.message)}</p>
        
        ${this.retryCount > 0 ? `
          <div class="error-backoff-info">
            Retry Attempt #${this.retryCount} (Exponential backoff delay: ${backoffSec}s)
          </div>
        ` : ''}

        <div class="error-actions">
          <button class="btn btn-retry" id="btn-retry-${this.panelType}" data-testid="btn-retry">
            ⚡ Retry Request ${this.retryCount > 0 ? `(${backoffSec}s delay)` : ''}
          </button>
          <button class="btn btn-fallback" id="btn-fallback-${this.panelType}" data-testid="btn-fallback">
            🔄 Reset Panel / Return to Default
          </button>
        </div>
      </div>
    `;

    this.container.innerHTML = cardHTML;

    // Attach retry handler with exponential backoff enforcement
    const retryBtn = this.container.querySelector(`#btn-retry-${this.panelType}`);
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.retry();
      });
    }

    // Attach fallback navigation handler
    const fallbackBtn = this.container.querySelector(`#btn-fallback-${this.panelType}`);
    if (fallbackBtn) {
      fallbackBtn.addEventListener('click', () => {
        this.handleFallbackNavigation();
      });
    }
  }

  /**
   * Initiates immediate data refetch with exponential backoff calculation.
   */
  async retry() {
    this.retryCount++;
    const backoffDelay = this.getBackoffDelay(this.retryCount);

    if (this.container) {
      const retryBtn = this.container.querySelector('.btn-retry');
      if (retryBtn) {
        retryBtn.disabled = true;
        retryBtn.textContent = `⏳ Retrying in ${(backoffDelay / 1000).toFixed(1)}s...`;
      }
    }

    if (backoffDelay > 0) {
      await new Promise((r) => setTimeout(r, backoffDelay));
    }

    if (this.lastTaskFn) {
      return this.execute(this.lastTaskFn, this.lastTaskArgs);
    }
  }

  /**
   * Handles explicit fallback navigation options.
   */
  handleFallbackNavigation() {
    this.retryCount = 0;
    this.lastError = null;
    this.state = 'IDLE';
    this.restoreOriginalContent();

    if (this.onFallbackNavigate) {
      this.onFallbackNavigate(this.panelType);
    }
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

/**
 * Global Manager for localizing Async Boundaries across all core UI views.
 */
export class AsyncBoundaryManager {
  constructor(options = {}) {
    this.boundaries = new Map();
    this.onFallbackNavigate = options.onFallbackNavigate || null;
  }

  registerPanel(panelType, panelElementId, options = {}) {
    const boundary = new AsyncBoundary({
      panelId: panelElementId,
      panelType,
      onFallbackNavigate: (pType) => {
        if (this.onFallbackNavigate) {
          this.onFallbackNavigate(pType);
        }
      },
      ...options
    });

    this.boundaries.set(panelType, boundary);
    return boundary;
  }

  getBoundary(panelType) {
    return this.boundaries.get(panelType);
  }

  async executePanelTask(panelType, taskFn, args = [], options = {}) {
    let boundary = this.boundaries.get(panelType);
    if (!boundary) {
      boundary = this.registerPanel(panelType, `panel-${panelType}`);
    }
    return boundary.execute(taskFn, args, options);
  }
}
