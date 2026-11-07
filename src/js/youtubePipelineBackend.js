/**
 * YouTube 4K Peoria Video Ingestion & 3D Gaussian Splat Pipeline Backend.
 * Parses YouTube 4K Peoria drone/walkthrough videos, extracts spatial keyframes,
 * performs feature matching across keyframe images, and synthesizes 3D Gaussian Splat datasets.
 */

import fs from 'node:fs';
import path from 'node:path';
import { extractFrames } from '../../scripts/extractFrames.js';
import { ImageStitcher } from './imageStitcher.js';

async function processYouTubePeoriaVideo(youtubeUrl, options = {}) {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    throw new Error('Invalid YouTube video URL.');
  }

  // Step 1: Keyframe extraction from YouTube video URL into frame buffer directory
  const frameExtraction = await extractFrames(youtubeUrl, options.frameBufferDir, options);

  // Step 2: Keyframe Feature Matching & 3D Point Stitching
  const stitchedResult = ImageStitcher.stitchKeyframesTo3DSplat(frameExtraction.framePaths, options);

  return {
    videoId: frameExtraction.videoId,
    youtubeUrl: frameExtraction.youtubeUrl,
    title: `Peoria 4K Gaussian Splat (${frameExtraction.videoId})`,
    pointsCount: stitchedResult.pointsCount,
    matchedKeypointsCount: stitchedResult.matchedKeypointsCount,
    frameCount: stitchedResult.frameCount,
    frameBufferDir: frameExtraction.frameBufferDir,
    perspective: options.perspective || options.cameraPose || 'drone-aerial',
    season: options.season || 'summer',
    presetTime: options.presetTime !== undefined ? options.presetTime : 12.0,
    splatData: stitchedResult.splatData
  };
}

export { processYouTubePeoriaVideo };
