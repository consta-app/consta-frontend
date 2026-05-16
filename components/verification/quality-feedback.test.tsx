import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QualityFeedback } from "./quality-feedback";
import type { QualityIssue } from "@/lib/verification/types";

describe("QualityFeedback", () => {
  it("renders nothing visible when there are no issues", () => {
    const { container } = render(<QualityFeedback issues={[]} />);
    expect(container.querySelector("ul")).toBeNull();
  });

  it("renders remediation messages for each quality issue", () => {
    const issues: QualityIssue[] = [
      { type: "blur", message: "Mantén el dispositivo firme", severity: 0.7 },
      { type: "lighting", message: "Busca mejor iluminación", severity: 0.5 },
    ];
    render(<QualityFeedback issues={issues} />);

    expect(screen.getByText(/Mantén el dispositivo firme/)).toBeInTheDocument();
    expect(screen.getByText(/Busca mejor iluminación/)).toBeInTheDocument();
  });

  it("renders all four issue types correctly", () => {
    const issues: QualityIssue[] = [
      { type: "blur", message: "Mantén el dispositivo firme", severity: 0.7 },
      { type: "lighting", message: "Busca mejor iluminación", severity: 0.5 },
      { type: "framing", message: "Centra el documento dentro de la guía", severity: 0.6 },
      { type: "glare", message: "Inclina el documento o ajusta la luz para reducir el reflejo", severity: 0.8 },
    ];
    render(<QualityFeedback issues={issues} />);

    expect(screen.getByText(/Desenfoque:/)).toBeInTheDocument();
    expect(screen.getByText(/Iluminación:/)).toBeInTheDocument();
    expect(screen.getByText(/Encuadre:/)).toBeInTheDocument();
    expect(screen.getByText(/Reflejo:/)).toBeInTheDocument();
  });

  it("uses aria-live='polite' for screen reader announcements", () => {
    const { container } = render(<QualityFeedback issues={[]} />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it("has role='status' on the live region", () => {
    const { container } = render(<QualityFeedback issues={[]} />);
    const statusRegion = container.querySelector('[role="status"]');
    expect(statusRegion).toBeInTheDocument();
  });

  it("applies CSS transition classes for 200ms show/hide", () => {
    const issues: QualityIssue[] = [
      { type: "blur", message: "Mantén el dispositivo firme", severity: 0.7 },
    ];
    const { container } = render(<QualityFeedback issues={issues} />);
    const list = container.querySelector("ul");
    expect(list?.className).toContain("duration-200");
  });
});
