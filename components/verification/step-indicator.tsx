"use client";

import type { BioState } from "@/lib/verification/types";

function getStepIndex(state: BioState): number {
  switch (state.kind) {
    case "idle":
    case "loading-models":
    case "models-error":
      return 0;
    case "liveness":
    case "liveness-failed":
      return 1;
    case "id-instructions":
    case "id-streaming":
    case "id-quality-failed":
    case "handoff-active":
    case "handoff-expired":
    case "fallback-upload":
    case "id-error":
    case "validating-document":
    case "document-invalid":
      return 2;
    case "comparing":
    case "submitting":
    case "verified":
    case "no-match":
    case "submit-error":
      return 3;
  }
}

function getStepLabel(stepIndex: number): string {
  switch (stepIndex) {
    case 0:
      return "Preparado";
    case 1:
      return "Paso 1 · Vida";
    case 2:
      return "Paso 2 · Documento";
    case 3:
      return "Paso 3 · Comparación";
    default:
      return "";
  }
}

export function StepIndicator({ state }: { state: BioState }) {
  const stepIndex = getStepIndex(state);
  const dots = [1, 2, 3];

  return (
    <div className="flex items-center gap-2">
      {dots.map((n) => (
        <div key={n} className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              stepIndex >= n ? "bg-accent" : "bg-border-strong"
            }`}
          />
          {n < dots.length && (
            <span className="block h-px w-4 bg-border-strong" />
          )}
        </div>
      ))}
      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim">
        {getStepLabel(stepIndex)}
      </span>
    </div>
  );
}
