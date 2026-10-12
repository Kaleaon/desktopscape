/**
 * Temporal Change & Delta Understanding Module for 3D Gaussian Splatting.
 * Recognizes time-of-day lighting shifts, seasonal foliage/ice changes,
 * and architectural shifts across multi-temporal photos and videos.
 */

export class TemporalDelta {
  constructor(options = {}) {
    this.timeOfDay = options.timeOfDay || 12.0;               // 0.0 - 24.0 hours
    this.lightingCondition = options.lightingCondition || 'midday'; // 'dawn', 'midday', 'sunset', 'night', 'overcast'
    this.season = options.season || 'summer';                  // 'summer', 'autumn', 'winter', 'spring'
    this.winterIceDelta = options.winterIceDelta || 0.0;        // 0.0 = open water, 1.0 = solid river ice
    this.foliageShift = options.foliageShift || 0.0;            // 0.0 = green, 0.5 = autumn gold/red, 1.0 = winter snow
    this.structuralShift = options.structuralShift || 0.0;      // Architectural modification score 0.0 - 1.0
    this.timestamp = options.timestamp || new Date().toISOString();
  }
}

/**
 * Analyzes temporal features and calculates time-of-day / season delta relative to base scene.
 */
export function analyzeTemporalDelta(inputData = {}, baseSceneData = {}) {
  const colors = inputData.colors || inputData.palette || [];
  const count = colors.length / 4;

  let totalR = 0, totalG = 0, totalB = 0;
  let brightPixels = 0, darkPixels = 0;
  let greenPixels = 0, orangePixels = 0, whitePixels = 0;

  for (let i = 0; i < count; i++) {
    const r = colors[i * 4];
    const g = colors[i * 4 + 1];
    const b = colors[i * 4 + 2];

    totalR += r;
    totalG += g;
    totalB += b;

    const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
    if (luminance > 0.7) brightPixels++;
    if (luminance < 0.2) darkPixels++;

    // Color ratios for seasonal understanding
    if (g > r * 1.2 && g > b) greenPixels++;
    else if (r > 0.6 && g > 0.4 && b < 0.3) orangePixels++;
    else if (r > 0.8 && g > 0.85 && b > 0.9) whitePixels++;
  }

  const avgR = count > 0 ? totalR / count : 0.5;
  const avgG = count > 0 ? totalG / count : 0.5;
  const avgB = count > 0 ? totalB / count : 0.5;

  // Determine Lighting & Time of Day
  let lightingCondition = 'midday';
  let estimatedTimeOfDay = 12.0;

  if (inputData.presetTime !== undefined) {
    estimatedTimeOfDay = inputData.presetTime;
    if (estimatedTimeOfDay >= 5 && estimatedTimeOfDay < 8) lightingCondition = 'dawn';
    else if (estimatedTimeOfDay >= 8 && estimatedTimeOfDay < 17) lightingCondition = 'midday';
    else if (estimatedTimeOfDay >= 17 && estimatedTimeOfDay < 20) lightingCondition = 'sunset';
    else lightingCondition = 'night';
  } else if (darkPixels / Math.max(1, count) > 0.4) {
    lightingCondition = 'night';
    estimatedTimeOfDay = 22.0;
  } else if (avgR > avgG * 1.3 && avgR > avgB * 1.4) {
    lightingCondition = 'sunset';
    estimatedTimeOfDay = 18.5;
  } else if (avgB > avgR * 1.2 && avgG > avgR) {
    lightingCondition = 'dawn';
    estimatedTimeOfDay = 6.5;
  }

  // Determine Season & Winter Ice / Foliage Shift
  let season = inputData.presetSeason || 'summer';
  let winterIceDelta = 0.0;
  let foliageShift = 0.0;

  if (inputData.presetSeason) {
    season = inputData.presetSeason;
    if (season === 'autumn') foliageShift = 0.6;
    else if (season === 'winter') { foliageShift = 1.0; winterIceDelta = 0.85; }
    else if (season === 'spring') foliageShift = 0.2;
  } else if (whitePixels / Math.max(1, count) > 0.25 || avgB > 0.7 && avgR > 0.7) {
    season = 'winter';
    winterIceDelta = 0.9;
    foliageShift = 1.0;
  } else if (orangePixels / Math.max(1, count) > 0.2) {
    season = 'autumn';
    foliageShift = 0.65;
  } else {
    season = 'summer';
    foliageShift = 0.0;
  }

  // Architectural / Structural shift comparison with base scene
  const baseCount = baseSceneData.positions ? baseSceneData.positions.length / 3 : count;
  const structuralShift = Math.abs(count - baseCount) / Math.max(1, baseCount);

  return new TemporalDelta({
    timeOfDay: estimatedTimeOfDay,
    lightingCondition,
    season,
    winterIceDelta,
    foliageShift,
    structuralShift: Math.min(1.0, structuralShift)
  });
}

/**
 * Applies temporal delta updates to splat dataset colors and attributes.
 */
export function applyTemporalDeltaToSplats(splatData, temporalDelta) {
  if (!splatData || !splatData.colors) {
    return splatData;
  }

  const delta = temporalDelta instanceof TemporalDelta ? temporalDelta : analyzeTemporalDelta(splatData);
  const count = splatData.colors.length / 4;
  const updatedColors = new Float32Array(splatData.colors.length);

  for (let i = 0; i < count; i++) {
    let r = splatData.colors[i * 4];
    let g = splatData.colors[i * 4 + 1];
    let b = splatData.colors[i * 4 + 2];
    const a = splatData.colors[i * 4 + 3];

    // Seasonal Foliage transformation (Green -> Autumn Gold/Red -> Winter Snow)
    const isGreenishFoliage = g > r * 0.95 && g > b * 1.1;

    if (isGreenishFoliage) {
      if (delta.foliageShift > 0.8) { // Winter snow cover
        r = Math.min(1.0, r + 0.5);
        g = Math.min(1.0, g + 0.45);
        b = Math.min(1.0, b + 0.55);
      } else if (delta.foliageShift > 0.4) { // Autumn foliage shift
        r = Math.min(1.0, r + 0.45);
        g = g * 0.55;
        b = b * 0.2;
      }
    }

    // Time-of-day lighting adjustments
    if (delta.lightingCondition === 'sunset') {
      r = Math.min(1.0, r * 1.25);
      g = g * 0.85;
      b = b * 0.6;
    } else if (delta.lightingCondition === 'night') {
      r = r * 0.35;
      g = g * 0.4;
      b = Math.min(1.0, b * 0.7);
    }

    updatedColors[i * 4] = r;
    updatedColors[i * 4 + 1] = g;
    updatedColors[i * 4 + 2] = b;
    updatedColors[i * 4 + 3] = a;
  }

  return {
    temporalDelta: delta,
    splatData: {
      positions: splatData.positions,
      scales: splatData.scales,
      colors: updatedColors,
      rotations: splatData.rotations
    }
  };
}
