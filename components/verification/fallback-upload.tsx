"use client";

import { useCallback, useRef, useState } from "react";
import { type QualityIssue, ACCEPTED_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/verification/types";
import { validateFile, fileToImageData } from "@/lib/verification/file-validator";
import { analyzeFrame } from "@/lib/verification/quality-analyzer";
import { QualityFeedback } from "./quality-feedback";
import { Button } from "@/components/ui";

export interface FallbackUploadProps {
  onFileSelected: (imageData: ImageData) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  qualityIssues?: QualityIssue[];
  onRetry: () => void;
}

type UploadState =
  | { kind: "idle" }
  | { kind: "processing" }
  | { kind: "preview"; objectUrl: string; imageData: ImageData }
  | { kind: "quality-failed"; objectUrl: string; issues: QualityIssue[] }
  | { kind: "error"; message: string };

export function FallbackUpload({
  onFileSelected,
  acceptedTypes = [...ACCEPTED_TYPES],
  maxSizeMB = MAX_FILE_SIZE_BYTES / (1024 * 1024),
  qualityIssues,
  onRetry,
}: FallbackUploadProps) {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be re-selected
      e.target.value = "";

      // Validate file type and size
      const validation = validateFile(file);
      if (!validation.valid) {
        const message =
          validation.error === "invalid-type"
            ? "Solo se aceptan archivos JPEG o PNG"
            : validation.error === "too-large"
              ? "El archivo excede el límite de 10MB"
              : "No se pudo leer el archivo. Intenta con otro.";
        setState({ kind: "error", message });
        return;
      }

      setState({ kind: "processing" });

      try {
        // Convert file to ImageData
        const imageData = await fileToImageData(file);

        // Create object URL for preview
        revokeObjectUrl();
        const objectUrl = URL.createObjectURL(file);
        objectUrlRef.current = objectUrl;

        // Run quality analysis on the entire uploaded image.
        // Framing detection is disabled for uploads — the user already framed
        // the shot, and the document typically fills the whole image.
        const guideRect = {
          x: 0,
          y: 0,
          width: imageData.width,
          height: imageData.height,
        };

        const result = analyzeFrame(imageData, guideRect, {
          framing: { edgeCoverageThreshold: 0 },
        });

        if (result.passed) {
          setState({ kind: "preview", objectUrl, imageData });
          onFileSelected(imageData);
        } else {
          setState({ kind: "quality-failed", objectUrl, issues: result.issues });
        }
      } catch {
        setState({
          kind: "error",
          message: "No se pudo leer el archivo. Intenta con otro.",
        });
      }
    },
    [onFileSelected, revokeObjectUrl],
  );

  const handleRetry = useCallback(() => {
    revokeObjectUrl();
    setState({ kind: "idle" });
    onRetry();
    // Focus the file input for keyboard users
    fileInputRef.current?.focus();
  }, [onRetry, revokeObjectUrl]);

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDropZoneKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file && fileInputRef.current) {
        // Create a synthetic change event by setting files on the input
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
    },
    [],
  );

  // Determine which issues to display (prop-provided or from state)
  const displayIssues =
    qualityIssues ??
    (state.kind === "quality-failed" ? state.issues : []);

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Seleccionar archivo de imagen"
        tabIndex={-1}
      />

      {/* Drop zone / upload trigger */}
      {(state.kind === "idle" || state.kind === "error") && (
        <div
          role="button"
          tabIndex={0}
          onClick={handleDropZoneClick}
          onKeyDown={handleDropZoneKeyDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          aria-label="Arrastra una imagen o haz clic para seleccionar"
          className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border-strong bg-bg-elevated px-6 py-10 text-center transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg cursor-pointer"
        >
          <span className="text-3xl" aria-hidden="true">
            📄
          </span>
          <p className="text-sm text-text-muted">
            Arrastra una imagen aquí o haz clic para seleccionar
          </p>
          <p className="text-xs text-text-dim">
            JPEG o PNG · Máximo {maxSizeMB}MB
          </p>
        </div>
      )}

      {/* Processing state */}
      {state.kind === "processing" && (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border bg-bg-elevated px-6 py-10">
          <span className="inline-block h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="font-mono text-sm text-text-muted">
            Analizando imagen…
          </span>
        </div>
      )}

      {/* Preview (quality passed) */}
      {state.kind === "preview" && (
        <div className="space-y-3">
          <div className="relative mx-auto overflow-hidden rounded-lg border border-accent/40 bg-bg-elevated">
            <img
              src={state.objectUrl}
              alt="Imagen del documento subido"
              className="w-full rounded-lg"
            />
          </div>
          <p className="text-center text-xs text-accent font-mono uppercase tracking-wider">
            ✓ Imagen aceptada
          </p>
        </div>
      )}

      {/* Preview with quality failure */}
      {state.kind === "quality-failed" && (
        <div className="space-y-3">
          <div className="relative mx-auto overflow-hidden rounded-lg border border-danger/40 bg-bg-elevated">
            <img
              src={state.objectUrl}
              alt="Imagen del documento subido con problemas de calidad"
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {state.kind === "error" && (
        <div
          role="alert"
          className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.message}
        </div>
      )}

      {/* Quality feedback messages */}
      {displayIssues.length > 0 && (
        <QualityFeedback issues={displayIssues} />
      )}

      {/* Retry button for quality failure or error */}
      {(state.kind === "quality-failed" || state.kind === "error") && (
        <Button
          onClick={handleRetry}
          variant="secondary"
          className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Subir otra imagen
        </Button>
      )}

      {/* ARIA live region for status announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {state.kind === "processing" && "Analizando imagen subida"}
        {state.kind === "preview" && "Imagen aceptada, calidad verificada"}
        {state.kind === "quality-failed" &&
          `Imagen con problemas de calidad: ${displayIssues.map((i) => i.message).join(". ")}`}
        {state.kind === "error" &&
          (state as Extract<UploadState, { kind: "error" }>).message}
      </div>
    </div>
  );
}
