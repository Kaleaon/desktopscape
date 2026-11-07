/**
 * Web Worker for 3D Gaussian Splat Depth Sorting (Peoria Desktop Engine)
 * Performs off-thread back-to-front depth sorting of splats based on camera distance
 * using zero-copy Transferable ArrayBuffers.
 */

let positions = null;
let distances = null;

/**
 * Initialize or update splat positions in worker memory.
 * @param {Float32Array|ArrayBuffer|Array} posData
 * @returns {number} Number of splat points
 */
export function initSplats(posData) {
  if (!posData) {
    positions = null;
    distances = null;
    return 0;
  }

  if (posData instanceof Float32Array) {
    positions = posData;
  } else if (posData instanceof ArrayBuffer) {
    positions = new Float32Array(posData);
  } else {
    positions = new Float32Array(posData);
  }

  const count = Math.floor(positions.length / 3);
  distances = new Float32Array(count);
  return count;
}

/**
 * Calculate squared distance from camera and perform back-to-front depth sorting.
 * @param {Array|Object} cameraPosition Camera position coordinates [x, y, z] or {x, y, z}
 * @param {ArrayBuffer|Int32Array} [indexArrayBuffer] Reusable index buffer
 * @returns {Int32Array|null} Sorted indices array
 */
export function sortSplats(cameraPosition, indexArrayBuffer) {
  if (!positions || positions.length === 0) return null;

  const count = Math.floor(positions.length / 3);
  if (count === 0) return null;

  let camX = 0;
  let camY = 0;
  let camZ = 0;

  if (Array.isArray(cameraPosition)) {
    camX = cameraPosition[0] || 0;
    camY = cameraPosition[1] || 0;
    camZ = cameraPosition[2] || 0;
  } else if (cameraPosition && typeof cameraPosition === 'object') {
    camX = cameraPosition.x || 0;
    camY = cameraPosition.y || 0;
    camZ = cameraPosition.z || 0;
  }

  if (!distances || distances.length !== count) {
    distances = new Float32Array(count);
  }

  // Calculate squared Euclidean distance for each splat center to camera position
  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3] - camX;
    const dy = positions[i * 3 + 1] - camY;
    const dz = positions[i * 3 + 2] - camZ;
    distances[i] = dx * dx + dy * dy + dz * dz;
  }

  let indices;
  if (indexArrayBuffer && indexArrayBuffer instanceof Int32Array && indexArrayBuffer.length >= count) {
    indices = indexArrayBuffer;
  } else if (indexArrayBuffer && indexArrayBuffer instanceof ArrayBuffer && indexArrayBuffer.byteLength >= count * 4) {
    indices = new Int32Array(indexArrayBuffer, 0, count);
  } else {
    indices = new Int32Array(count);
  }

  for (let i = 0; i < count; i++) {
    indices[i] = i;
  }

  // Back-to-front depth sorting (furthest splats rendered first for correct WebGL blending)
  indices.sort((a, b) => distances[b] - distances[a]);

  return indices;
}

// Web Worker Global Scope listener
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = function(e) {
    const data = e.data || {};
    const type = data.type || data.action;

    if (type === 'init' || type === 'updatePositions') {
      const count = initSplats(data.positions);
      self.postMessage({
        type: type === 'init' ? 'initComplete' : 'updateComplete',
        action: type === 'init' ? 'initComplete' : 'updateComplete',
        count
      });
    } else if (type === 'sort') {
      const sortedIndices = sortSplats(data.cameraPosition, data.indices);
      if (sortedIndices) {
        // Zero-copy Transferable ArrayBuffer back to main thread
        self.postMessage(
          {
            type: 'sortComplete',
            action: 'sortComplete',
            indices: sortedIndices.buffer,
            cameraPosition: data.cameraPosition
          },
          [sortedIndices.buffer]
        );
      }
    }
  };
}
