// lib/verification/blur-detector.ts
// Blur detection via Laplacian variance on grayscale image.

import { GuideRect, DEFAULT_QUALITY_CONFIG } from './types';

/**
 * Computes the variance of the Laplacian response for a grayscale image.
 *
 * Applies the 3×3 Laplacian kernel [[0,1,0],[1,-4,1],[0,1,0]] to the image
 * and returns the variance of the response values. A low variance indicates
 * a blurry image (few edges detected).
 *
 * @param grayscale - Grayscale pixel values (one byte per pixel)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Variance of the Laplacian response
 */
export function computeLaplacianVariance(
  grayscale: Uint8Array,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) {
    return 0;
  }

  const responseCount = (width - 2) * (height - 2);
  if (responseCount === 0) {
    return 0;
  }

  // Apply 3×3 Laplacian kernel: [[0,1,0],[1,-4,1],[0,1,0]]
  // Compute sum and sum of squares in a single pass for variance calculation
  let sum = 0;
  let sumSq = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = grayscale[y * width + x];
      const top = grayscale[(y - 1) * width + x];
      const bottom = grayscale[(y + 1) * width + x];
      const left = grayscale[y * width + (x - 1)];
      const right = grayscale[y * width + (x + 1)];

      // Laplacian response: top + bottom + left + right - 4*center
      const response = top + bottom + left + right - 4 * center;

      sum += response;
      sumSq += response * response;
    }
  }

  // Variance = E[X²] - (E[X])²
  const mean = sum / responseCount;
  const variance = sumSq / responseCount - mean * mean;

  return variance;
}

/**
 * Detects blur in an image by computing the Laplacian variance within the
 * document guide area.
 *
 * Algorithm:
 * 1. Extract the guide region from the ImageData
 * 2. Convert to grayscale (Y = 0.299R + 0.587G + 0.114B)
 * 3. Compute Laplacian variance
 * 4. Classify as blurry if variance < threshold (default 100)
 *
 * @param imageData - Full frame ImageData from canvas
 * @param guideRect - Rectangle defining the document guide area
 * @param config - Optional configuration with varianceThreshold
 * @returns Object with blurry flag and computed variance
 */
export function detectBlur(
  imageData: ImageData,
  guideRect: GuideRect,
  config?: { varianceThreshold?: number }
): { blurry: boolean; variance: number } {
  const threshold = config?.varianceThreshold
    ?? DEFAULT_QUALITY_CONFIG.blur.laplacianVarianceThreshold;

  // Clamp guide rect to image bounds
  const x0 = Math.max(0, Math.floor(guideRect.x));
  const y0 = Math.max(0, Math.floor(guideRect.y));
  const x1 = Math.min(imageData.width, Math.floor(guideRect.x + guideRect.width));
  const y1 = Math.min(imageData.height, Math.floor(guideRect.y + guideRect.height));

  const regionWidth = x1 - x0;
  const regionHeight = y1 - y0;

  if (regionWidth < 3 || regionHeight < 3) {
    return { blurry: true, variance: 0 };
  }

  // Extract guide region and convert to grayscale
  const grayscale = new Uint8Array(regionWidth * regionHeight);
  const pixels = imageData.data;
  const stride = imageData.width * 4;

  for (let ry = 0; ry < regionHeight; ry++) {
    for (let rx = 0; rx < regionWidth; rx++) {
      const srcIdx = (y0 + ry) * stride + (x0 + rx) * 4;
      const r = pixels[srcIdx];
      const g = pixels[srcIdx + 1];
      const b = pixels[srcIdx + 2];
      // Standard luminance formula
      grayscale[ry * regionWidth + rx] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }

  const variance = computeLaplacianVariance(grayscale, regionWidth, regionHeight);

  return {
    blurry: variance < threshold,
    variance,
  };
}
