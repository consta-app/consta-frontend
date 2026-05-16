// lib/verification/framing-detector.ts
// Pure functions for detecting framing issues via Canny edge detection.

import { GuideRect, DEFAULT_QUALITY_CONFIG } from './types';

/**
 * Generates a 1D Gaussian kernel for the given sigma.
 */
function gaussianKernel(sigma: number): number[] {
  const radius = Math.ceil(sigma * 3);
  const size = radius * 2 + 1;
  const kernel: number[] = new Array(size);
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const x = i - radius;
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = value;
    sum += value;
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Applies separable Gaussian blur to a grayscale image.
 */
function gaussianBlur(
  grayscale: Uint8Array,
  width: number,
  height: number,
  sigma: number
): Uint8Array {
  const kernel = gaussianKernel(sigma);
  const radius = Math.floor(kernel.length / 2);
  const temp = new Float32Array(width * height);
  const result = new Uint8Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(Math.max(x + k, 0), width - 1);
        sum += grayscale[y * width + sx] * kernel[k + radius];
      }
      temp[y * width + x] = sum;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(Math.max(y + k, 0), height - 1);
        sum += temp[sy * width + x] * kernel[k + radius];
      }
      result[y * width + x] = Math.round(Math.min(255, Math.max(0, sum)));
    }
  }

  return result;
}

/**
 * Computes Sobel gradient magnitude and direction.
 * Returns magnitude as Float32Array and direction as Float32Array (radians).
 */
function sobelGradients(
  grayscale: Uint8Array,
  width: number,
  height: number
): { magnitude: Float32Array; direction: Float32Array } {
  const magnitude = new Float32Array(width * height);
  const direction = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sobel X kernel: [[-1,0,1],[-2,0,2],[-1,0,1]]
      const gx =
        -grayscale[(y - 1) * width + (x - 1)] +
        grayscale[(y - 1) * width + (x + 1)] +
        -2 * grayscale[y * width + (x - 1)] +
        2 * grayscale[y * width + (x + 1)] +
        -grayscale[(y + 1) * width + (x - 1)] +
        grayscale[(y + 1) * width + (x + 1)];

      // Sobel Y kernel: [[-1,-2,-1],[0,0,0],[1,2,1]]
      const gy =
        -grayscale[(y - 1) * width + (x - 1)] +
        -2 * grayscale[(y - 1) * width + x] +
        -grayscale[(y - 1) * width + (x + 1)] +
        grayscale[(y + 1) * width + (x - 1)] +
        2 * grayscale[(y + 1) * width + x] +
        grayscale[(y + 1) * width + (x + 1)];

      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }

  return { magnitude, direction };
}

/**
 * Non-maximum suppression: thin edges by keeping only local maxima
 * along the gradient direction.
 */
function nonMaximumSuppression(
  magnitude: Float32Array,
  direction: Float32Array,
  width: number,
  height: number
): Float32Array {
  const result = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx];
      const mag = magnitude[idx];

      // Quantize angle to 4 directions: 0°, 45°, 90°, 135°
      // Normalize angle to [0, π)
      let normalizedAngle = angle < 0 ? angle + Math.PI : angle;
      if (normalizedAngle >= Math.PI) normalizedAngle -= Math.PI;

      let neighbor1 = 0;
      let neighbor2 = 0;

      if (normalizedAngle < Math.PI / 8 || normalizedAngle >= (7 * Math.PI) / 8) {
        // 0° direction — compare with left and right
        neighbor1 = magnitude[y * width + (x - 1)];
        neighbor2 = magnitude[y * width + (x + 1)];
      } else if (normalizedAngle < (3 * Math.PI) / 8) {
        // 45° direction — compare with top-right and bottom-left
        neighbor1 = magnitude[(y - 1) * width + (x + 1)];
        neighbor2 = magnitude[(y + 1) * width + (x - 1)];
      } else if (normalizedAngle < (5 * Math.PI) / 8) {
        // 90° direction — compare with top and bottom
        neighbor1 = magnitude[(y - 1) * width + x];
        neighbor2 = magnitude[(y + 1) * width + x];
      } else {
        // 135° direction — compare with top-left and bottom-right
        neighbor1 = magnitude[(y - 1) * width + (x - 1)];
        neighbor2 = magnitude[(y + 1) * width + (x + 1)];
      }

      // Keep pixel only if it's a local maximum
      if (mag >= neighbor1 && mag >= neighbor2) {
        result[idx] = mag;
      }
    }
  }

  return result;
}

/**
 * Double threshold + hysteresis edge tracking (Canny).
 * Returns a binary edge map (0 or 255).
 */
function doubleThresholdHysteresis(
  suppressed: Float32Array,
  width: number,
  height: number
): Uint8Array {
  const edgeMap = new Uint8Array(width * height);

  // Compute adaptive thresholds based on gradient statistics
  let maxMag = 0;
  for (let i = 0; i < suppressed.length; i++) {
    if (suppressed[i] > maxMag) maxMag = suppressed[i];
  }

  // If maximum gradient magnitude is negligible, there are no real edges
  if (maxMag < 10) {
    return edgeMap;
  }

  const highThreshold = maxMag * 0.15;
  const lowThreshold = highThreshold * 0.4;

  const STRONG = 255;
  const WEAK = 128;

  // Classify pixels
  for (let i = 0; i < suppressed.length; i++) {
    if (suppressed[i] >= highThreshold) {
      edgeMap[i] = STRONG;
    } else if (suppressed[i] >= lowThreshold) {
      edgeMap[i] = WEAK;
    }
  }

  // Hysteresis: promote weak pixels connected to strong pixels
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (edgeMap[idx] === WEAK) {
          // Check 8-connected neighbors for a strong pixel
          if (
            edgeMap[(y - 1) * width + (x - 1)] === STRONG ||
            edgeMap[(y - 1) * width + x] === STRONG ||
            edgeMap[(y - 1) * width + (x + 1)] === STRONG ||
            edgeMap[y * width + (x - 1)] === STRONG ||
            edgeMap[y * width + (x + 1)] === STRONG ||
            edgeMap[(y + 1) * width + (x - 1)] === STRONG ||
            edgeMap[(y + 1) * width + x] === STRONG ||
            edgeMap[(y + 1) * width + (x + 1)] === STRONG
          ) {
            edgeMap[idx] = STRONG;
            changed = true;
          }
        }
      }
    }
  }

  // Remove remaining weak pixels
  for (let i = 0; i < edgeMap.length; i++) {
    if (edgeMap[i] !== STRONG) {
      edgeMap[i] = 0;
    }
  }

  return edgeMap;
}

/**
 * Generates perimeter sample points along the guide rect border,
 * spaced every 2px.
 */
function generatePerimeterSamples(
  width: number,
  height: number
): { x: number; y: number }[] {
  const samples: { x: number; y: number }[] = [];
  const step = 2;

  // Top edge
  for (let x = 0; x < width; x += step) {
    samples.push({ x, y: 0 });
  }
  // Right edge (skip top-right corner)
  for (let y = step; y < height; y += step) {
    samples.push({ x: width - 1, y });
  }
  // Bottom edge (skip bottom-right corner)
  for (let x = width - 1 - step; x >= 0; x -= step) {
    samples.push({ x, y: height - 1 });
  }
  // Left edge (skip corners)
  for (let y = height - 1 - step; y > 0; y -= step) {
    samples.push({ x: 0, y });
  }

  return samples;
}

/**
 * Checks if a sample point is within `radius` pixels of a detected edge
 * in the edge map.
 */
function isNearEdge(
  edgeMap: Uint8Array,
  width: number,
  height: number,
  px: number,
  py: number,
  radius: number
): boolean {
  const minX = Math.max(0, px - radius);
  const maxX = Math.min(width - 1, px + radius);
  const minY = Math.max(0, py - radius);
  const maxY = Math.min(height - 1, py + radius);

  const radiusSq = radius * radius;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - px;
      const dy = y - py;
      if (dx * dx + dy * dy <= radiusSq && edgeMap[y * width + x] === 255) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Computes edge coverage: the proportion of perimeter sample points
 * that are within 5px of a detected edge in the Canny edge map.
 *
 * @param grayscale - Grayscale pixel data (Uint8Array, one byte per pixel)
 * @param width - Width of the grayscale image
 * @param height - Height of the grayscale image
 * @param guidePerimeter - Array of {x, y} sample points along the guide perimeter
 * @returns Coverage ratio (0–1)
 */
export function computeEdgeCoverage(
  grayscale: Uint8Array,
  width: number,
  height: number,
  guidePerimeter: { x: number; y: number }[]
): number {
  if (guidePerimeter.length === 0 || width <= 2 || height <= 2) {
    return 0;
  }

  // Step 1: Gaussian blur (σ=1.4)
  const blurred = gaussianBlur(grayscale, width, height, 1.4);

  // Step 2: Sobel gradients
  const { magnitude, direction } = sobelGradients(blurred, width, height);

  // Step 3: Non-maximum suppression
  const suppressed = nonMaximumSuppression(magnitude, direction, width, height);

  // Step 4: Double threshold + hysteresis (Canny)
  const edgeMap = doubleThresholdHysteresis(suppressed, width, height);

  // Step 5: Count perimeter samples within 5px of an edge
  const edgeRadius = 5;
  let nearEdgeCount = 0;

  for (const sample of guidePerimeter) {
    // Clamp sample coordinates to image bounds
    const sx = Math.min(Math.max(Math.round(sample.x), 0), width - 1);
    const sy = Math.min(Math.max(Math.round(sample.y), 0), height - 1);

    if (isNearEdge(edgeMap, width, height, sx, sy, edgeRadius)) {
      nearEdgeCount++;
    }
  }

  return nearEdgeCount / guidePerimeter.length;
}

/**
 * Detects framing issues by running Canny edge detection on the guide region
 * and checking if enough of the guide perimeter aligns with detected edges.
 *
 * @param imageData - Full ImageData from canvas
 * @param guideRect - The guide rectangle coordinates within the image
 * @param config - Optional configuration overrides
 * @returns Object with framingIssue flag and edgeCoverage ratio
 */
export function detectFraming(
  imageData: ImageData,
  guideRect: GuideRect,
  config?: { coverageThreshold?: number }
): { framingIssue: boolean; edgeCoverage: number } {
  const threshold =
    config?.coverageThreshold ??
    DEFAULT_QUALITY_CONFIG.framing.edgeCoverageThreshold;

  const { x, y, width: gw, height: gh } = guideRect;

  // Validate guide rect dimensions
  if (gw <= 0 || gh <= 0) {
    return { framingIssue: true, edgeCoverage: 0 };
  }

  // Clamp guide rect to image bounds
  const imgWidth = imageData.width;
  const imgHeight = imageData.height;
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(imgWidth, Math.floor(x + gw));
  const endY = Math.min(imgHeight, Math.floor(y + gh));
  const regionWidth = endX - startX;
  const regionHeight = endY - startY;

  if (regionWidth <= 2 || regionHeight <= 2) {
    return { framingIssue: true, edgeCoverage: 0 };
  }

  // Extract guide region and convert to grayscale
  const grayscale = new Uint8Array(regionWidth * regionHeight);
  const pixels = imageData.data;

  for (let ry = 0; ry < regionHeight; ry++) {
    for (let rx = 0; rx < regionWidth; rx++) {
      const srcIdx = ((startY + ry) * imgWidth + (startX + rx)) * 4;
      const r = pixels[srcIdx];
      const g = pixels[srcIdx + 1];
      const b = pixels[srcIdx + 2];
      grayscale[ry * regionWidth + rx] = Math.round(
        0.299 * r + 0.587 * g + 0.114 * b
      );
    }
  }

  // Generate perimeter samples (every 2px along the guide rect border)
  const guidePerimeter = generatePerimeterSamples(regionWidth, regionHeight);

  // Compute edge coverage
  const edgeCoverage = computeEdgeCoverage(
    grayscale,
    regionWidth,
    regionHeight,
    guidePerimeter
  );

  return {
    framingIssue: edgeCoverage < threshold,
    edgeCoverage,
  };
}
