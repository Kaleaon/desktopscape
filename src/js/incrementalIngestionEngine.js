/**
 * Incremental Ingestion & Feature Refinement Engine for 3D Gaussian Splatting.
 * Supports continuously ingesting new photos and videos as inputs,
 * incrementally merging and refining keyframe features into the overall 3D Gaussian Splat scene model.
 */

import { alignSpatialSplatPoints, estimateCameraPose } from './registrationEngine.js';
import { analyzeTemporalDelta, applyTemporalDeltaToSplats } from './temporalDeltaAnalyzer.js';

export class IncrementalSplatModel {
  constructor(baseSplatData = null) {
    this.voxelSize = 2.0;         // 3D Voxel grid resolution for spatial indexing
    this.mergeRadiusSq = 2.25;     // 1.5 units squared distance threshold for merging
    this.historyLog = [];
    this.activeSourcesCount = 0;

    this.positionsList = [];
    this.scalesList = [];
    this.colorsList = [];
    this.rotationsList = [];
    this.weightsList = [];
    this.voxelGrid = new Map();

    if (baseSplatData) {
      this.initFromBaseScene(baseSplatData);
    }
  }

  initFromBaseScene(baseSplatData) {
    this.positionsList = [];
    this.scalesList = [];
    this.colorsList = [];
    this.rotationsList = [];
    this.weightsList = [];
    this.voxelGrid.clear();
    this.historyLog = [];
    this.activeSourcesCount = 1;

    const count = baseSplatData.positions ? baseSplatData.positions.length / 3 : 0;

    for (let i = 0; i < count; i++) {
      const x = baseSplatData.positions[i * 3];
      const y = baseSplatData.positions[i * 3 + 1];
      const z = baseSplatData.positions[i * 3 + 2];

      this.positionsList.push(x, y, z);
      this.scalesList.push(
        baseSplatData.scales[i * 3],
        baseSplatData.scales[i * 3 + 1],
        baseSplatData.scales[i * 3 + 2]
      );
      this.colorsList.push(
        baseSplatData.colors[i * 4],
        baseSplatData.colors[i * 4 + 1],
        baseSplatData.colors[i * 4 + 2],
        baseSplatData.colors[i * 4 + 3]
      );
      this.rotationsList.push(
        baseSplatData.rotations ? baseSplatData.rotations[i * 4] : 0,
        baseSplatData.rotations ? baseSplatData.rotations[i * 4 + 1] : 0,
        baseSplatData.rotations ? baseSplatData.rotations[i * 4 + 2] : 0,
        baseSplatData.rotations ? baseSplatData.rotations[i * 4 + 3] : 1
      );
      this.weightsList.push(1);

      this.addIndexToVoxel(i, x, y, z);
    }

    this.recordHistory({
      mediaTitle: baseSplatData.name || 'Base Peoria Landmark Scene',
      mediaType: 'Base Scene',
      pointsAdded: count,
      pointsMerged: 0,
      totalPoints: count,
      perspective: 'Base View',
      season: 'Summer'
    });
  }

  getVoxelKey(x, y, z) {
    const vx = Math.floor(x / this.voxelSize);
    const vy = Math.floor(y / this.voxelSize);
    const vz = Math.floor(z / this.voxelSize);
    return `${vx}_${vy}_${vz}`;
  }

  addIndexToVoxel(index, x, y, z) {
    const key = this.getVoxelKey(x, y, z);
    if (!this.voxelGrid.has(key)) {
      this.voxelGrid.set(key, []);
    }
    this.voxelGrid.get(key).push(index);
  }

  /**
   * Continuously ingests and incrementally merges new keyframe splat data into scene model.
   */
  mergeKeyframeSplats(newSplatData, options = {}) {
    if (!newSplatData || !newSplatData.positions) {
      throw new Error('No valid keyframe splat data provided for incremental ingestion.');
    }

    // 1. Estimate / resolve camera pose & spatially align keyframe points
    const cameraPose = estimateCameraPose(options.cameraPose || options);
    const alignmentResult = alignSpatialSplatPoints(newSplatData, cameraPose, options.worldOffset || [0, 0, 0]);
    const alignedData = alignmentResult.splatData;

    // 2. Perform temporal delta analysis & seasonal color adaptation
    const temporalDelta = analyzeTemporalDelta(alignedData, { positions: this.positionsList });
    const temporalResult = applyTemporalDeltaToSplats(alignedData, temporalDelta, { inplace: true });
    const incomingData = temporalResult.splatData;

    const count = incomingData.positions.length / 3;
    let pointsAdded = 0;
    let pointsMerged = 0;

    // 3. Incremental point cloud fusion & feature refinement loop
    for (let i = 0; i < count; i++) {
      const nx = incomingData.positions[i * 3];
      const ny = incomingData.positions[i * 3 + 1];
      const nz = incomingData.positions[i * 3 + 2];

      const nr = incomingData.colors[i * 4];
      const ng = incomingData.colors[i * 4 + 1];
      const nb = incomingData.colors[i * 4 + 2];
      const na = incomingData.colors[i * 4 + 3];

      const nsx = incomingData.scales[i * 3];
      const nsy = incomingData.scales[i * 3 + 1];
      const nsz = incomingData.scales[i * 3 + 2];

      const key = this.getVoxelKey(nx, ny, nz);
      const voxelIndices = this.voxelGrid.get(key) || [];

      let mergedIndex = -1;
      let minDistanceSq = this.mergeRadiusSq;

      // Find nearest existing splat point within voxel
      for (let j = 0; j < voxelIndices.length; j++) {
        const idx = voxelIndices[j];
        const ex = this.positionsList[idx * 3];
        const ey = this.positionsList[idx * 3 + 1];
        const ez = this.positionsList[idx * 3 + 2];

        const dx = nx - ex;
        const dy = ny - ey;
        const dz = nz - ez;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          mergedIndex = idx;
        }
      }

      if (mergedIndex !== -1) {
        // Refine existing splat feature (weighted average merge)
        const w = this.weightsList[mergedIndex];
        const newW = w + 1;

        this.positionsList[mergedIndex * 3]     = (this.positionsList[mergedIndex * 3] * w + nx) / newW;
        this.positionsList[mergedIndex * 3 + 1] = (this.positionsList[mergedIndex * 3 + 1] * w + ny) / newW;
        this.positionsList[mergedIndex * 3 + 2] = (this.positionsList[mergedIndex * 3 + 2] * w + nz) / newW;

        this.colorsList[mergedIndex * 4]     = (this.colorsList[mergedIndex * 4] * w + nr) / newW;
        this.colorsList[mergedIndex * 4 + 1] = (this.colorsList[mergedIndex * 4 + 1] * w + ng) / newW;
        this.colorsList[mergedIndex * 4 + 2] = (this.colorsList[mergedIndex * 4 + 2] * w + nb) / newW;
        this.colorsList[mergedIndex * 4 + 3] = Math.max(this.colorsList[mergedIndex * 4 + 3], na);

        this.scalesList[mergedIndex * 3]     = (this.scalesList[mergedIndex * 3] * w + nsx) / newW;
        this.scalesList[mergedIndex * 3 + 1] = (this.scalesList[mergedIndex * 3 + 1] * w + nsy) / newW;
        this.scalesList[mergedIndex * 3 + 2] = (this.scalesList[mergedIndex * 3 + 2] * w + nsz) / newW;

        this.weightsList[mergedIndex] = newW;
        pointsMerged++;
      } else {
        // Insert novel splat point into scene graph
        const newIndex = this.positionsList.length / 3;
        this.positionsList.push(nx, ny, nz);
        this.scalesList.push(nsx, nsy, nsz);
        this.colorsList.push(nr, ng, nb, na);
        this.rotationsList.push(
          incomingData.rotations ? incomingData.rotations[i * 4] : 0,
          incomingData.rotations ? incomingData.rotations[i * 4 + 1] : 0,
          incomingData.rotations ? incomingData.rotations[i * 4 + 2] : 0,
          incomingData.rotations ? incomingData.rotations[i * 4 + 3] : 1
        );
        this.weightsList.push(1);

        this.addIndexToVoxel(newIndex, nx, ny, nz);
        pointsAdded++;
      }
    }

    this.activeSourcesCount++;

    const logEntry = {
      mediaTitle: options.mediaTitle || `Keyframe Batch ${this.activeSourcesCount}`,
      mediaType: options.mediaType || 'Video / Photo Keyframe',
      pointsAdded,
      pointsMerged,
      totalPoints: this.positionsList.length / 3,
      perspective: cameraPose.perspective,
      season: temporalDelta.season,
      lighting: temporalDelta.lightingCondition,
      timestamp: new Date().toLocaleTimeString()
    };

    this.recordHistory(logEntry);

    return {
      ingestionSummary: logEntry,
      temporalDelta,
      cameraPose,
      splatData: this.getSplatData()
    };
  }

  recordHistory(logEntry) {
    this.historyLog.unshift(logEntry); // Most recent first
  }

  getSplatData() {
    return {
      name: 'Peoria Fused 3D Gaussian Splat Model',
      positions: new Float32Array(this.positionsList),
      scales: new Float32Array(this.scalesList),
      colors: new Float32Array(this.colorsList),
      rotations: new Float32Array(this.rotationsList)
    };
  }

  getStatistics() {
    return {
      totalSplats: this.positionsList.length / 3,
      activeSources: this.activeSourcesCount,
      voxelBuckets: this.voxelGrid.size,
      historyCount: this.historyLog.length,
      lastIngestion: this.historyLog[0] || null
    };
  }
}
