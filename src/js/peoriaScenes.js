/**
 * High-fidelity Peoria Landmark Scene Generators for 3D Gaussian Splatting Engine.
 * Constructs realistic Gaussian splat point clouds of Peoria Riverfront, Murray Baker Bridge,
 * Downtown Peoria Skyline, and Grandview Drive Overlook.
 */

import { SplatDataset } from './splatDataset.js';

export function generatePeoriaRiverfrontScene() {
  const dataset = SplatDataset.allocate(45000, { name: 'Peoria Riverfront & Illinois River' });
  const { positions, scales, colors, rotations } = dataset;
  const pointsCount = dataset.pointsCount;

  let idx = 0;

  // 1. Murray Baker Bridge (I-74 truss bridge across Peoria's Illinois River)
  const bridgeLength = 220;
  const bridgeWidth = 18;
  const bridgeHeight = 25;
  const bridgePoints = 12000;

  for (let i = 0; i < bridgePoints; i++) {
    const t = (i / bridgePoints) * bridgeLength - (bridgeLength / 2);
    const side = (i % 2 === 0 ? 1 : -1) * (bridgeWidth / 2);
    
    // Arch curvature for Peoria Murray Baker Bridge
    const archH = Math.sin((t / bridgeLength + 0.5) * Math.PI) * bridgeHeight;

    positions[idx * 3] = t;
    positions[idx * 3 + 1] = 8 + archH;
    positions[idx * 3 + 2] = side + (Math.random() - 0.5) * 1.5;

    scales[idx * 3] = 0.8 + Math.random() * 0.4;
    scales[idx * 3 + 1] = 0.8 + Math.random() * 0.4;
    scales[idx * 3 + 2] = 0.8 + Math.random() * 0.4;

    // Steel truss orange/steel color + night light emission flags
    const isTrussPeak = archH > 15 && Math.random() > 0.7;
    colors[idx * 4] = isTrussPeak ? 1.0 : 0.65;
    colors[idx * 4 + 1] = isTrussPeak ? 0.85 : 0.68;
    colors[idx * 4 + 2] = isTrussPeak ? 0.3 : 0.72;
    colors[idx * 4 + 3] = 0.95;

    rotations[idx * 4] = 0;
    rotations[idx * 4 + 1] = 0;
    rotations[idx * 4 + 2] = 0;
    rotations[idx * 4 + 3] = 1;

    idx++;
  }

  // 2. Riverfront Shore, Docks & Peoria Riverfront Museum Complex
  const riverfrontPoints = 18000;
  for (let i = 0; i < riverfrontPoints; i++) {
    const x = (Math.random() - 0.5) * 320;
    const z = -20 - Math.random() * 120; // Shoreline
    const y = Math.max(0, Math.sin(x * 0.02) * 4 + (z * -0.15));

    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;

    scales[idx * 3] = 0.6 + Math.random() * 0.8;
    scales[idx * 3 + 1] = 0.6 + Math.random() * 0.8;
    scales[idx * 3 + 2] = 0.6 + Math.random() * 0.8;

    // Museum brick, greens, and promenade paths
    const isGreenery = Math.random() > 0.6;
    colors[idx * 4] = isGreenery ? 0.22 : 0.55;
    colors[idx * 4 + 1] = isGreenery ? 0.48 : 0.45;
    colors[idx * 4 + 2] = isGreenery ? 0.18 : 0.38;
    colors[idx * 4 + 3] = 0.9;

    rotations[idx * 4] = 0;
    rotations[idx * 4 + 1] = 0;
    rotations[idx * 4 + 2] = 0;
    rotations[idx * 4 + 3] = 1;

    idx++;
  }

  // 3. Illinois River Water Channel Bed (Splats providing water surface reflections)
  const waterPoints = pointsCount - idx;
  for (let i = 0; i < waterPoints; i++) {
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.2) * 150;
    const y = -1.8;

    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;

    scales[idx * 3] = 1.2;
    scales[idx * 3 + 1] = 0.3;
    scales[idx * 3 + 2] = 1.2;

    colors[idx * 4] = 0.08;
    colors[idx * 4 + 1] = 0.22;
    colors[idx * 4 + 2] = 0.35;
    colors[idx * 4 + 3] = 0.75;

    rotations[idx * 4] = 0;
    rotations[idx * 4 + 1] = 0;
    rotations[idx * 4 + 2] = 0;
    rotations[idx * 4 + 3] = 1;

    idx++;
  }

  return dataset;
}

export function generatePeoriaSkylineScene() {
  const dataset = SplatDataset.allocate(50000, { name: 'Downtown Peoria Skyline' });
  const { positions, scales, colors, rotations } = dataset;
  const pointsCount = dataset.pointsCount;

  let idx = 0;

  // High-rise Downtown Buildings (Caterpillar HQ, Twin Towers, Peoria Civic Center)
  const buildings = [
    { x: -40, z: -60, w: 35, d: 30, h: 70, name: 'Caterpillar World HQ' },
    { x: 30, z: -80, w: 25, d: 25, h: 85, name: 'Twin Tower 1' },
    { x: 60, z: -80, w: 25, d: 25, h: 85, name: 'Twin Tower 2' },
    { x: -90, z: -100, w: 60, d: 45, h: 35, name: 'Peoria Civic Center' },
    { x: 0, z: -120, w: 40, d: 40, h: 60, name: 'Commerce Bank Building' }
  ];

  buildings.forEach(b => {
    const bPoints = 6000;
    for (let i = 0; i < bPoints; i++) {
      const px = b.x + (Math.random() - 0.5) * b.w;
      const pz = b.z + (Math.random() - 0.5) * b.d;
      const py = Math.random() * b.h;

      positions[idx * 3] = px;
      positions[idx * 3 + 1] = py;
      positions[idx * 3 + 2] = pz;

      scales[idx * 3] = 0.7;
      scales[idx * 3 + 1] = 0.7;
      scales[idx * 3 + 2] = 0.7;

      const isWindow = Math.random() > 0.4 && py > 5;
      colors[idx * 4] = isWindow ? 0.95 : 0.35;
      colors[idx * 4 + 1] = isWindow ? 0.88 : 0.38;
      colors[idx * 4 + 2] = isWindow ? 0.60 : 0.42;
      colors[idx * 4 + 3] = 0.95;

      rotations[idx * 4] = 0;
      rotations[idx * 4 + 1] = 0;
      rotations[idx * 4 + 2] = 0;
      rotations[idx * 4 + 3] = 1;

      idx++;
    }
  });

  // Surrounding Peoria downtown city blocks & ground
  const groundPoints = pointsCount - idx;
  for (let i = 0; i < groundPoints; i++) {
    const x = (Math.random() - 0.5) * 350;
    const z = -20 - Math.random() * 180;
    const y = 0;

    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;

    scales[idx * 3] = 0.9;
    scales[idx * 3 + 1] = 0.2;
    scales[idx * 3 + 2] = 0.9;

    colors[idx * 4] = 0.25;
    colors[idx * 4 + 1] = 0.25;
    colors[idx * 4 + 2] = 0.28;
    colors[idx * 4 + 3] = 0.9;

    rotations[idx * 4] = 0;
    rotations[idx * 4 + 1] = 0;
    rotations[idx * 4 + 2] = 0;
    rotations[idx * 4 + 3] = 1;

    idx++;
  }

  return dataset;
}

export function generateGrandviewDriveScene() {
  const dataset = SplatDataset.allocate(40000, { name: 'Grandview Drive Overlook' });
  const { positions, scales, colors, rotations } = dataset;
  const pointsCount = dataset.pointsCount;

  let idx = 0;

  // Grandview Drive scenic cliff road overlooking Peoria Lake
  for (let i = 0; i < pointsCount; i++) {
    const t = (i / pointsCount) * 300 - 150;
    const bluffHeight = Math.sin(t * 0.015) * 25 + 40;
    const x = t;
    const z = Math.cos(t * 0.02) * 50 - 60;
    const y = bluffHeight + (Math.random() - 0.5) * 12;

    positions[idx * 3] = x;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = z;

    scales[idx * 3] = 0.8;
    scales[idx * 3 + 1] = 0.8;
    scales[idx * 3 + 2] = 0.8;

    // Foliage, scenic parkway grass, and overlooks
    const isForest = Math.random() > 0.3;
    colors[idx * 4] = isForest ? 0.18 : 0.45;
    colors[idx * 4 + 1] = isForest ? 0.52 : 0.38;
    colors[idx * 4 + 2] = isForest ? 0.15 : 0.25;
    colors[idx * 4 + 3] = 0.9;

    rotations[idx * 4] = 0;
    rotations[idx * 4 + 1] = 0;
    rotations[idx * 4 + 2] = 0;
    rotations[idx * 4 + 3] = 1;

    idx++;
  }

  return dataset;
}
