/**
 * Image Processing Engine
 * Handles client-side image decoding, dimension extraction, thumbnail generation, and file hash computation.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

export const SUPPORTED_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

/**
 * Validates if a MIME type or file extension is supported.
 */
export function isSupportedImageType(file: File | { type: string; name?: string }): boolean {
  if (file.type && SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType)) {
    return true;
  }
  if (file.name) {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    return SUPPORTED_FILE_EXTENSIONS.includes(ext as (typeof SUPPORTED_FILE_EXTENSIONS)[number]);
  }
  return false;
}

/**
 * Resolves normalized MIME type from file or filename.
 */
export function resolveMimeType(file: File): string {
  if (file.type && SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType)) {
    return file.type;
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return file.type || 'application/octet-stream';
}

/**
 * Extracts natural image dimensions (width and height) safely.
 * Rejects corrupt or unreadable files.
 */
export async function extractDimensions(file: File | Blob): Promise<ImageDimensions> {
  // Method 1: Use createImageBitmap if available in modern browsers / Android
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = {
        width: bitmap.width,
        height: bitmap.height,
      };
      bitmap.close();
      if (dimensions.width > 0 && dimensions.height > 0) {
        return dimensions;
      }
    } catch {
      // Fallback to HTMLImageElement below if createImageBitmap encounters an issue
    }
  }

  // Method 2: HTMLImageElement decode fallback
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const dimensions = {
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      };
      URL.revokeObjectURL(objectUrl);
      if (dimensions.width > 0 && dimensions.height > 0) {
        resolve(dimensions);
      } else {
        reject(new Error('Image has zero or invalid dimensions'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image data. File may be corrupted or unreadable.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Generates a lightweight, memory-efficient thumbnail blob / object URL.
 * Keeps memory footprint small on tablet devices by capping max dimension (default 320px).
 */
export async function generateThumbnailBlob(
  file: File | Blob,
  maxDimension = 320
): Promise<Blob> {
  const dimensions = await extractDimensions(file);
  const { width, height } = dimensions;

  let targetWidth = width;
  let targetHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      targetWidth = maxDimension;
      targetHeight = Math.round((height * maxDimension) / width);
    } else {
      targetHeight = maxDimension;
      targetWidth = Math.round((width * maxDimension) / height);
    }
  }

  // Use OffscreenCanvas if available, otherwise DOM canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        const bitmap = await createImageBitmap(file);
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        bitmap.close();
        const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.8 });
        return blob;
      }
    } catch {
      // fallback to DOM canvas
    }
  }

  // DOM Canvas fallback
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not get 2D canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail blob'));
          }
        },
        'image/webp',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image for thumbnail generation'));
    };

    img.src = objectUrl;
  });
}

/**
 * Computes a fast asynchronous cryptographic or partial hash for duplicate detection.
 * Samples head, tail, and size for rapid processing of large manhwa chapter files.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // For files <= 2MB, hash entire buffer; for larger files, sample head + tail + size for speed
      const buffer =
        file.size <= 2 * 1024 * 1024
          ? await file.arrayBuffer()
          : await (async () => {
              const head = await file.slice(0, 64 * 1024).arrayBuffer();
              const tail = await file.slice(Math.max(0, file.size - 64 * 1024)).arrayBuffer();
              const combined = new Uint8Array(head.byteLength + tail.byteLength + 8);
              combined.set(new Uint8Array(head), 0);
              combined.set(new Uint8Array(tail), head.byteLength);
              // append size
              const sizeView = new DataView(combined.buffer, head.byteLength + tail.byteLength, 8);
              sizeView.setFloat64(0, file.size);
              return combined.buffer;
            })();

      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Fallback: file size + name signature
  }

  const name = 'name' in file ? (file as File).name : 'blob';
  return `hash_${name}_${file.size}_${file.type}`;
}
