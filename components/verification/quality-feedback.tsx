"use client";

import { type QualityIssue, type QualityIssueType } from "@/lib/verification/types";

export interface QualityFeedbackProps {
  issues: QualityIssue[];
}

const issueConfig: Record<QualityIssueType, { icon: string; label: string }> = {
  blur: { icon: "◎", label: "Desenfoque" },
  lighting: { icon: "☀", label: "Iluminación" },
  framing: { icon: "⬚", label: "Encuadre" },
  glare: { icon: "✦", label: "Reflejo" },
};

export function QualityFeedback({ issues }: QualityFeedbackProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      role="status"
      className="space-y-2"
    >
      {issues.length > 0 && (
        <ul className="space-y-1.5 transition-opacity duration-200 ease-in-out">
          {issues.map((issue) => {
            const config = issueConfig[issue.type];
            return (
              <li
                key={issue.type}
                className="flex items-start gap-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger transition-all duration-200 ease-in-out"
              >
                <span className="shrink-0 text-base leading-5" aria-hidden="true">
                  {config.icon}
                </span>
                <span>
                  <span className="font-medium">{config.label}:</span>{" "}
                  {issue.message}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
