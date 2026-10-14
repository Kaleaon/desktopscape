/**
 * Keyframe Feature Matching & 3D Point Stitching Engine for Peoria Skyline.
 * Extracts image features across consecutive keyframe still images, matches keypoints,
 * estimates 3D spatial coordinates, and projects pixels into 3D Gaussian Splat dataset.
 */

const fs = require('fs');
const path = require('path');
const { SplatDataset } = require('./splatDataset');

class ImageStitcher {
  /**
   * Reads 24-bit BMP image into RGBA pixel buffer and dimensions.
   */
  static readBMPImage(filePathOrBuffer) {
    const buf = typeof filePathOrBuffer === 'string'
      ? fs.readFileSync(filePathOrBuffer)
      : filePathOrBuffer;

    if (!buf || buf.length < 54 || buf.toString('utf8', 0, 2) !== 'BM') {
      throw new Error('Invalid BMP file header.');
    }

    const pixelOffset = buf.readUInt32LE(10);
    const width = buf.readInt32LE(18);
    const height = Math.abs(buf.readInt32LE(22));
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;

    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y; // BMP is stored bottom-to-top
      const rowOffset = pixelOffset + srcY * rowSize;

      for (let x = 0; x < width; x++) {
        const srcOffset = rowOffset + x * 3;
        const dstOffset = (y * width + x) * 4;

        const b = buf[srcOffset];
        const g = buf[srcOffset + 1];
        const r = buf[srcOffset + 2];

        data[dstOffset] = r;
        data[dstOffset + 1] = g;
        data[dstOffset + 2] = b;
        data[dstOffset + 3] = 255;
      }
    }

    return { width, height, data };
  }

  /**
   * Extracts keypoint features and color descriptors from an image.
   */
  static extractFeatures(img, options = {}) {
    const { width, height, data } = img;
    const gridStep = options.gridStep || 4;
    const keypoints = [];

    for (let y = gridStep; y < height - gridStep; y += gridStep) {
      for (let x = gridStep; x < width - gridStep; x += gridStep) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Gradient calculation (Sobel-style difference)
        const leftIdx = (y * width + (x - 1)) * 4;
        const rightIdx = (y * width + (x + 1)) * 4;
        const topIdx = ((y - 1) * width + x) * 4;
        const bottomIdx = ((y + 1) * width + x) * 4;

        const dx = (data[rightIdx] - data[leftIdx]) * 0.5;
        const dy = (data[bottomIdx] - data[topIdx]) * 0.5;
        const gradientMagnitude = Math.sqrt(dx * dx + dy * dy);

        // Feature descriptor: color + local intensity patch
        const descriptor = [r / 255.0, g / 255.0, b / 255.0, lum / 255.0, dx / 255.0, dy / 255.0];

        keypoints.push({
          x,
          y,
          r: r / 255.0,
          g: g / 255.0,
          b: b / 255.0,
          a: 0.9,
          lum,
          gradientMagnitude,
          descriptor
        });
      }
    }

    return keypoints;
  }

  /**
   * Builds a 2D spatial grid index from keypoints.
   * Keypoints are placed into grid cells based on x, y pixel coordinates and cell size.
   */
  static buildSpatialGrid(keypoints, cellSize = 30) {
    const grid = new Map();

    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
      const cellX = Math.floor(kp.x / cellSize);
      const cellY = Math.floor(kp.y / cellSize);
      const cellKey = `${cellX},${cellY}`;

      let cell = grid.get(cellKey);
      if (!cell) {
        cell = [];
        grid.set(cellKey, cell);
      }
      cell.push(kp);
    }

    return { grid, cellSize };
  }

  /**
   * Queries candidate keypoints from adjacent grid cells (3x3 neighborhood around target coordinate).
   */
  static queryAdjacentGridCells(spatialGridInfo, x, y) {
    const { grid, cellSize } = spatialGridInfo;
    const centerCellX = Math.floor(x / cellSize);
    const centerCellY = Math.floor(y / cellSize);
    const candidates = [];

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cellKey = `${centerCellX + ox},${centerCellY + oy}`;
        const cell = grid.get(cellKey);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            candidates.push(cell[i]);
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Creates a Map lookup for pairwise keypoint matches keyed by keypoint reference.
   */
  static createMatchLookupMap(matches) {
    const matchMap = new Map();
    if (matches && Array.isArray(matches)) {
      for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        matchMap.set(m.kpA, m);
      }
    }
    return matchMap;
  }

  /**
   * Matches keypoint features between two consecutive frames using 2D spatial grid indexing.
   */
  static matchKeypoints(keypointsA, keypointsB, maxSearchRadius = 30) {
    const matches = [];
    const spatialGridInfo = ImageStitcher.buildSpatialGrid(keypointsB, maxSearchRadius);

    for (let i = 0; i < keypointsA.length; i++) {
      const kpA = keypointsA[i];
      let bestMatch = null;
      let minDistance = Infinity;

      const candidates = ImageStitcher.queryAdjacentGridCells(spatialGridInfo, kpA.x, kpA.y);

      for (let j = 0; j < candidates.length; j++) {
        const kpB = candidates[j];
        const dx = kpB.x - kpA.x;
        const dy = kpB.y - kpA.y;

        // Bounding box pre-filtering: eliminate candidate before spatial distance calculation
        if (Math.abs(dx) > maxSearchRadius || Math.abs(dy) > maxSearchRadius) continue;

        const spatialDist = Math.sqrt(dx * dx + dy * dy);

        if (spatialDist > maxSearchRadius) continue;

        // Color and descriptor difference
        let descDist = 0;
        for (let k = 0; k < kpA.descriptor.length; k++) {
          const diff = kpA.descriptor[k] - kpB.descriptor[k];
          descDist += diff * diff;
        }

        const totalDist = spatialDist * 0.1 + Math.sqrt(descDist);

        if (totalDist < minDistance) {
          minDistance = totalDist;
          bestMatch = { kpA, kpB, dx, dy, spatialDist, distance: totalDist };
        }
      }

      if (bestMatch && bestMatch.distance < 2.5) {
        matches.push(bestMatch);
      }
    }

    return matches;
  }

  /**
   * Stitches keyframes into a 3D Gaussian Splat dataset.
   */
  static stitchKeyframesTo3DSplat(frameInputs, options = {}) {
    if (!frameInputs || frameInputs.length === 0) {
      throw new Error('No keyframe inputs provided for stitching.');
    }

    // 1. Load and parse all keyframe images
    const images = frameInputs.map(input => {
      if (typeof input === 'string' || Buffer.isBuffer(input)) {
        return ImageStitcher.readBMPImage(input);
      } else if (input.width && input.height && input.data) {
        return input;
      }
      throw new Error('Invalid keyframe input format.');
    });

    // 2. Extract features for all keyframes
    const keyframesFeatures = images.map(img => ImageStitcher.extractFeatures(img, options));

    // 3. Match keypoints across consecutive frame pairs and build match lookup maps
    let totalMatchesCount = 0;
    const pairwiseMatches = [];
    const pairwiseMatchMaps = [];

    for (let f = 0; f < keyframesFeatures.length - 1; f++) {
      const matches = ImageStitcher.matchKeypoints(keyframesFeatures[f], keyframesFeatures[f + 1]);
      const matchMap = ImageStitcher.createMatchLookupMap(matches);
      pairwiseMatches.push(matches);
      pairwiseMatchMaps.push(matchMap);
      totalMatchesCount += matches.length;
    }

    // 4. Map pixel color & keypoint projections to 3D Gaussian Splats
    const allSplatPoints = [];
    const totalFrames = keyframesFeatures.length;

    for (let f = 0; f < totalFrames; f++) {
      const keypoints = keyframesFeatures[f];
      const img = images[f];
      const viewAngle = ((f / Math.max(1, totalFrames - 1)) - 0.5) * Math.PI * 0.5; // Orbit sweep

      for (let i = 0; i < keypoints.length; i++) {
        const kp = keypoints[i];

        // Normalized screen coordinates [-1..1]
        const normX = (kp.x / img.width - 0.5) * 200;
        const normY = (0.5 - kp.y / img.height) * 100;

        // Disparity estimation from feature matching using O(1) Map lookup
        let disparity = 1.0;
        if (f < pairwiseMatchMaps.length) {
          const matchMap = pairwiseMatchMaps[f];
          const match = matchMap.get(kp);
          if (match) disparity = Math.max(0.2, Math.abs(match.dx) + Math.abs(match.dy));
        }

        // Estimated 3D spatial depth (Z) and height (Y)
        const depthZ = -30 - (10.0 / disparity) + Math.sin(viewAngle) * normX;
        const posX = Math.cos(viewAngle) * normX - Math.sin(viewAngle) * depthZ * 0.2;
        const posY = Math.max(0, normY + 10);
        const posZ = Math.sin(viewAngle) * normX + Math.cos(viewAngle) * depthZ * 0.2;

        // Gaussian Splat scales based on gradient and detail
        const scaleX = 0.4 + (kp.gradientMagnitude / 255.0) * 0.8;
        const scaleY = 0.4 + (kp.gradientMagnitude / 255.0) * 0.8;
        const scaleZ = 0.4;

        // Gaussian Splat Rotation (Quaternion pointing along camera view vector)
        const qx = 0;
        const qy = Math.sin(viewAngle * 0.5);
        const qz = 0;
        const qw = Math.cos(viewAngle * 0.5);

        allSplatPoints.push({
          x: posX,
          y: posY,
          z: posZ,
          scaleX,
          scaleY,
          scaleZ,
          r: kp.r,
          g: kp.g,
          b: kp.b,
          a: kp.a,
          qx,
          qy,
          qz,
          qw
        });
      }
    }

    const pointsCount = allSplatPoints.length;
    const positions = new Float32Array(pointsCount * 3);
    const scales = new Float32Array(pointsCount * 3);
    const colors = new Float32Array(pointsCount * 4);
    const rotations = new Float32Array(pointsCount * 4);

    for (let i = 0; i < pointsCount; i++) {
      const p = allSplatPoints[i];

      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      scales[i * 3] = p.scaleX;
      scales[i * 3 + 1] = p.scaleY;
      scales[i * 3 + 2] = p.scaleZ;

      colors[i * 4] = p.r;
      colors[i * 4 + 1] = p.g;
      colors[i * 4 + 2] = p.b;
      colors[i * 4 + 3] = p.a;

      rotations[i * 4] = p.qx;
      rotations[i * 4 + 1] = p.qy;
      rotations[i * 4 + 2] = p.qz;
      rotations[i * 4 + 3] = p.qw;
    }

    return {
      pointsCount,
      matchedKeypointsCount: totalMatchesCount,
      frameCount: totalFrames,
      splatData: SplatDataset.fromLists(positions, scales, colors, rotations, {
        name: options.title || 'Stitched 3D Gaussian Splat Dataset'
      })
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImageStitcher };
}
