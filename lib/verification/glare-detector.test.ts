// lib/verification/glare-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectGlareInRegion } from './glare-detector';

/**
 * Helper to create a Uint8ClampedArray of RGBA pixels with uniform color.
 */
function createUniformPixels(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number = 255
): Uint8ClampedArray {
  const totalPixels = width * height;
  const data = new Uint8ClampedArray(totalPixels * 4);
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = a;
  }
  return data;
}

/**
 * Helper to create pixels where a specified proportion are bright (glare).
 */
function createMixedPixels(
  width: number,
  height: number,
  glareProportion: number
): Uint8ClampedArray {
  const totalPixels = width * height;
  const data = new Uint8ClampedArray(totalPixels * 4);
  const glareCount = Math.floor(totalPixels * glareProportion);

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    if (i < glareCount) {
      // White pixel (luminance = 255, well above 240)
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    } else {
      // Dark pixel (luminance ≈ 50)
      data[offset] = 50;
      data[offset + 1] = 50;
      data[offset + 2] = 50;
    }
    data[offset + 3] = 255;
  }
  return data;
}

describe('detectGlareInRegion', () => {
  it('returns false for a completely dark image', () => {
    const pixels = createUniformPixels(100, 100, 0, 0, 0);
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.03)).toBe(false);
  });

  it('returns true for a completely white image', () => {
    const pixels = createUniformPixels(100, 100, 255, 255, 255);
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.03)).toBe(true);
  });

  it('returns false when glare proportion is below threshold', () => {
    // 2% glare, threshold is 3%
    const pixels = createMixedPixels(100, 100, 0.02);
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.03)).toBe(false);
  });

  it('returns true when glare proportion exceeds threshold', () => {
    // 5% glare, threshold is 3%
    const pixels = createMixedPixels(100, 100, 0.05);
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.03)).toBe(true);
  });

  it('returns false when glare proportion equals threshold exactly', () => {
    // Exactly 3% glare — the condition is strictly greater than, so this should be false
    const pixels = createMixedPixels(100, 100, 0.03);
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.03)).toBe(false);
  });

  it('respects custom luminance threshold', () => {
    // Pixels with luminance ~200 (below default 240 but above custom 150)
    const pixels = createUniformPixels(10, 10, 200, 200, 200);
    // Luminance = 0.299*200 + 0.587*200 + 0.114*200 = 200
    expect(detectGlareInRegion(pixels, 10, 10, 150, 0.03)).toBe(true);
    expect(detectGlareInRegion(pixels, 10, 10, 240, 0.03)).toBe(false);
  });

  it('respects custom area percentage threshold', () => {
    // 5% glare pixels
    const pixels = createMixedPixels(100, 100, 0.05);
    // With 3% threshold → detected
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.03)).toBe(true);
    // With 10% threshold → not detected
    expect(detectGlareInRegion(pixels, 100, 100, 240, 0.10)).toBe(false);
  });

  it('returns false for zero-dimension region', () => {
    const pixels = new Uint8ClampedArray(0);
    expect(detectGlareInRegion(pixels, 0, 0, 240, 0.03)).toBe(false);
  });

  it('handles single pixel region correctly', () => {
    // Single bright pixel → 100% glare, exceeds 3%
    const bright = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(detectGlareInRegion(bright, 1, 1, 240, 0.03)).toBe(true);

    // Single dark pixel → 0% glare
    const dark = new Uint8ClampedArray([50, 50, 50, 255]);
    expect(detectGlareInRegion(dark, 1, 1, 240, 0.03)).toBe(false);
  });

  it('correctly computes luminance using the standard formula', () => {
    // Create a pixel where only green is high: R=0, G=255, B=0
    // Luminance = 0.299*0 + 0.587*255 + 0.114*0 = 149.685
    const greenPixels = new Uint8ClampedArray([0, 255, 0, 255]);
    // Luminance 149.685 < 240, so no glare
    expect(detectGlareInRegion(greenPixels, 1, 1, 240, 0.03)).toBe(false);
    // But with threshold 100, it's above
    expect(detectGlareInRegion(greenPixels, 1, 1, 100, 0.03)).toBe(true);
  });
});
