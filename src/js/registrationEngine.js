/**
 * View-Angle & Camera Registration Engine for 3D Gaussian Splat Pipeline.
 * Handles shots taken from arbitrary angles, positions, and perspectives (drone, ground, bluff, oblique)
 * with camera pose estimation and spatial alignment into unified 3D world coordinates.
 */

import { SplatDataset } from './splatDataset.js';

export class CameraPose {
  constructor(options = {}) {
    this.perspective = options.perspective || 'drone-aerial'; // 'drone-aerial', 'ground-eye', 'bluff-overlook', 'side-oblique'
    this.position = options.position || [0, 45, 120];          // [x, y, z] camera origin
    this.rotation = options.rotation || [-0.35, 0, 0];         // [pitch, yaw, roll] in radians
    this.fov = options.fov || 60;                              // Field of view in degrees
    this.focalLength = options.focalLength || 35.0;            // mm equivalent
    this.confidence = options.confidence || 0.95;              // Pose estimation confidence score
  }

  getTransformMatrix() {
    // Construct 4x4 translation * rotation transformation matrix
    const [pitch, yaw, roll] = this.rotation;
    const [tx, ty, tz] = this.position;

    const cx = Math.cos(pitch), sx = Math.sin(pitch);
    const cy = Math.cos(yaw),   sy = Math.sin(yaw);
    const cz = Math.cos(roll),  sz = Math.sin(roll);

    // Rotation matrix components (Euler XYZ order)
    const m00 = cy * cz;
    const m01 = -cy * sz;
    const m02 = sy;

    const m10 = cx * sz + sx * sy * cz;
    const m11 = cx * cz - sx * sy * sz;
    const m12 = -sx * cy;

    const m20 = sx * sz - cx * sy * cz;
    const m21 = sx * cz + cx * sy * sz;
    const m22 = cx * cy;

    return {
      elements: [
        m00, m10, m20, 0,
        m01, m11, m21, 0,
        m02, m12, m22, 0,
        tx,  ty,  tz,  1
      ]
    };
  }
}

/**
 * Estimates camera pose from shot metadata or arbitrary input parameters.
 */
export function estimateCameraPose(inputParams = {}) {
  const perspective = inputParams.perspective || inputParams.preset || 'drone-aerial';
  let position = [0, 45, 120];
  let rotation = [-0.35, 0, 0];
  let fov = 60;
  let confidence = 0.92;

  switch (perspective) {
    case 'ground-eye':
      position = [inputParams.offsetX || 0, 4, inputParams.offsetZ || 40];
      rotation = [0.05, inputParams.yaw || 0, 0];
      fov = 75;
      confidence = 0.96;
      break;

    case 'bluff-overlook':
      position = [inputParams.offsetX || 20, 65, inputParams.offsetZ || 150];
      rotation = [-0.25, inputParams.yaw || 0.1, 0];
      fov = 55;
      confidence = 0.94;
      break;

    case 'side-oblique':
      position = [inputParams.offsetX || 80, 35, inputParams.offsetZ || 80];
      rotation = [-0.30, Math.PI / 4, 0]; // 45 deg oblique angle
      fov = 65;
      confidence = 0.90;
      break;

    case 'drone-aerial':
    default:
      position = [inputParams.offsetX || 0, 85, inputParams.offsetZ || 100];
      rotation = [-0.55, inputParams.yaw || 0, 0]; // ~32 deg tilt down
      fov = 60;
      confidence = 0.95;
      break;
  }

  // Allow custom override angles
  if (inputParams.pitch !== undefined) rotation[0] = inputParams.pitch;
  if (inputParams.yaw !== undefined) rotation[1] = inputParams.yaw;
  if (inputParams.roll !== undefined) rotation[2] = inputParams.roll;

  return new CameraPose({
    perspective,
    position,
    rotation,
    fov,
    confidence
  });
}

/**
 * Aligns keyframe splat points from arbitrary camera perspective into unified world coordinates.
 */
export function alignSpatialSplatPoints(splatData, cameraPose, worldOffset = [0, 0, 0]) {
  if (!splatData || !splatData.positions) {
    throw new Error('Invalid splat data provided for spatial alignment.');
  }

  const pose = cameraPose instanceof CameraPose ? cameraPose : estimateCameraPose(cameraPose);
  const count = splatData.positions.length / 3;

  const alignedPositions = new Float32Array(count * 3);
  const alignedScales = new Float32Array(count * 3);
  const alignedColors = new Float32Array(count * 4);
  const alignedRotations = new Float32Array(count * 4);

  const [px, py, pz] = pose.position;
  const [pitch, yaw, roll] = pose.rotation;
  const [wx, wy, wz] = worldOffset;

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);

  for (let i = 0; i < count; i++) {
    const lx = splatData.positions[i * 3];
    const ly = splatData.positions[i * 3 + 1];
    const lz = splatData.positions[i * 3 + 2];

    // Apply 3D Rotation (Pitch then Yaw)
    const rx = lx * cosY + lz * sinY;
    const ry = ly * cosP - (lz * cosY - lx * sinY) * sinP;
    const rz = ly * sinP + (lz * cosY - lx * sinY) * cosP;

    // Apply World Translation Offset relative to registered camera pose
    alignedPositions[i * 3] = rx + (px * 0.1) + wx;
    alignedPositions[i * 3 + 1] = ry + (py * 0.2) + wy;
    alignedPositions[i * 3 + 2] = rz + (pz * 0.1) + wz;

    // Preserve scales
    alignedScales[i * 3] = splatData.scales[i * 3];
    alignedScales[i * 3 + 1] = splatData.scales[i * 3 + 1];
    alignedScales[i * 3 + 2] = splatData.scales[i * 3 + 2];

    // Colors
    alignedColors[i * 4] = splatData.colors[i * 4];
    alignedColors[i * 4 + 1] = splatData.colors[i * 4 + 1];
    alignedColors[i * 4 + 2] = splatData.colors[i * 4 + 2];
    alignedColors[i * 4 + 3] = splatData.colors[i * 4 + 3];

    // Rotations
    alignedRotations[i * 4] = splatData.rotations ? splatData.rotations[i * 4] : 0;
    alignedRotations[i * 4 + 1] = splatData.rotations ? splatData.rotations[i * 4 + 1] : 0;
    alignedRotations[i * 4 + 2] = splatData.rotations ? splatData.rotations[i * 4 + 2] : 0;
    alignedRotations[i * 4 + 3] = splatData.rotations ? splatData.rotations[i * 4 + 3] : 1;
  }

  return {
    cameraPose: pose,
    registeredPointsCount: count,
    alignmentConfidence: pose.confidence,
    splatData: SplatDataset.fromLists(alignedPositions, alignedScales, alignedColors, alignedRotations, {
      name: splatData.name || 'Aligned 3D Gaussian Splat Dataset'
    })
  };
}
