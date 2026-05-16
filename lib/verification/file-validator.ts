// lib/verification/file-validator.ts
// File validation and image data extraction utilities for the verification pipeline.

import {
  FileValidation,
  ACCEPTED_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './types';

/**
 * Validates a file for acceptable MIME type and size.
 * Returns { valid: true, file } if the file passes, or { valid: false, error } otherwise.
 */
export function validateFile(file: File): FileValidation {
  if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
    return { valid: false, error: 'invalid-type' };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'too-large' };
  }

  return { valid: true, file };
}

/**
 * Reads a file into a canvas and extracts ImageData.
 * Uses DOM APIs: URL.createObjectURL, Image, Canvas.
 * Throws if the file cannot be read or drawn.
 */
export function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to get canvas 2D context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
        resolve(imageData);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from file'));
    };

    img.src = url;
  });
}
