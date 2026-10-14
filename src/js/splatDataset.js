/**
 * SplatDataset Domain Class for 3D Gaussian Splatting Engine.
 * Encapsulates 3D Gaussian splat memory buffers (positions, scales, colors, rotations)
 * and provides static factory methods and validation.
 */

export class SplatDataset {
  constructor(positions, scales, colors, rotations, options = {}) {
    // Handle overloaded argument style: constructor({ positions, scales, colors, rotations, name })
    if (
      positions &&
      typeof positions === 'object' &&
      !(positions instanceof Float32Array) &&
      !Array.isArray(positions)
    ) {
      options = positions;
      positions = options.positions;
      scales = options.scales;
      colors = options.colors;
      rotations = options.rotations;
    }

    if (!positions || !scales || !colors || !rotations) {
      throw new Error('SplatDataset requires positions, scales, colors, and rotations buffers.');
    }

    this.positions = positions instanceof Float32Array ? positions : new Float32Array(positions);
    this.scales = scales instanceof Float32Array ? scales : new Float32Array(scales);
    this.colors = colors instanceof Float32Array ? colors : new Float32Array(colors);
    this.rotations = rotations instanceof Float32Array ? rotations : new Float32Array(rotations);
    
    this.name = typeof options === 'string'
      ? options
      : (options && options.name) || '3D Gaussian Splat Dataset';

    this.validate();
  }

  validate() {
    const posCount = this.positions.length / 3;
    const scaleCount = this.scales.length / 3;
    const colorCount = this.colors.length / 4;
    const rotCount = this.rotations.length / 4;

    if (
      !Number.isInteger(posCount) ||
      posCount !== scaleCount ||
      posCount !== colorCount ||
      posCount !== rotCount
    ) {
      throw new Error(
        `Invalid SplatDataset buffer lengths: positions(${this.positions.length}), scales(${this.scales.length}), colors(${this.colors.length}), rotations(${this.rotations.length})`
      );
    }
  }

  get count() {
    return this.positions.length / 3;
  }

  get pointsCount() {
    return this.positions.length / 3;
  }

  static allocate(pointsCount, options = {}) {
    const count = Math.max(0, pointsCount || 0);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const rotations = new Float32Array(count * 4);

    return new SplatDataset(positions, scales, colors, rotations, options);
  }

  static fromLists(positions, scales, colors, rotations, options = {}) {
    return new SplatDataset(positions, scales, colors, rotations, options);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SplatDataset };
  module.exports.SplatDataset = SplatDataset;
  module.exports.default = SplatDataset;
}
