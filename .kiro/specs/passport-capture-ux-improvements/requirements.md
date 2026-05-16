# Requirements Document

## Introduction

The passport capture step in the biometric verification flow currently uses a fixed `max-w-sm` (~384px) preview area, provides no feedback about image quality before OCR, and offers no alternative for desktop users who lack a rear-facing camera. This feature improves the capture experience by enlarging the preview responsively, detecting glare and other quality issues in real time, offering a mobile handoff path for desktop users, and ensuring accessibility when no camera is available.

Privacy constraint: all image processing remains local. Only the final `{confidence, proof}` hash is transmitted to the backend.

## Glossary

- **Capture_Preview**: The video element and surrounding guide overlay where the user positions their passport during the `id-streaming` step.
- **Quality_Analyzer**: A client-side module that evaluates captured frames for blur, glare, framing, and lighting before MRZ OCR is attempted.
- **Glare_Detector**: A sub-component of the Quality_Analyzer that identifies specular highlights (high-luminance regions) on the passport surface.
- **Mobile_Handoff**: A mechanism that allows a desktop session to delegate passport capture to a mobile device via a QR code and short-lived session token.
- **Handoff_Session**: A short-lived, single-use session created on the desktop that the mobile device joins to perform capture and comparison.
- **MRZ**: Machine Readable Zone — the two lines of OCR-B characters at the bottom of a passport data page.
- **Pre_OCR_Check**: The set of quality validations (blur, glare, framing, lighting) run on a frame before Tesseract OCR is invoked.
- **Fallback_Upload**: A manual file-upload path available when camera access is denied or unavailable.

## Requirements

### Requirement 1: Responsive Passport Capture Preview

**User Story:** As a user verifying my identity, I want the passport capture area to be large enough to clearly see my document, so that I can position it accurately and reduce failed captures.

#### Acceptance Criteria

1. WHEN the `id-streaming` step is active on a viewport wider than 768px, THE Capture_Preview SHALL render at a minimum width of 640px and a maximum width of 800px.
2. WHEN the `id-streaming` step is active on a viewport of 768px or narrower, THE Capture_Preview SHALL expand to fill the available viewport width minus horizontal padding of 24px on each side.
3. THE Capture_Preview SHALL maintain a 3:2 aspect ratio matching the passport data page proportions.
4. WHEN the viewport is resized while the `id-streaming` step is active, THE Capture_Preview SHALL adapt its dimensions within 100ms without interrupting the video stream.

### Requirement 2: Real-Time Glare Detection with User Guidance

**User Story:** As a user capturing my passport, I want to be warned when there is glare on the document, so that I can adjust the angle or lighting before capturing.

#### Acceptance Criteria

1. WHILE the `id-streaming` step is active, THE Glare_Detector SHALL analyze each video frame for specular highlights by identifying contiguous regions where pixel luminance exceeds 240 (on a 0–255 scale) covering more than 3% of the document guide area.
2. WHEN the Glare_Detector identifies glare, THE Capture_Preview SHALL display a visible warning overlay with the message "Inclina el documento o ajusta la luz para reducir el reflejo" within 200ms of detection.
3. WHEN glare is no longer detected, THE Capture_Preview SHALL remove the warning overlay within 200ms.
4. WHILE glare is detected, THE Capture_Preview SHALL disable the capture button and display a tooltip explaining why capture is blocked.
5. THE Glare_Detector SHALL perform analysis using only the pixels within the document guide rectangle, not the full video frame.

### Requirement 3: Mobile Handoff for Desktop Users

**User Story:** As a desktop user without a rear-facing camera, I want to use my phone to capture the passport and complete the comparison on the phone, so that I can still verify my identity without a document scanner.

#### Acceptance Criteria

1. WHEN the `id-instructions` step is active on a device without a rear-facing camera or when the user selects "Usar mi teléfono", THE System SHALL generate a QR code encoding a URL with a short-lived Handoff_Session token.
2. THE Handoff_Session token SHALL expire after 5 minutes or after a single successful use, whichever comes first.
3. WHEN the mobile device scans the QR code and opens the URL, THE System SHALL present the liveness check and passport capture flow on the mobile device.
4. THE mobile device SHALL perform the face embedding comparison locally and transmit only `{confidence, proof}` back to the desktop session.
5. WHEN the desktop session receives a valid `{confidence, proof}` result from the Handoff_Session, THE System SHALL proceed with the verification submission as if the capture occurred locally.
6. IF the Handoff_Session token expires before the mobile device completes capture, THEN THE System SHALL display an expiration message on both devices and allow the desktop user to generate a new QR code.
7. THE System SHALL transmit no biometric data, passport images, or face embeddings between the mobile device and the desktop session.

### Requirement 4: Pre-OCR Quality Feedback

**User Story:** As a user capturing my passport, I want to receive feedback about image quality before OCR is attempted, so that I can correct issues and avoid repeated failed captures.

#### Acceptance Criteria

1. WHEN the user presses the capture button, THE Quality_Analyzer SHALL evaluate the captured frame for blur, lighting, and framing before invoking Tesseract OCR.
2. THE Quality_Analyzer SHALL detect blur by computing the variance of the Laplacian of the grayscale image within the document guide area; a variance below 100 SHALL be classified as blurry.
3. THE Quality_Analyzer SHALL detect insufficient lighting by computing the mean luminance of the document guide area; a mean below 80 (on a 0–255 scale) SHALL be classified as too dark.
4. THE Quality_Analyzer SHALL detect framing issues by verifying that the document guide area contains a rectangular region with edges detectable via a Canny edge filter occupying at least 60% of the guide perimeter.
5. IF the Quality_Analyzer detects one or more quality issues, THEN THE System SHALL display specific remediation messages for each issue (blur: "Mantén el dispositivo firme"; lighting: "Busca mejor iluminación"; framing: "Centra el documento dentro de la guía") and SHALL NOT invoke Tesseract OCR.
6. WHEN all quality checks pass, THE System SHALL proceed to invoke Tesseract OCR on the captured frame.
7. THE Quality_Analyzer SHALL complete all checks within 500ms on a mid-range device (equivalent to a 2020 smartphone with 4GB RAM).

### Requirement 5: Accessibility and Camera Fallback

**User Story:** As a user who cannot access a camera (due to hardware limitations, browser restrictions, or disability), I want an alternative way to provide my passport image, so that I am not excluded from the verification process.

#### Acceptance Criteria

1. IF the browser reports no available video input devices or camera permission is denied, THEN THE System SHALL display the Fallback_Upload interface instead of the camera preview.
2. THE Fallback_Upload interface SHALL accept image files in JPEG or PNG format with a maximum file size of 10MB.
3. WHEN a file is uploaded via Fallback_Upload, THE System SHALL run the same Quality_Analyzer checks and face detection pipeline as the camera capture path.
4. THE Capture_Preview and all quality feedback messages SHALL be compatible with screen readers by using appropriate ARIA live regions and role attributes.
5. WHEN the Glare_Detector or Quality_Analyzer displays a warning, THE System SHALL announce the warning text to assistive technologies via an `aria-live="polite"` region.
6. THE capture button and all interactive elements in the verification flow SHALL be operable via keyboard navigation with visible focus indicators.
7. IF the Fallback_Upload image fails quality checks, THEN THE System SHALL display the same remediation messages as the camera path and allow the user to upload a new image.
