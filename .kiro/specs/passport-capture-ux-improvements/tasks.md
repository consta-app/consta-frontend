# Implementation Plan: Passport Capture UX Improvements

## Overview

This plan decomposes the monolithic `BiometricVerificationCard` (~1181 lines) into modular pure-logic modules and UI components. Implementation proceeds in dependency order: pure detection modules first, then UI components, then integration into the existing page, and finally accessibility and testing.

## Tasks

- [x] 1. Set up project structure and install dependencies
  - [x] 1.1 Create directory structure and install dependencies
    - Create `lib/verification/` directory for pure logic modules
    - Create `components/verification/` directory for UI components
    - Install `fast-check` as a dev dependency for property-based testing
    - Install a lightweight QR code library (e.g., `qrcode.react`) for handoff UI
    - Install `vitest` and `@testing-library/react` as dev dependencies if not present
    - _Requirements: All_

  - [x] 1.2 Define shared types and interfaces
    - Create `lib/verification/types.ts` with `QualityCheckResult`, `QualityIssue`, `QualityIssueType`, `QualityAnalyzerConfig`, `GuideRect`, `HandoffToken`, `HandoffResult`, `HandoffStatus`, `FileValidation` interfaces
    - Define the extended `BioState` union type with new variants: `id-quality-failed`, `handoff-active`, `handoff-expired`, `fallback-upload`, and the extended `id-streaming` with `glareDetected`
    - Export constants: `ACCEPTED_TYPES`, `MAX_FILE_SIZE_BYTES`, default config thresholds
    - _Requirements: 2.1, 3.2, 4.2, 4.3, 4.4, 5.2_

- [x] 2. Implement quality detection modules (pure functions)
  - [x] 2.1 Implement GlareDetector module
    - Create `lib/verification/glare-detector.ts`
    - Implement `detectGlareInRegion(pixels, width, height, luminanceThreshold, areaPercentage): boolean`
    - Algorithm: convert each pixel to luminance (Y = 0.299R + 0.587G + 0.114B), count pixels where Y > threshold (default 240), return true if count/total > areaPercentage (default 0.03)
    - Operate only on pixels within the provided region (guide rect extraction handled by caller)
    - _Requirements: 2.1, 2.5_

  - [ ]* 2.2 Write property tests for GlareDetector
    - **Property 3: Glare Detection Threshold** — For any pixel array, glare detected iff proportion of pixels with luminance > 240 exceeds 3%
    - **Property 4: Glare Spatial Filtering** — Pixels outside guide rect do not affect detection outcome
    - **Validates: Requirements 2.1, 2.5**

  - [x] 2.3 Implement BlurDetector module
    - Create `lib/verification/blur-detector.ts`
    - Implement `computeLaplacianVariance(grayscale, width, height): number`
    - Implement `detectBlur(imageData, guideRect, config?): { blurry: boolean; variance: number }`
    - Algorithm: extract guide region, convert to grayscale, apply 3×3 Laplacian kernel [[0,1,0],[1,-4,1],[0,1,0]], compute variance of response, classify as blurry if variance < 100
    - _Requirements: 4.2_

  - [ ]* 2.4 Write property test for BlurDetector
    - **Property 7: Blur Detection Threshold** — For any grayscale image region, classified as blurry iff Laplacian variance < 100
    - **Validates: Requirements 4.2**

  - [x] 2.5 Implement LightingDetector module
    - Create `lib/verification/lighting-detector.ts`
    - Implement `detectLighting(imageData, guideRect, config?): { tooDark: boolean; meanLuminance: number }`
    - Algorithm: extract guide region pixels, compute mean luminance (0.299R + 0.587G + 0.114B averaged), classify as too dark if mean < 80
    - _Requirements: 4.3_

  - [ ]* 2.6 Write property test for LightingDetector
    - **Property 8: Lighting Detection Threshold** — For any pixel array, classified as too dark iff mean luminance < 80
    - **Validates: Requirements 4.3**

  - [x] 2.7 Implement FramingDetector module
    - Create `lib/verification/framing-detector.ts`
    - Implement `computeEdgeCoverage(grayscale, width, height, guidePerimeter): number`
    - Implement `detectFraming(imageData, guideRect, config?): { framingIssue: boolean; edgeCoverage: number }`
    - Algorithm: grayscale → Gaussian blur (σ=1.4) → Sobel gradients → non-maximum suppression → Canny double threshold + hysteresis → sample perimeter every 2px → count samples within 5px of edge → framingIssue if coverage < 0.60
    - _Requirements: 4.4_

  - [ ]* 2.8 Write property test for FramingDetector
    - **Property 9: Framing Detection Threshold** — For any edge map and guide perimeter, framing insufficient iff < 60% of perimeter samples are within 5px of a detected edge
    - **Validates: Requirements 4.4**

  - [x] 2.9 Implement QualityAnalyzer orchestrator
    - Create `lib/verification/quality-analyzer.ts`
    - Implement `analyzeFrame(imageData, guideRect, config?): QualityCheckResult`
    - Orchestrate calls to GlareDetector, BlurDetector, LightingDetector, FramingDetector
    - Map each failing check to its Spanish remediation message (blur: "Mantén el dispositivo firme"; lighting: "Busca mejor iluminación"; framing: "Centra el documento dentro de la guía"; glare: "Inclina el documento o ajusta la luz para reducir el reflejo")
    - Implement `detectGlare(imageData, guideRect, config?)` wrapper for real-time streaming use
    - _Requirements: 4.1, 4.5, 4.6_

  - [ ]* 2.10 Write property test for Quality → Message mapping
    - **Property 10: Quality Issue to Remediation Message Mapping** — For any combination of quality check failures, exactly one remediation message per failing check with correct text, and OCR is not invoked
    - **Validates: Requirements 4.5**

- [x] 3. Checkpoint - Ensure all quality module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement HandoffSession and TokenManager modules
  - [x] 4.1 Implement TokenManager module
    - Create `lib/verification/token-manager.ts`
    - Implement `generateToken(): HandoffToken` using `crypto.getRandomValues` (32 bytes, base64url-encoded)
    - Implement `isTokenValid(token): boolean` — returns true iff `token.used === false` AND `Date.now() < token.expiresAt`
    - Token TTL: 5 minutes (300,000ms)
    - _Requirements: 3.2_

  - [ ]* 4.2 Write property test for Token expiration
    - **Property 5: Handoff Token Expiration** — `isTokenValid(token)` returns true iff `token.used === false` AND `Date.now() < token.expiresAt`
    - **Validates: Requirements 3.2**

  - [x] 4.3 Implement HandoffSession module
    - Create `lib/verification/handoff-session.ts`
    - Implement `createHandoffSession(): { token: HandoffToken; url: string }`
    - Implement `listenForHandoffResult(token, onStatusChange): { disconnect: () => void }` — opens WebSocket to relay, handles status transitions (waiting → connected → completed/expired/error)
    - Implement `sendHandoffResult(token, result): Promise<void>` — mobile side sends `{confidence, proof}` to relay
    - Handle reconnection (3 retries, 2s backoff) and token expiration
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 4.4 Write property test for Handoff payload privacy
    - **Property 6: Handoff Payload Privacy** — For any message transmitted during handoff, payload contains only `{confidence, proof, type}` and no image data, pixel arrays, face embeddings, or biometric descriptors
    - **Validates: Requirements 3.4, 3.7**

  - [x] 4.5 Implement file validation utility
    - Create `lib/verification/file-validator.ts`
    - Implement `validateFile(file: File): FileValidation` — checks MIME type in `['image/jpeg', 'image/png']` and size ≤ 10MB
    - Implement `fileToImageData(file: File): Promise<ImageData>` — reads file into canvas and extracts ImageData
    - _Requirements: 5.2_

  - [ ]* 4.6 Write property test for File upload validation
    - **Property 11: File Upload Validation** — File accepted iff MIME type is in `['image/jpeg', 'image/png']` AND size ≤ 10,485,760 bytes
    - **Validates: Requirements 5.2**

- [x] 5. Checkpoint - Ensure all pure module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement UI components
  - [x] 6.1 Implement ResponsivePreview component
    - Create `components/verification/responsive-preview.tsx`
    - Replace fixed `max-w-sm` with responsive sizing: desktop `width: clamp(640px, 80vw, 800px)`, mobile `width: calc(100vw - 48px)`
    - Enforce 3:2 aspect ratio via `aspect-ratio: 3/2` with `padding-bottom` fallback
    - Use `ResizeObserver` on container for resize adaptation
    - Include ID guide overlay (dashed border with corner markers)
    - Include glare warning overlay with message "Inclina el documento o ajusta la luz para reducir el reflejo"
    - Include ARIA live region (`aria-live="polite"`) for screen reader announcements
    - Provide `onFrameAvailable` callback that extracts ImageData from hidden canvas (downscaled to 320px for performance)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 5.4, 5.5_

  - [ ]* 6.2 Write property tests for ResponsivePreview sizing
    - **Property 1: Responsive Preview Sizing** — For any viewport width, computed preview width is: if viewport > 768 then clamp(640, viewport*0.8, 800); if viewport ≤ 768 then viewport - 48
    - **Property 2: Aspect Ratio Invariant** — For any computed width, height equals width × (2/3) within ±1px tolerance
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 6.3 Implement QualityFeedback component
    - Create `components/verification/quality-feedback.tsx`
    - Display remediation messages for each quality issue (blur, lighting, framing, glare)
    - Use `aria-live="polite"` region to announce warnings to assistive technologies
    - Show/hide within 200ms of detection state changes
    - _Requirements: 4.5, 5.4, 5.5_

  - [x] 6.4 Implement HandoffUI component
    - Create `components/verification/handoff-ui.tsx`
    - Generate and display QR code encoding the handoff URL with token
    - Show countdown timer (5 minutes) with visual progress
    - Display connection status (waiting → connected → completed)
    - Handle expiration with option to regenerate QR code
    - Include cancel button
    - Keyboard-navigable with visible focus indicators
    - _Requirements: 3.1, 3.6, 5.6_

  - [x] 6.5 Implement FallbackUpload component
    - Create `components/verification/fallback-upload.tsx`
    - File input accepting JPEG/PNG up to 10MB
    - Validate file using `validateFile()` from file-validator module
    - Convert uploaded file to ImageData and run through QualityAnalyzer
    - Display uploaded image in ResponsivePreview frame
    - Show remediation messages on quality failure, allow re-upload
    - Fully keyboard-navigable with visible focus indicators
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_

  - [x] 6.6 Implement StepIndicator component (extracted)
    - Create `components/verification/step-indicator.tsx`
    - Extract existing `StepIndicator` from page.tsx into standalone component
    - Extend to handle new BioState variants (handoff-active, handoff-expired, fallback-upload, id-quality-failed)
    - _Requirements: All (navigation clarity)_

- [x] 7. Checkpoint - Ensure component rendering tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate into BiometricVerificationCard
  - [x] 8.1 Refactor BiometricVerificationCard to use new modules and components
    - Update `BioState` type to include new variants: `id-streaming` with `glareDetected`, `id-quality-failed`, `handoff-active`, `handoff-expired`, `fallback-upload`
    - Replace inline `CameraPreview` with `ResponsivePreview` component
    - Replace inline `StepIndicator` with extracted component
    - Wire `QualityAnalyzer.analyzeFrame()` into `captureId()` — run quality checks before Tesseract OCR
    - Wire `detectGlare()` into real-time streaming loop via `onFrameAvailable` callback
    - Disable capture button when glare is detected (Req 2.4)
    - Add tooltip explaining why capture is blocked during glare
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.5, 4.6_

  - [x] 8.2 Integrate HandoffUI into BiometricVerificationCard
    - Add "Usar mi teléfono" button in `id-instructions` step when no rear camera detected
    - Transition to `handoff-active` state when user selects handoff
    - Render `HandoffUI` component during `handoff-active` state
    - On `HandoffResult` received, proceed with verification submission (same as local capture)
    - Handle `handoff-expired` state with regeneration option
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 8.3 Integrate FallbackUpload into BiometricVerificationCard
    - Detect camera unavailability (`NotAllowedError`, `NotFoundError`) and transition to `fallback-upload` state
    - Render `FallbackUpload` component during `fallback-upload` state
    - On successful upload + quality pass, run same face detection and MRZ pipeline as camera path
    - Handle `id-quality-failed` state with remediation messages and retry
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [x] 8.4 Add accessibility features to verification flow
    - Add `aria-live="polite"` regions for all quality warnings and status changes
    - Ensure all interactive elements (buttons, file input, QR regenerate) have visible focus indicators
    - Ensure logical tab order through the verification flow
    - Add appropriate `role` attributes to dynamic content areas
    - Announce glare/quality warnings to screen readers
    - _Requirements: 5.4, 5.5, 5.6_

- [x] 9. Checkpoint - Ensure integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write unit and integration tests
  - [ ]* 10.1 Write unit tests for BiometricVerificationCard integration
    - Test capture button disabled when glare detected (Req 2.4)
    - Test quality checks run before OCR invocation (Req 4.1)
    - Test all checks pass → OCR proceeds (Req 4.6)
    - Test fallback UI shown when no camera (Req 5.1)
    - Test same pipeline for upload and camera (Req 5.3)
    - Test ARIA live regions present (Req 5.4, 5.5)
    - Test keyboard navigation works (Req 5.6)
    - Test upload failure shows remediation + re-upload (Req 5.7)
    - _Requirements: 2.4, 4.1, 4.6, 5.1, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 10.2 Write unit tests for HandoffUI flow
    - Test QR code generation contains valid URL with token (Req 3.1)
    - Test desktop proceeds on valid handoff result (Req 3.5)
    - Test expired token shows message and allows regeneration (Req 3.6)
    - Test no biometric data in transmitted messages (Req 3.7)
    - _Requirements: 3.1, 3.5, 3.6, 3.7_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (11 properties across 10 test tasks)
- Unit tests validate specific examples and edge cases
- Pure modules (lib/verification/) have no React dependencies and can be tested in isolation
- All image processing remains client-side — only `{confidence, proof}` crosses the network
- The existing `@vladmandic/face-api`, `tesseract.js`, and `mrz` libraries are reused as-is

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.5", "2.7", "4.1", "4.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "2.8", "2.9", "4.2", "4.3", "4.6"] },
    { "id": 3, "tasks": ["2.10", "4.4", "6.6"] },
    { "id": 4, "tasks": ["6.1", "6.3", "6.4", "6.5"] },
    { "id": 5, "tasks": ["6.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 7, "tasks": ["10.1", "10.2"] }
  ]
}
```
