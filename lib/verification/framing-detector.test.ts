// lib/verification/framing-detector.test.ts
import { describe, it, expect } from 'vitest';
import { computeEdgeCoverage, detectFraming } from './framing-detector';
import { GuideRect } from './types';

/**
 * Helper: creates a synthetic grayscale image with a white rectangle
 * on a black background (strong edges at the rectangle border).
 */
function createImageWithRectangle(
  width: number,
  height: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number
): Uint8Array {
  const grayscale = new Uint8Array(width * height);
  for (let y = rectY; y < rectY + rectH && y < height; y++) {
    for (let x = rectX; x < rectX + rectW && x < width; x++) {
      grayscale[y * width + x] = 200;
    }
  }
  return grayscale;
}

/**
 * Helper: creates an ImageData-like object with RGBA pixels.
 */
function createImageData(
  width: number,
  height: number,
  fillFn: (x: number, y: number) => [number, number, number, number]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fillFn(x, y);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('computeEdgeCoverage', () => {
  it('returns 0 for empty perimeter', () => {
    const grayscale = new Uint8Array(100);
    expect(computeEdgeCoverage(grayscale, 10, 10, [])).toBe(0);
  });

  it('returns 0 for very small images', () => {
    const grayscale = new Uint8Array(4);
    const perimeter = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    expect(computeEdgeCoverage(grayscale, 2, 2, perimeter)).toBe(0);
  });

  it('returns high coverage for image with strong edges along perimeter', () => {
    // Create a 50x50 image with a white rectangle that has clear edges
    const width = 50;
    const height = 50;
    const grayscale = createImageWithRectangle(width, height, 2, 2, 46, 46);

    // Sample perimeter points along the rectangle border
    const perimeter: { x: number; y: number }[] = [];
    for (let x = 0; x < width; x += 2) {
      perimeter.push({ x, y: 0 });
      perimeter.push({ x, y: height - 1 });
    }
    for (let y = 2; y < height - 2; y += 2) {
      perimeter.push({ x: 0, y });
      perimeter.push({ x: width - 1, y });
    }

    const coverage = computeEdgeCoverage(grayscale, width, height, perimeter);
    // With a clear rectangle, most perimeter samples should be near edges
    expect(coverage).toBeGreaterThan(0.5);
  });

  it('returns low coverage for uniform image (no edges)', () => {
    const width = 50;
    const height = 50;
    // Uniform gray image — no edges
    const grayscale = new Uint8Array(width * height).fill(128);

    const perimeter: { x: number; y: number }[] = [];
    for (let x = 0; x < width; x += 2) {
      perimeter.push({ x, y: 0 });
      perimeter.push({ x, y: height - 1 });
    }
    for (let y = 2; y < height - 2; y += 2) {
      perimeter.push({ x: 0, y });
      perimeter.push({ x: width - 1, y });
    }

    const coverage = computeEdgeCoverage(grayscale, width, height, perimeter);
    expect(coverage).toBeLessThan(0.3);
  });
});

describe('detectFraming', () => {
  it('returns framingIssue: true for uniform image (no document edges)', () => {
    // Uniform gray image — no edges to detect
    const imageData = createImageData(100, 100, () => [128, 128, 128, 255]);
    const guideRect: GuideRect = { x: 10, y: 10, width: 80, height: 60 };

    const result = detectFraming(imageData, guideRect);
    expect(result.framingIssue).toBe(true);
    expect(result.edgeCoverage).toBeLessThan(0.6);
  });

  it('returns framingIssue: false for image with strong document edges', () => {
    const width = 100;
    const height = 100;
    // Create image with a white rectangle on black background (strong edges)
    const imageData = createImageData(width, height, (x, y) => {
      if (x >= 12 && x < 88 && y >= 12 && y < 68) {
        return [255, 255, 255, 255];
      }
      return [0, 0, 0, 255];
    });
    const guideRect: GuideRect = { x: 10, y: 10, width: 80, height: 60 };

    const result = detectFraming(imageData, guideRect);
    expect(result.framingIssue).toBe(false);
    expect(result.edgeCoverage).toBeGreaterThanOrEqual(0.6);
  });

  it('returns framingIssue: true for zero-size guide rect', () => {
    const imageData = createImageData(100, 100, () => [128, 128, 128, 255]);
    const guideRect: GuideRect = { x: 10, y: 10, width: 0, height: 0 };

    const result = detectFraming(imageData, guideRect);
    expect(result.framingIssue).toBe(true);
    expect(result.edgeCoverage).toBe(0);
  });

  it('respects custom coverageThreshold', () => {
    // Uniform image — coverage will be ~0
    const imageData = createImageData(100, 100, () => [128, 128, 128, 255]);
    const guideRect: GuideRect = { x: 10, y: 10, width: 80, height: 60 };

    // With threshold 0, even 0 coverage should pass
    const result = detectFraming(imageData, guideRect, { coverageThreshold: 0 });
    expect(result.framingIssue).toBe(false);
  });

  it('handles guide rect at image boundaries', () => {
    const imageData = createImageData(50, 50, () => [100, 100, 100, 255]);
    const guideRect: GuideRect = { x: 0, y: 0, width: 50, height: 50 };

    const result = detectFraming(imageData, guideRect);
    // Should not throw, just return a valid result
    expect(result).toHaveProperty('framingIssue');
    expect(result).toHaveProperty('edgeCoverage');
    expect(result.edgeCoverage).toBeGreaterThanOrEqual(0);
    expect(result.edgeCoverage).toBeLessThanOrEqual(1);
  });

  it('handles guide rect extending beyond image bounds', () => {
    const imageData = createImageData(50, 50, () => [100, 100, 100, 255]);
    const guideRect: GuideRect = { x: 40, y: 40, width: 30, height: 30 };

    const result = detectFraming(imageData, guideRect);
    expect(result).toHaveProperty('framingIssue');
    expect(result).toHaveProperty('edgeCoverage');
  });
});
