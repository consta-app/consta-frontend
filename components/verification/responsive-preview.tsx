"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QualityIssue, GuideRect } from "@/lib/verification/types";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ResponsivePreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  showIdGuide?: boolean;
  mirrored?: boolean;
  glareDetected?: boolean;
  glareMessage?: string;
  qualityIssues?: QualityIssue[];
  onFrameAvailable?: (imageData: ImageData, guideRect: GuideRect) => void;
  ariaLiveMessage?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Downscaled canvas width for frame extraction (performance). */
const FRAME_CANVAS_WIDTH = 320;

/** Guide rect inset as a fraction of the container dimensions. */
const GUIDE_INSET_FRACTION = 0.08;

/** Breakpoint for desktop vs mobile sizing. */
const DESKTOP_BREAKPOINT = 768;

// ─── Responsive width computation ───────────────────────────────────────────

/**
 * Computes the preview width based on viewport width.
 * Desktop (> 768px): clamp(640px, 80vw, 800px)
 * Mobile (≤ 768px): viewport - 48px
 */
function computePreviewWidth(viewportWidth: number): number {
  if (viewportWidth > DESKTOP_BREAKPOINT) {
    return Math.min(800, Math.max(640, viewportWidth * 0.8));
  }
  return viewportWidth - 48;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ResponsivePreview({
  videoRef,
  showIdGuide = false,
  mirrored = false,
  glareDetected = false,
  glareMessage = "Inclina el documento o ajusta la luz para reducir el reflejo",
  qualityIssues = [],
  onFrameAvailable,
  ariaLiveMessage,
}: ResponsivePreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [previewWidth, setPreviewWidth] = useState<number>(0);

  // ─── ResizeObserver for container resize adaptation ──────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial measurement
    setPreviewWidth(computePreviewWidth(window.innerWidth));

    const observer = new ResizeObserver(() => {
      setPreviewWidth(computePreviewWidth(window.innerWidth));
    });

    observer.observe(container);

    // Also listen to window resize for viewport changes
    const handleResize = () => {
      setPreviewWidth(computePreviewWidth(window.innerWidth));
    };
    window.addEventListener("resize", handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ─── Frame extraction loop ───────────────────────────────────────────────

  const extractFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !onFrameAvailable) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const aspectRatio = video.videoWidth / video.videoHeight;
    const canvasWidth = FRAME_CANVAS_WIDTH;
    const canvasHeight = Math.round(canvasWidth / aspectRatio);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

    // Compute guide rect on the downscaled canvas
    const insetX = Math.round(canvasWidth * GUIDE_INSET_FRACTION);
    const insetY = Math.round(canvasHeight * GUIDE_INSET_FRACTION);
    const guideRect: GuideRect = {
      x: insetX,
      y: insetY,
      width: canvasWidth - insetX * 2,
      height: canvasHeight - insetY * 2,
    };

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    onFrameAvailable(imageData, guideRect);
  }, [videoRef, onFrameAvailable]);

  useEffect(() => {
    if (!onFrameAvailable) return;

    const tick = () => {
      extractFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [extractFrame, onFrameAvailable]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative mx-auto"
      style={{
        width: previewWidth > 0 ? `${previewWidth}px` : undefined,
        maxWidth: "100%",
        aspectRatio: "3 / 2",
      }}
      data-testid="responsive-preview"
    >
      {/* Fallback padding-bottom for older browsers without aspect-ratio support */}
      <div
        className="relative h-0 w-full overflow-hidden rounded-lg"
        style={{
          paddingBottom: "66.667%", /* 2/3 = 0.6667 for 3:2 aspect ratio */
          aspectRatio: "3 / 2",
          height: "auto",
        }}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full rounded-lg border border-border bg-bg object-cover"
          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
        />

        {/* ID guide overlay with dashed border and corner markers */}
        {showIdGuide && (
          <div
            className="pointer-events-none absolute rounded border-2 border-dashed border-accent"
            style={{
              top: "8%",
              left: "8%",
              right: "8%",
              bottom: "8%",
            }}
            aria-hidden="true"
          >
            {/* Corner markers — larger than original CameraPreview */}
            <span className="absolute -top-1 -left-1 h-5 w-5 border-t-2 border-l-2 border-accent" />
            <span className="absolute -top-1 -right-1 h-5 w-5 border-t-2 border-r-2 border-accent" />
            <span className="absolute -bottom-1 -left-1 h-5 w-5 border-b-2 border-l-2 border-accent" />
            <span className="absolute -bottom-1 -right-1 h-5 w-5 border-b-2 border-r-2 border-accent" />
          </div>
        )}

        {/* Glare warning overlay — appears/disappears within 200ms via CSS transition */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-end justify-center rounded-lg transition-opacity duration-200 ${
            glareDetected ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!glareDetected}
        >
          <div className="mb-4 rounded-md bg-black/75 px-4 py-2 text-center text-sm text-white backdrop-blur-sm">
            <span className="mr-2" aria-hidden="true">⚠️</span>
            {glareMessage}
          </div>
        </div>
      </div>

      {/* Hidden canvas for frame extraction (downscaled to 320px) */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* ARIA live region for screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {ariaLiveMessage}
      </div>
    </div>
  );
}
