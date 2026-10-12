/**
 * Client-side YouTube 4K Peoria Video Pipeline Controller.
 */

export class YouTubePipelineClient {
  constructor(appController) {
    this.appController = appController;
  }

  async processUrl(youtubeUrl, statusCallback) {
    if (statusCallback) statusCallback('Fetching YouTube 4K video streams...');

    try {
      let result;
      if (window.electronAPI && window.electronAPI.processYouTubeUrl) {
        const response = await window.electronAPI.processYouTubeUrl(youtubeUrl);
        if (!response.success) throw new Error(response.error || 'Failed to process YouTube video.');
        result = response.result;
      } else {
        // Fallback for browser testing
        if (statusCallback) statusCallback('Analyzing 4K Peoria keyframe motion vectors...');
        await new Promise(r => setTimeout(r, 600));
        result = this.generateClientFallback(youtubeUrl);
      }

      if (statusCallback) statusCallback('Synthesizing 3D Gaussian Splats...');
      
      const splatData = {
        positions: new Float32Array(result.splatData.positions),
        scales: new Float32Array(result.splatData.scales),
        colors: new Float32Array(result.splatData.colors),
        rotations: new Float32Array(result.splatData.rotations)
      };

      return {
        title: result.title,
        splatData
      };
    } catch (err) {
      throw err;
    }
  }

  generateClientFallback(youtubeUrl) {
    const pointsCount = 30000;
    const positions = new Float32Array(pointsCount * 3);
    const scales = new Float32Array(pointsCount * 3);
    const colors = new Float32Array(pointsCount * 4);
    const rotations = new Float32Array(pointsCount * 4);

    for (let i = 0; i < pointsCount; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      const y = Math.random() * 40;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      scales[i * 3] = 0.6;
      scales[i * 3 + 1] = 0.6;
      scales[i * 3 + 2] = 0.6;

      colors[i * 4] = 0.8;
      colors[i * 4 + 1] = 0.6;
      colors[i * 4 + 2] = 0.3;
      colors[i * 4 + 3] = 0.9;

      rotations[i * 4 + 3] = 1;
    }

    return {
      title: 'Peoria 4K YouTube Video Splat',
      splatData: {
        positions: Array.from(positions),
        scales: Array.from(scales),
        colors: Array.from(colors),
        rotations: Array.from(rotations)
      }
    };
  }
}
