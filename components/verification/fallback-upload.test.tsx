import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FallbackUpload } from "./fallback-upload";

// Mock the file-validator module
vi.mock("@/lib/verification/file-validator", () => ({
  validateFile: vi.fn(),
  fileToImageData: vi.fn(),
}));

// Mock the quality-analyzer module
vi.mock("@/lib/verification/quality-analyzer", () => ({
  analyzeFrame: vi.fn(),
}));

import { validateFile, fileToImageData } from "@/lib/verification/file-validator";
import { analyzeFrame } from "@/lib/verification/quality-analyzer";

const mockValidateFile = vi.mocked(validateFile);
const mockFileToImageData = vi.mocked(fileToImageData);
const mockAnalyzeFrame = vi.mocked(analyzeFrame);

function createMockImageData(width = 100, height = 100): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    colorSpace: "srgb",
  } as ImageData;
}

function createMockFile(
  name = "test.jpg",
  type = "image/jpeg",
  size = 1024,
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe("FallbackUpload", () => {
  const defaultProps = {
    onFileSelected: vi.fn(),
    onRetry: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("renders the drop zone in idle state", () => {
    render(<FallbackUpload {...defaultProps} />);

    expect(
      screen.getByText("Arrastra una imagen aquí o haz clic para seleccionar"),
    ).toBeInTheDocument();
    expect(screen.getByText(/JPEG o PNG/)).toBeInTheDocument();
  });

  it("has a keyboard-navigable drop zone with visible focus indicators", () => {
    render(<FallbackUpload {...defaultProps} />);

    const dropZone = screen.getByRole("button", {
      name: /arrastra una imagen/i,
    });
    expect(dropZone).toHaveAttribute("tabindex", "0");
    expect(dropZone.className).toContain("focus-visible:ring-2");
  });

  it("shows error for invalid file type", async () => {
    mockValidateFile.mockReturnValue({ valid: false, error: "invalid-type" });

    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    const file = createMockFile("test.gif", "image/gif");

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Solo se aceptan archivos JPEG o PNG",
      );
    });
  });

  it("shows error for file too large", async () => {
    mockValidateFile.mockReturnValue({ valid: false, error: "too-large" });

    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    const file = createMockFile("big.jpg", "image/jpeg", 11 * 1024 * 1024);

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "El archivo excede el límite de 10MB",
      );
    });
  });

  it("calls onFileSelected when quality passes", async () => {
    const mockImageData = createMockImageData();
    mockValidateFile.mockReturnValue({ valid: true, file: createMockFile() });
    mockFileToImageData.mockResolvedValue(mockImageData);
    mockAnalyzeFrame.mockReturnValue({ passed: true, issues: [] });

    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    const file = createMockFile();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(defaultProps.onFileSelected).toHaveBeenCalledWith(mockImageData);
    });
  });

  it("shows quality issues and retry button when quality fails", async () => {
    const mockImageData = createMockImageData();
    mockValidateFile.mockReturnValue({ valid: true, file: createMockFile() });
    mockFileToImageData.mockResolvedValue(mockImageData);
    mockAnalyzeFrame.mockReturnValue({
      passed: false,
      issues: [
        { type: "blur", message: "Mantén el dispositivo firme", severity: 0.8 },
      ],
    });

    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    const file = createMockFile();

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /Mantén el dispositivo firme/,
      );
      expect(screen.getByText("Subir otra imagen")).toBeInTheDocument();
    });
  });

  it("calls onRetry and resets state when retry button is clicked", async () => {
    const mockImageData = createMockImageData();
    mockValidateFile.mockReturnValue({ valid: true, file: createMockFile() });
    mockFileToImageData.mockResolvedValue(mockImageData);
    mockAnalyzeFrame.mockReturnValue({
      passed: false,
      issues: [
        { type: "lighting", message: "Busca mejor iluminación", severity: 0.6 },
      ],
    });

    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByText("Subir otra imagen")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Subir otra imagen"));

    expect(defaultProps.onRetry).toHaveBeenCalled();
    expect(
      screen.getByText("Arrastra una imagen aquí o haz clic para seleccionar"),
    ).toBeInTheDocument();
  });

  it("shows processing state while analyzing", async () => {
    mockValidateFile.mockReturnValue({ valid: true, file: createMockFile() });
    // Make fileToImageData hang to observe processing state
    mockFileToImageData.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    fireEvent.change(input, { target: { files: [createMockFile()] } });

    await waitFor(() => {
      expect(screen.getByText("Analizando imagen…")).toBeInTheDocument();
    });
  });

  it("accepts custom acceptedTypes and maxSizeMB props", () => {
    render(
      <FallbackUpload
        {...defaultProps}
        acceptedTypes={["image/jpeg"]}
        maxSizeMB={5}
      />,
    );

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    expect(input).toHaveAttribute("accept", "image/jpeg");
    expect(screen.getByText(/Máximo 5MB/)).toBeInTheDocument();
  });

  it("displays externally provided qualityIssues", () => {
    render(
      <FallbackUpload
        {...defaultProps}
        qualityIssues={[
          { type: "framing", message: "Centra el documento dentro de la guía", severity: 0.5 },
        ]}
      />,
    );

    expect(
      screen.getByText(/Centra el documento dentro de la guía/),
    ).toBeInTheDocument();
  });

  it("has an ARIA live region for screen reader announcements", () => {
    render(<FallbackUpload {...defaultProps} />);

    // The component should have an aria-live region
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it("file input accepts only JPEG and PNG by default", () => {
    render(<FallbackUpload {...defaultProps} />);

    const input = screen.getByLabelText("Seleccionar archivo de imagen");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png");
  });
});
