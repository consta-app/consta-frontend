// lib/verification/quality-analyzer.ts
// Orchestrates all quality detection modules and maps failures to remediation messages.

import {
  QualityCheckResult,
  QualityIssue,
  QualityIssueType,
  GuideRect,
  QualityAnalyzerConfig,
  DEFAULT_QUALITY_CONFIG,
} from './types';
import { detectGlareInRegion } from './glare-detector';
import { detectBlur } from './blur-detector';
import { detectLighting } from './lighting-detector';
import { detectFraming } from './framing-detector';

/**
 * Spanish remediation messages for each quality issue type.
 */
const REMEDIATION_MESSAGES: Record<QualityIssueType, string> = {
  blur: 'Mantén el dispositivo firme',
  lighting: 'Busca mejor iluminación',
  framing: 'Centra el documento dentro de la guía',
  glare: 'Inclina el documento o ajusta la luz para reducir el reflejo',
};

/**
 * Analyzes a frame (from camera or uploaded file) for quality issues.
 * Orchestrates calls to all four detectors: glare, blur, lighting, and framing.
 * All processing is synchronous on ImageData — no network calls.
 *
 * @param imageData - Full frame ImageData from canvas
 * @param guideRect - Rectangle defining the document guide area
 * @param config - Optional partial configuration overrides
 * @returns QualityCheckResult with passed flag and list of issues
 */
export function analyzeFrame(
  imageData: ImageData,
  guideRect: GuideRect,
  config?: Partial<QualityAnalyzerConfig>
): QualityCheckResult {
  const mergedConfig: QualityAnalyzerConfig = {
    glare: { ...DEFAULT_QUALITY_CONFIG.glare, ...config?.glare },
    blur: { ...DEFAULT_QUALITY_CONFIG.blur, ...config?.blur },
    lighting: { ...DEFAULT_QUALITY_CONFIG.lighting, ...config?.lighting },
    framing: { ...DEFAULT_QUALITY_CONFIG.framing, ...config?.framing },
  };

  const issues: QualityIssue[] = [];

  // Run glare detection
  const glareDetected = detectGlare(imageData, guideRect, {
    luminanceThreshold: mergedConfig.glare.luminanceThreshold,
    areaPercentage: mergedConfig.glare.areaPercentage,
  });
  if (glareDetected) {
    issues.push({
      type: 'glare',
      message: REMEDIATION_MESSAGES.glare,
      severity: 1,
    });
  }

  // Run blur detection
  const blurResult = detectBlur(imageData, guideRect, {
    varianceThreshold: mergedConfig.blur.laplacianVarianceThreshold,
  });
  if (blurResult.blurry) {
    // Normalize severity: lower variance = higher severity
    // At variance 0, severity is 1. At threshold, severity approaches 0.
    const threshold = mergedConfig.blur.laplacianVarianceThreshold;
    const severity = threshold > 0
      ? Math.max(0, Math.min(1, 1 - blurResult.variance / threshold))
      : 1;
    issues.push({
      type: 'blur',
      message: REMEDIATION_MESSAGES.blur,
      severity,
    });
  }

  // Run lighting detection
  const lightingResult = detectLighting(imageData, guideRect, {
    meanThreshold: mergedConfig.lighting.meanLuminanceThreshold,
  });
  if (lightingResult.tooDark) {
    // Normalize severity: lower luminance = higher severity
    const threshold = mergedConfig.lighting.meanLuminanceThreshold;
    const severity = threshold > 0
      ? Math.max(0, Math.min(1, 1 - lightingResult.meanLuminance / threshold))
      : 1;
    issues.push({
      type: 'lighting',
      message: REMEDIATION_MESSAGES.lighting,
      severity,
    });
  }

  // Run framing detection
  const framingResult = detectFraming(imageData, guideRect, {
    coverageThreshold: mergedConfig.framing.edgeCoverageThreshold,
  });
  if (framingResult.framingIssue) {
    // Normalize severity: lower coverage = higher severity
    const threshold = mergedConfig.framing.edgeCoverageThreshold;
    const severity = threshold > 0
      ? Math.max(0, Math.min(1, 1 - framingResult.edgeCoverage / threshold))
      : 1;
    issues.push({
      type: 'framing',
      message: REMEDIATION_MESSAGES.framing,
      severity,
    });
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Real-time glare detection wrapper for the streaming preview.
 * Extracts the guide rect pixels from ImageData and calls detectGlareInRegion.
 *
 * This is optimized for real-time use: it operates directly on the pixel data
 * without creating intermediate grayscale arrays.
 *
 * @param imageData - Full frame ImageData from canvas (typically downscaled to 320px)
 * @param guideRect - Rectangle defining the document guide area
 * @param config - Optional thresholds for luminance and area percentage
 * @returns true if glare is detected
 */
export function detectGlare(
  imageData: ImageData,
  guideRect: GuideRect,
  config?: { luminanceThreshold?: number; areaPercentage?: number }
): boolean {
  const luminanceThreshold = config?.luminanceThreshold
    ?? DEFAULT_QUALITY_CONFIG.glare.luminanceThreshold;
  const areaPercentage = config?.areaPercentage
    ?? DEFAULT_QUALITY_CONFIG.glare.areaPercentage;

  // Clamp guide rect to image bounds
  const x0 = Math.max(0, Math.floor(guideRect.x));
  const y0 = Math.max(0, Math.floor(guideRect.y));
  const x1 = Math.min(imageData.width, Math.floor(guideRect.x + guideRect.width));
  const y1 = Math.min(imageData.height, Math.floor(guideRect.y + guideRect.height));

  const regionWidth = x1 - x0;
  const regionHeight = y1 - y0;

  if (regionWidth <= 0 || regionHeight <= 0) {
    return false;
  }

  // Extract guide rect pixels into a contiguous RGBA array
  const regionPixels = new Uint8ClampedArray(regionWidth * regionHeight * 4);
  const srcData = imageData.data;
  const srcStride = imageData.width * 4;

  for (let ry = 0; ry < regionHeight; ry++) {
    const srcRowStart = (y0 + ry) * srcStride + x0 * 4;
    const dstRowStart = ry * regionWidth * 4;
    // Copy row of pixels
    for (let rx = 0; rx < regionWidth; rx++) {
      const srcIdx = srcRowStart + rx * 4;
      const dstIdx = dstRowStart + rx * 4;
      regionPixels[dstIdx] = srcData[srcIdx];
      regionPixels[dstIdx + 1] = srcData[srcIdx + 1];
      regionPixels[dstIdx + 2] = srcData[srcIdx + 2];
      regionPixels[dstIdx + 3] = srcData[srcIdx + 3];
    }
  }

  return detectGlareInRegion(
    regionPixels,
    regionWidth,
    regionHeight,
    luminanceThreshold,
    areaPercentage
  );
}
