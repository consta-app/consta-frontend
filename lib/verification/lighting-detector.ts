// lib/verification/lighting-detector.ts
// Detects insufficient lighting by computing mean luminance within the guide region.

import { GuideRect, DEFAULT_QUALITY_CONFIG } from './types';

/**
 * Detects whether the document guide region is too dark.
 *
 * Algorithm:
 * 1. Extract pixels within guideRect from ImageData
 * 2. Compute luminance for each pixel: Y = 0.299*R + 0.587*G + 0.114*B
 * 3. Average all luminance values
 * 4. Classify as too dark if mean luminance < threshold (default 80)
 */
export function detectLighting(
  imageData: ImageData,
  guideRect: GuideRect,
  config?: { meanThreshold?: number }
): { tooDark: boolean; meanLuminance: number } {
  const threshold = config?.meanThreshold ?? DEFAULT_QUALITY_CONFIG.lighting.meanLuminanceThreshold;

  const { data, width } = imageData;

  // Clamp guide rect to image bounds
  const startX = Math.max(0, Math.floor(guideRect.x));
  const startY = Math.max(0, Math.floor(guideRect.y));
  const endX = Math.min(imageData.width, Math.floor(guideRect.x + guideRect.width));
  const endY = Math.min(imageData.height, Math.floor(guideRect.y + guideRect.height));

  let totalLuminance = 0;
  let pixelCount = 0;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += luminance;
      pixelCount++;
    }
  }

  // Handle edge case: no pixels in region
  if (pixelCount === 0) {
    return { tooDark: true, meanLuminance: 0 };
  }

  const meanLuminance = totalLuminance / pixelCount;

  return {
    tooDark: meanLuminance < threshold,
    meanLuminance,
  };
}
