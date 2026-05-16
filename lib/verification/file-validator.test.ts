// lib/verification/file-validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateFile } from './file-validator';
import { MAX_FILE_SIZE_BYTES } from './types';

describe('validateFile', () => {
  it('accepts a valid JPEG file under 10MB', () => {
    const file = new File(['x'.repeat(1000)], 'photo.jpg', { type: 'image/jpeg' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.file).toBe(file);
    expect(result.error).toBeUndefined();
  });

  it('accepts a valid PNG file under 10MB', () => {
    const file = new File(['x'.repeat(1000)], 'photo.png', { type: 'image/png' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.file).toBe(file);
  });

  it('rejects a file with invalid MIME type', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid-type');
    expect(result.file).toBeUndefined();
  });

  it('rejects a GIF file', () => {
    const file = new File(['x'], 'anim.gif', { type: 'image/gif' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid-type');
  });

  it('rejects a file exceeding 10MB', () => {
    const largeContent = new ArrayBuffer(MAX_FILE_SIZE_BYTES + 1);
    const file = new File([largeContent], 'big.jpg', { type: 'image/jpeg' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('too-large');
  });

  it('accepts a file exactly at 10MB', () => {
    const content = new ArrayBuffer(MAX_FILE_SIZE_BYTES);
    const file = new File([content], 'exact.png', { type: 'image/png' });
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.file).toBe(file);
  });

  it('rejects a file with empty MIME type', () => {
    const file = new File(['x'], 'noext', { type: '' });
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid-type');
  });
});

// Note: fileToImageData relies on DOM APIs (Image, Canvas, URL.createObjectURL)
// that jsdom does not fully support. It should be tested in a browser/integration
// environment rather than unit tests.
