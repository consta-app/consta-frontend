import { describe, it, expect } from 'vitest';
import { analyzeFrame, detectGlare } from './quality-analyzer';
import { GuideRect } from './types';

/**
 * Helper to create an ImageData-like object for testing.
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

describe('QualityAnalyzer', () => {
  describe('analyzeFrame', () => {
    const guideRect: GuideRect = { x: 0, y: 0, width: 40, height: 40 };

    it('passes when image has good quality (sharp edges, good lighting, no glare)', () => {
      // Create a checkerboard pattern with moderate brightness (sharp edges, good lighting)
      const imageData = createImageData(40, 40, (x, y) => {
        const val = ((x + y) % 2 === 0) ? 100 : 200;
        return [val, val, val, 255];
      });

      const result = analyzeFrame(imageData, guideRect);

      // May have framing issues since checkerboard doesn't form a rectangle,
      // but blur and lighting should pass
      expect(result.issues.find(i => i.type === 'blur')).toBeUndefined();
      expect(result.issues.find(i => i.type === 'lighting')).toBeUndefined();
      expect(result.issues.find(i => i.type === 'glare')).toBeUndefined();
    });

    it('detects blur in a uniform image', () => {
      const imageData = createImageData(40, 40, () => [128, 128, 128, 255]);

      const result = analyzeFrame(imageData, guideRect);

      expect(result.passed).toBe(false);
      const blurIssue = result.issues.find(i => i.type === 'blur');
      expect(blurIssue).toBeDefined();
      expect(blurIssue!.message).toBe('Mantén el dispositivo firme');
      expect(blurIssue!.severity).toBeGreaterThanOrEqual(0);
      expect(blurIssue!.severity).toBeLessThanOrEqual(1);
    });

    it('detects dark lighting', () => {
      // All pixels very dark (luminance < 80)
      const imageData = createImageData(40, 40, (x, y) => {
        const val = ((x + y) % 2 === 0) ? 10 : 30;
        return [val, val, val, 255];
      });

      const result = analyzeFrame(imageData, guideRect);

      expect(result.passed).toBe(false);
      const lightingIssue = result.issues.find(i => i.type === 'lighting');
      expect(lightingIssue).toBeDefined();
      expect(lightingIssue!.message).toBe('Busca mejor iluminación');
    });

    it('detects glare when many pixels are very bright', () => {
      // All pixels at max brightness (luminance > 240)
      const imageData = createImageData(40, 40, () => [255, 255, 255, 255]);

      const result = analyzeFrame(imageData, guideRect);

      expect(result.passed).toBe(false);
      const glareIssue = result.issues.find(i => i.type === 'glare');
      expect(glareIssue).toBeDefined();
      expect(glareIssue!.message).toBe('Inclina el documento o ajusta la luz para reducir el reflejo');
    });

    it('maps each failing check to exactly one issue with correct message', () => {
      // Dark uniform image → blur + lighting issues
      const imageData = createImageData(40, 40, () => [20, 20, 20, 255]);

      const result = analyzeFrame(imageData, guideRect);

      const blurIssue = result.issues.find(i => i.type === 'blur');
      const lightingIssue = result.issues.find(i => i.type === 'lighting');
      expect(blurIssue).toBeDefined();
      expect(lightingIssue).toBeDefined();
      expect(blurIssue!.message).toBe('Mantén el dispositivo firme');
      expect(lightingIssue!.message).toBe('Busca mejor iluminación');

      // Each type appears at most once
      const blurCount = result.issues.filter(i => i.type === 'blur').length;
      const lightingCount = result.issues.filter(i => i.type === 'lighting').length;
      expect(blurCount).toBe(1);
      expect(lightingCount).toBe(1);
    });

    it('respects custom config overrides', () => {
      // Image with moderate brightness (luminance ~128)
      const imageData = createImageData(40, 40, () => [128, 128, 128, 255]);

      // Set lighting threshold very high so it triggers
      const result = analyzeFrame(imageData, guideRect, {
        lighting: { meanLuminanceThreshold: 200 },
      });

      const lightingIssue = result.issues.find(i => i.type === 'lighting');
      expect(lightingIssue).toBeDefined();
    });

    it('severity is normalized between 0 and 1', () => {
      // Dark uniform image triggers multiple issues
      const imageData = createImageData(40, 40, () => [20, 20, 20, 255]);

      const result = analyzeFrame(imageData, guideRect);

      for (const issue of result.issues) {
        expect(issue.severity).toBeGreaterThanOrEqual(0);
        expect(issue.severity).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('detectGlare', () => {
    it('returns false for a dark image (no glare)', () => {
      const imageData = createImageData(40, 40, () => [50, 50, 50, 255]);
      const guideRect: GuideRect = { x: 0, y: 0, width: 40, height: 40 };

      expect(detectGlare(imageData, guideRect)).toBe(false);
    });

    it('returns true when all pixels are very bright', () => {
      const imageData = createImageData(40, 40, () => [255, 255, 255, 255]);
      const guideRect: GuideRect = { x: 0, y: 0, width: 40, height: 40 };

      expect(detectGlare(imageData, guideRect)).toBe(true);
    });

    it('returns false when bright pixels are below the area threshold', () => {
      // Only 1% of pixels are bright (below 3% threshold)
      const imageData = createImageData(100, 100, (x, y) => {
        if (x === 0 && y === 0) return [255, 255, 255, 255]; // 1 bright pixel out of 10000
        return [50, 50, 50, 255];
      });
      const guideRect: GuideRect = { x: 0, y: 0, width: 100, height: 100 };

      expect(detectGlare(imageData, guideRect)).toBe(false);
    });

    it('only analyzes pixels within the guide rect', () => {
      // Bright pixels outside guide rect, dark inside
      const imageData = createImageData(100, 100, (x, y) => {
        if (x >= 20 && x < 60 && y >= 20 && y < 60) {
          return [50, 50, 50, 255]; // Dark inside guide
        }
        return [255, 255, 255, 255]; // Bright outside guide
      });
      const guideRect: GuideRect = { x: 20, y: 20, width: 40, height: 40 };

      expect(detectGlare(imageData, guideRect)).toBe(false);
    });

    it('returns false for an empty guide rect', () => {
      const imageData = createImageData(40, 40, () => [255, 255, 255, 255]);
      const guideRect: GuideRect = { x: 0, y: 0, width: 0, height: 0 };

      expect(detectGlare(imageData, guideRect)).toBe(false);
    });

    it('respects custom luminance threshold', () => {
      // All pixels at luminance 200 — below default 240 but above custom 150
      const imageData = createImageData(40, 40, () => [200, 200, 200, 255]);
      const guideRect: GuideRect = { x: 0, y: 0, width: 40, height: 40 };

      expect(detectGlare(imageData, guideRect, { luminanceThreshold: 150 })).toBe(true);
      expect(detectGlare(imageData, guideRect, { luminanceThreshold: 240 })).toBe(false);
    });

    it('respects custom area percentage', () => {
      // 5% of pixels are bright
      const imageData = createImageData(100, 100, (x, y) => {
        // First 500 pixels (5%) are bright
        const idx = y * 100 + x;
        if (idx < 500) return [255, 255, 255, 255];
        return [50, 50, 50, 255];
      });
      const guideRect: GuideRect = { x: 0, y: 0, width: 100, height: 100 };

      // Default threshold is 3%, so 5% should trigger
      expect(detectGlare(imageData, guideRect)).toBe(true);
      // With 10% threshold, 5% should not trigger
      expect(detectGlare(imageData, guideRect, { areaPercentage: 0.10 })).toBe(false);
    });
  });
});
