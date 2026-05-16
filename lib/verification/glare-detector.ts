// lib/verification/glare-detector.ts
// Pure function for detecting glare (specular highlights) in a pixel region.

/**
 * Detects glare in a region of pixels (RGBA format from ImageData).
 *
 * Algorithm:
 * 1. Convert each pixel to luminance: Y = 0.299*R + 0.587*G + 0.114*B
 * 2. Count pixels where Y > luminanceThreshold
 * 3. Return true if count / totalPixels > areaPercentage
 *
 * The caller is responsible for extracting the guide rect region before
 * passing pixels to this function.
 *
 * @param pixels - Uint8ClampedArray of RGBA pixel data
 * @param width - Width of the pixel region
 * @param height - Height of the pixel region
 * @param luminanceThreshold - Luminance value above which a pixel is considered glare (default 240)
 * @param areaPercentage - Proportion of glare pixels required to trigger detection (default 0.03)
 * @returns true if glare is detected
 */
export function detectGlareInRegion(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  luminanceThreshold: number = 240,
  areaPercentage: number = 0.03
): boolean {
  const totalPixels = width * height;

  if (totalPixels <= 0) {
    return false;
  }

  let glareCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance > luminanceThreshold) {
      glareCount++;
    }
  }

  return glareCount / totalPixels > areaPercentage;
}
