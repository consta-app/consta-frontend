// lib/verification/types.ts
// Shared types and interfaces for the verification pipeline.

// ─── Quality Analysis ────────────────────────────────────────────────────────

export interface QualityCheckResult {
  passed: boolean;
  issues: QualityIssue[];
}

export type QualityIssueType = 'blur' | 'glare' | 'lighting' | 'framing';

export interface QualityIssue {
  type: QualityIssueType;
  message: string;
  severity: number; // 0–1 normalized
}

export interface QualityAnalyzerConfig {
  glare: {
    luminanceThreshold: number;
    areaPercentage: number;
  };
  blur: {
    laplacianVarianceThreshold: number;
  };
  lighting: {
    meanLuminanceThreshold: number;
  };
  framing: {
    edgeCoverageThreshold: number;
  };
}

export interface GuideRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Handoff ─────────────────────────────────────────────────────────────────

export interface HandoffToken {
  token: string; // 32-byte random, base64url-encoded
  createdAt: number; // Date.now()
  expiresAt: number; // createdAt + 300_000 (5 minutes)
  used: boolean;
}

export interface HandoffResult {
  confidence: number;
  proof: string;
}

export type HandoffStatus =
  | { kind: 'waiting' }
  | { kind: 'connected' }
  | { kind: 'completed'; result: HandoffResult }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export interface HandoffSessionState {
  token: HandoffToken;
  status: HandoffStatus;
  wsConnection: WebSocket | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

// ─── File Validation ─────────────────────────────────────────────────────────

export interface FileValidation {
  valid: boolean;
  error?: 'invalid-type' | 'too-large' | 'unreadable';
  file?: File;
  imageData?: ImageData;
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png'] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Default Config Thresholds ───────────────────────────────────────────────

export const DEFAULT_QUALITY_CONFIG: QualityAnalyzerConfig = {
  glare: {
    luminanceThreshold: 240,
    areaPercentage: 0.03,
  },
  blur: {
    laplacianVarianceThreshold: 100,
  },
  lighting: {
    meanLuminanceThreshold: 80,
  },
  framing: {
    edgeCoverageThreshold: 0.60,
  },
};

// ─── BioState ────────────────────────────────────────────────────────────────

export type LivenessChecks = { right: boolean; left: boolean; closer: boolean };

export type BioState =
  | { kind: 'idle' }
  | { kind: 'loading-models' }
  | { kind: 'models-error'; message: string }
  | { kind: 'liveness'; stage: 'right' | 'left' | 'closer'; checks: LivenessChecks }
  | { kind: 'liveness-failed' }
  | { kind: 'id-instructions'; ready: boolean }
  | { kind: 'id-streaming'; glareDetected: boolean }
  | { kind: 'id-quality-failed'; issues: QualityIssue[] }
  | { kind: 'id-error'; message: string }
  | { kind: 'handoff-active'; session?: HandoffSessionState }
  | { kind: 'handoff-expired' }
  | { kind: 'fallback-upload' }
  | { kind: 'validating-document'; message: string }
  | { kind: 'document-invalid'; message: string }
  | { kind: 'comparing' }
  | { kind: 'submitting' }
  | { kind: 'verified'; confidence: number }
  | { kind: 'no-match' }
  | { kind: 'submit-error'; message: string };
