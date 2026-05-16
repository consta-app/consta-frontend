import { describe, it, expect } from 'vitest';
import { computeLaplacianVariance, detectBlur } from './blur-detector';

describe('BlurDetector', () => {
  describe('computeLaplacianVariance', () => {
    it('returns 0 for images smaller than 3x3', () => {
      const grayscale = new Uint8Array([100, 100, 100, 100]);
      expect(computeLaplacianVariance(grayscale, 2, 2)).toBe(0);
    });

    it('returns 0 for a uniform image (no edges)', () => {
      // A 5x5 image with all pixels at value 128 — Laplacian response is 0 everywhere
      const width = 5;
      const height = 5;
      const grayscale = new Uint8Array(width * height).fill(128);
      expect(computeLaplacianVariance(grayscale, width, height)).toBe(0);
    });

    it('returns high variance for an image with sharp edges', () => {
      // Create a 5x5 image with a sharp vertical edge in the middle
      const width = 5;
      const height = 5;
      const grayscale = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          grayscale[y * width + x] = x < 3 ? 0 : 255;
        }
      }
      const variance = computeLaplacianVariance(grayscale, width, height);
      expect(variance).toBeGreaterThan(0);
    });

    it('returns lower variance for a blurry (gradient) image than a sharp edge image', () => {
      const width = 10;
      const height = 10;

      // Sharp edge image: left half 0, right half 255
      const sharp = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          sharp[y * width + x] = x < 5 ? 0 : 255;
        }
      }

      // Gradient image: smooth transition from 0 to 255
      const gradient = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          gradient[y * width + x] = Math.round((x / (width - 1)) * 255);
        }
      }

      const sharpVariance = computeLaplacianVariance(sharp, width, height);
      const gradientVariance = computeLaplacianVariance(gradient, width, height);

      expect(sharpVariance).toBeGreaterThan(gradientVariance);
    });
  });

  describe('detectBlur', () => {
    function createImageData(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number, number]): ImageData {
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

    it('classifies a uniform image as blurry', () => {
      const imageData = createImageData(20, 20, () => [128, 128, 128, 255]);
      const guideRect = { x: 0, y: 0, width: 20, height: 20 };

      const result = detectBlur(imageData, guideRect);

      expect(result.blurry).toBe(true);
      expect(result.variance).toBe(0);
    });

    it('classifies a sharp-edged image as not blurry', () => {
      // Create an image with strong edges (checkerboard pattern)
      const imageData = createImageData(20, 20, (x, y) => {
        const val = ((x + y) % 2 === 0) ? 0 : 255;
        return [val, val, val, 255];
      });
      const guideRect = { x: 0, y: 0, width: 20, height: 20 };

      const result = detectBlur(imageData, guideRect);

      expect(result.blurry).toBe(false);
      expect(result.variance).toBeGreaterThan(100);
    });

    it('uses custom threshold when provided', () => {
      // Uniform image has variance 0, which is below any positive threshold
      const imageData = createImageData(20, 20, () => [128, 128, 128, 255]);
      const guideRect = { x: 0, y: 0, width: 20, height: 20 };

      const result = detectBlur(imageData, guideRect, { varianceThreshold: 0 });

      // Variance is 0, threshold is 0, so 0 < 0 is false → not blurry
      expect(result.blurry).toBe(false);
    });

    it('only analyzes pixels within the guide rect', () => {
      // Image with sharp edges everywhere except the guide region
      const imageData = createImageData(40, 40, (x, y) => {
        // Guide region (10-30, 10-30) is uniform gray
        if (x >= 10 && x < 30 && y >= 10 && y < 30) {
          return [128, 128, 128, 255];
        }
        // Outside is a checkerboard (sharp edges)
        const val = ((x + y) % 2 === 0) ? 0 : 255;
        return [val, val, val, 255];
      });
      const guideRect = { x: 10, y: 10, width: 20, height: 20 };

      const result = detectBlur(imageData, guideRect);

      // Only the uniform guide region is analyzed → blurry
      expect(result.blurry).toBe(true);
      expect(result.variance).toBe(0);
    });

    it('returns blurry with variance 0 for regions smaller than 3x3', () => {
      const imageData = createImageData(10, 10, () => [128, 128, 128, 255]);
      const guideRect = { x: 0, y: 0, width: 2, height: 2 };

      const result = detectBlur(imageData, guideRect);

      expect(result.blurry).toBe(true);
      expect(result.variance).toBe(0);
    });
  });
});
