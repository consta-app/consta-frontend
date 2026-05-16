// lib/verification/lighting-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectLighting } from './lighting-detector';
import { GuideRect } from './types';

/**
 * Helper to create an ImageData-like object with uniform pixel values.
 */
function createUniformImageData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

describe('detectLighting', () => {
  const fullGuide: GuideRect = { x: 0, y: 0, width: 10, height: 10 };

  it('classifies a completely dark image as too dark', () => {
    const imageData = createUniformImageData(10, 10, 0, 0, 0);
    const result = detectLighting(imageData, fullGuide);

    expect(result.tooDark).toBe(true);
    expect(result.meanLuminance).toBe(0);
  });

  it('classifies a bright image as not too dark', () => {
    // R=200, G=200, B=200 → luminance = 0.299*200 + 0.587*200 + 0.114*200 = 200
    const imageData = createUniformImageData(10, 10, 200, 200, 200);
    const result = detectLighting(imageData, fullGuide);

    expect(result.tooDark).toBe(false);
    expect(result.meanLuminance).toBeCloseTo(200, 1);
  });

  it('classifies image at exactly threshold boundary as not too dark', () => {
    // We need mean luminance = 80 exactly
    // For uniform gray: 0.299*R + 0.587*R + 0.114*R = R (when R=G=B)
    // So R=G=B=80 gives luminance = 80
    const imageData = createUniformImageData(10, 10, 80, 80, 80);
    const result = detectLighting(imageData, fullGuide);

    // mean = 80, threshold = 80, tooDark = mean < 80 → false
    expect(result.tooDark).toBe(false);
    expect(result.meanLuminance).toBeCloseTo(80, 1);
  });

  it('classifies image just below threshold as too dark', () => {
    // R=G=B=79 → luminance = 79
    const imageData = createUniformImageData(10, 10, 79, 79, 79);
    const result = detectLighting(imageData, fullGuide);

    expect(result.tooDark).toBe(true);
    expect(result.meanLuminance).toBeCloseTo(79, 1);
  });

  it('respects custom threshold', () => {
    // luminance = 50, custom threshold = 40
    const imageData = createUniformImageData(10, 10, 50, 50, 50);
    const result = detectLighting(imageData, fullGuide, { meanThreshold: 40 });

    expect(result.tooDark).toBe(false);
    expect(result.meanLuminance).toBeCloseTo(50, 1);
  });

  it('only considers pixels within the guide rect', () => {
    // Create a 20x20 image where the top-left 10x10 is dark and the rest is bright
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (x < 10 && y < 10) {
          // Dark region
          data[idx] = 20;
          data[idx + 1] = 20;
          data[idx + 2] = 20;
        } else {
          // Bright region
          data[idx] = 200;
          data[idx + 1] = 200;
          data[idx + 2] = 200;
        }
        data[idx + 3] = 255;
      }
    }

    const imageData = { data, width, height, colorSpace: 'srgb' } as ImageData;

    // Guide rect covers only the dark region
    const darkGuide: GuideRect = { x: 0, y: 0, width: 10, height: 10 };
    const darkResult = detectLighting(imageData, darkGuide);
    expect(darkResult.tooDark).toBe(true);
    expect(darkResult.meanLuminance).toBeCloseTo(20, 1);

    // Guide rect covers only the bright region
    const brightGuide: GuideRect = { x: 10, y: 10, width: 10, height: 10 };
    const brightResult = detectLighting(imageData, brightGuide);
    expect(brightResult.tooDark).toBe(false);
    expect(brightResult.meanLuminance).toBeCloseTo(200, 1);
  });

  it('handles guide rect that extends beyond image bounds', () => {
    const imageData = createUniformImageData(10, 10, 100, 100, 100);
    // Guide rect extends beyond image
    const oversizedGuide: GuideRect = { x: 5, y: 5, width: 20, height: 20 };
    const result = detectLighting(imageData, oversizedGuide);

    // Should only process pixels within bounds (5..10, 5..10) = 25 pixels
    expect(result.tooDark).toBe(false);
    expect(result.meanLuminance).toBeCloseTo(100, 1);
  });

  it('handles empty guide rect (zero area)', () => {
    const imageData = createUniformImageData(10, 10, 100, 100, 100);
    const emptyGuide: GuideRect = { x: 0, y: 0, width: 0, height: 0 };
    const result = detectLighting(imageData, emptyGuide);

    // No pixels → classified as too dark with luminance 0
    expect(result.tooDark).toBe(true);
    expect(result.meanLuminance).toBe(0);
  });

  it('computes luminance correctly for non-gray pixels', () => {
    // Pure red: luminance = 0.299 * 255 = 76.245
    const imageData = createUniformImageData(10, 10, 255, 0, 0);
    const result = detectLighting(imageData, fullGuide);

    expect(result.meanLuminance).toBeCloseTo(76.245, 1);
    expect(result.tooDark).toBe(true); // 76.245 < 80
  });

  it('computes luminance correctly for pure green', () => {
    // Pure green: luminance = 0.587 * 255 = 149.685
    const imageData = createUniformImageData(10, 10, 0, 255, 0);
    const result = detectLighting(imageData, fullGuide);

    expect(result.meanLuminance).toBeCloseTo(149.685, 1);
    expect(result.tooDark).toBe(false);
  });
});
