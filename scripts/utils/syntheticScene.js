/**
 * Procedural Scene Helper Module for Peoria Landscape Rendering.
 * Parameterized sky gradient and Illinois River pixel math functions.
 */

const SKY_PRESETS = {
  extractFrames: { base: { r: 80, g: 140, b: 220 }, scale: { r: 120, g: 90, b: 30 } },
  default: { base: { r: 80, g: 140, b: 220 }, scale: { r: 120, g: 90, b: 30 } },
  day: { base: { r: 100, g: 160, b: 230 }, scale: { r: 100, g: 80, b: 20 } },
  riverfront: { base: { r: 100, g: 160, b: 230 }, scale: { r: 100, g: 80, b: 20 } },
  winter: { base: { r: 180, g: 200, b: 220 }, scale: { r: 40, g: 40, b: 35 } },
  night: { base: { r: 8, g: 14, b: 28 }, scale: { r: 0, g: 0, b: 0 } }
};

const RIVER_PRESETS = {
  extractFrames: { threshold: 0.70, color: { r: 20, g: 50, b: 80 } },
  default: { threshold: 0.70, color: { r: 20, g: 50, b: 80 } },
  day: { threshold: 0.65, color: { r: 14, g: 46, b: 66 } },
  riverfront: { threshold: 0.65, color: { r: 14, g: 46, b: 66 } },
  winter: { threshold: 0.62 },
  night: { threshold: 0.65, base: { r: 12, g: 20, b: 38 }, reflectionBoost: { r: 80, g: 60, b: 20 }, bridgeWidth: 80 }
};

/**
 * Computes sky gradient pixel RGB values based on normalized Y position.
 *
 * @param {number} normY - Normalized Y coordinate (y / height, range 0.0 - 1.0)
 * @param {Object|string} [options='default'] - Preset name string or custom options object { base, scale, preset }
 * @returns {{r: number, g: number, b: number}} RGB color object
 */
function computeSkyGradient(normY, options = 'default') {
  const opts = typeof options === 'string' ? { preset: options } : (options || {});
  const presetKey = opts.preset || 'default';
  const preset = SKY_PRESETS[presetKey] || SKY_PRESETS.default;

  const base = opts.base || preset.base;
  const scale = opts.scale || preset.scale;

  return {
    r: base.r + normY * scale.r,
    g: base.g + normY * scale.g,
    b: base.b + normY * scale.b
  };
}

/**
 * Computes Illinois River water/ice/reflection pixel RGB values if coordinate is within river area.
 *
 * @param {number} x - Pixel X coordinate
 * @param {number} y - Pixel Y coordinate
 * @param {number} normY - Normalized Y coordinate (y / height)
 * @param {number} width - Image width
 * @param {Object|string} [options='default'] - Preset name string or custom options object
 * @returns {{r: number, g: number, b: number}|null} RGB color object if in river area, or null if sky/land
 */
function computeIllinoisRiver(x, y, normY, width, options = 'default') {
  const opts = typeof options === 'string' ? { preset: options } : (options || {});
  const presetKey = opts.preset || 'default';
  const preset = RIVER_PRESETS[presetKey] || RIVER_PRESETS.default;

  const threshold = opts.threshold !== undefined ? opts.threshold : (preset.threshold || 0.65);

  if (normY <= threshold) {
    return null;
  }

  if (presetKey === 'winter') {
    const icePattern = (Math.sin(x * 0.05) + Math.cos(y * 0.05)) * 20;
    return {
      r: 220 + icePattern,
      g: 238 + icePattern,
      b: 255
    };
  }

  if (presetKey === 'night') {
    const base = opts.base || preset.base || { r: 12, g: 20, b: 38 };
    let r = base.r;
    let g = base.g;
    let b = base.b;

    const bridgeWidth = opts.bridgeWidth !== undefined ? opts.bridgeWidth : (preset.bridgeWidth || 80);
    if (Math.abs(x - width * 0.5) < bridgeWidth) {
      const boost = opts.reflectionBoost || preset.reflectionBoost || { r: 80, g: 60, b: 20 };
      r += boost.r;
      g += boost.g;
      b += boost.b;
    }

    return { r, g, b };
  }

  const color = opts.color || preset.color || { r: 14, g: 46, b: 66 };
  return { r: color.r, g: color.g, b: color.b };
}

/**
 * Convenience helper to compute background pixel (sky gradient or Illinois River).
 *
 * @param {number} x - Pixel X coordinate
 * @param {number} y - Pixel Y coordinate
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object|string} [options='default'] - Preset or options object
 * @returns {{r: number, g: number, b: number}} RGB color object
 */
function getSyntheticSceneBasePixel(x, y, width, height, options = 'default') {
  const normY = y / height;
  const riverOpts = (typeof options === 'object' && options.river) ? options.river : options;
  const skyOpts = (typeof options === 'object' && options.sky) ? options.sky : options;

  const riverPixel = computeIllinoisRiver(x, y, normY, width, riverOpts);
  if (riverPixel) {
    return riverPixel;
  }

  return computeSkyGradient(normY, skyOpts);
}

module.exports = {
  computeSkyGradient,
  computeIllinoisRiver,
  getSyntheticSceneBasePixel,
  SKY_PRESETS,
  RIVER_PRESETS
};
