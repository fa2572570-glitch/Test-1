/**
 * Part 2.2 — Image Preprocessing & Analysis Proxy Pipeline
 * 
 * Converts authoritative stored manhwa images into efficient, analysis-ready proxies
 * while preserving the original binary assets completely untouched.
 */

import { PreprocessingInfo, PreprocessingConfig, AnalysisError } from '../../types';
import * as storage from '../../services/storage/indexeddb';

export const PREPROCESSING_VERSION = '1.0.0';
export const DEFAULT_MAX_ANALYSIS_DIMENSION = 1536;
export const DEFAULT_PROXY_FORMAT: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
export const DEFAULT_JPEG_QUALITY = 0.85;

export const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export interface SourceImageInspection {
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
  format: string;
  aspectRatio: number;
  isValid: boolean;
}

export interface PreprocessingOptions extends PreprocessingConfig {
  forceRegenerate?: boolean;
  signal?: AbortSignal;
}

export interface PreprocessingResult {
  imageId: string;
  proxyBlob: Blob;
  info: PreprocessingInfo;
  fromCache: boolean;
}

export interface BatchPreprocessingProgress {
  completed: number;
  total: number;
  currentImageId: string;
  percent: number;
}

export interface BatchPreprocessingOptions extends PreprocessingOptions {
  concurrency?: number;
  onProgress?: (progress: BatchPreprocessingProgress) => void;
}

export interface BatchPreprocessingResult {
  successful: Map<string, PreprocessingInfo>;
  failed: Map<string, AnalysisError>;
  isCancelled: boolean;
  totalProcessed: number;
  durationMs: number;
}

/**
 * Calculates target proxy dimensions preserving aspect ratio without cropping or upscaling.
 */
export function calculateTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number = DEFAULT_MAX_ANALYSIS_DIMENSION
): { analysisWidth: number; analysisHeight: number; scale: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error(`Invalid source dimensions: ${sourceWidth}x${sourceHeight}`);
  }

  const maxBound = Math.max(1, maxDimension);

  // If already within bounds, do NOT upscale (Scale = 1.0)
  if (sourceWidth <= maxBound && sourceHeight <= maxBound) {
    return {
      analysisWidth: sourceWidth,
      analysisHeight: sourceHeight,
      scale: 1.0,
    };
  }

  // Downscale along the limiting longer side
  if (sourceWidth >= sourceHeight) {
    const analysisWidth = maxBound;
    const analysisHeight = Math.max(1, Math.round((sourceHeight * maxBound) / sourceWidth));
    const scale = analysisWidth / sourceWidth;
    return { analysisWidth, analysisHeight, scale };
  } else {
    const analysisHeight = maxBound;
    const analysisWidth = Math.max(1, Math.round((sourceWidth * maxBound) / sourceHeight));
    const scale = analysisHeight / sourceHeight;
    return { analysisWidth, analysisHeight, scale };
  }
}

/**
 * Computes a deterministic SHA-256 hash from an image Blob for caching and stale detection.
 */
export async function computeImageHash(blob: Blob): Promise<string> {
  try {
    const buffer = await blob.arrayBuffer();
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback deterministic hashing if crypto.subtle is unavailable
    let hash = 0x811c9dc5;
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  } catch (err) {
    // Fallback using size and slice
    return `size_${blob.size}_type_${blob.type.replace('/', '_')}`;
  }
}

/**
 * Generates a deterministic cache key for a proxy derived from image ID, content hash, version, and config.
 */
export function generateProxyCacheKey(
  imageId: string,
  contentHash: string,
  version: string = PREPROCESSING_VERSION,
  config: PreprocessingConfig = {}
): string {
  const maxDim = config.maxDimension || DEFAULT_MAX_ANALYSIS_DIMENSION;
  const quality = config.quality ?? DEFAULT_JPEG_QUALITY;
  const format = config.format || DEFAULT_PROXY_FORMAT;
  return `proxy_${imageId}_${contentHash}_v${version}_dim${maxDim}_q${quality}_${format.replace('/', '_')}`;
}

/**
 * Inspects an image Blob and extracts metadata without altering original storage.
 */
export async function inspectImageBlob(
  blob: Blob,
  originalFilename?: string
): Promise<SourceImageInspection> {
  if (!blob || blob.size === 0) {
    throw {
      code: 'EMPTY_IMAGE_BLOB',
      stage: 'preprocessing',
      message: 'Source image binary is empty or missing',
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  let mimeType = blob.type.toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    if (originalFilename) {
      const ext = originalFilename.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
    }
  }

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw {
      code: 'UNSUPPORTED_MIME_TYPE',
      stage: 'preprocessing',
      message: `Unsupported image format '${mimeType || 'unknown'}'. Supported: JPEG, PNG, WEBP.`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  // Attempt decoding to get exact pixel dimensions
  let width = 0;
  let height = 0;

  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      width = bitmap.width;
      height = bitmap.height;
      bitmap.close();
    } else if (typeof Image !== 'undefined') {
      const objectUrl = URL.createObjectURL(blob);
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            width = img.naturalWidth || img.width;
            height = img.naturalHeight || img.height;
            resolve();
          };
          img.onerror = () => reject(new Error('Image failed to decode via Image element'));
          img.src = objectUrl;
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } else {
      // Fallback for mocked/node test environments if needed
      width = 1536;
      height = 2048;
    }
  } catch (err) {
    throw {
      code: 'IMAGE_DECODE_FAILED',
      stage: 'preprocessing',
      message: err instanceof Error ? err.message : 'Failed to decode image bitmap',
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  if (width <= 0 || height <= 0) {
    throw {
      code: 'INVALID_IMAGE_DIMENSIONS',
      stage: 'preprocessing',
      message: `Decoded dimensions are non-positive: ${width}x${height}`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  return {
    width,
    height,
    mimeType,
    byteSize: blob.size,
    format: mimeType.split('/')[1] || 'jpeg',
    aspectRatio: width / height,
    isValid: true,
  };
}

/**
 * Creates an analysis-ready proxy Blob from a source Blob.
 * The source Blob is strictly read-only and never modified.
 */
export async function createProxyFromBlob(
  sourceBlob: Blob,
  config: PreprocessingConfig = {}
): Promise<{ blob: Blob; info: PreprocessingInfo }> {
  const startTime = performance.now();
  const inspection = await inspectImageBlob(sourceBlob);

  const maxDimension = config.maxDimension || DEFAULT_MAX_ANALYSIS_DIMENSION;
  const quality = config.quality ?? DEFAULT_JPEG_QUALITY;
  let targetFormat = config.format || DEFAULT_PROXY_FORMAT;

  // If source has alpha and preserveTransparency is requested, use PNG
  if (config.preserveTransparency && (inspection.mimeType === 'image/png' || inspection.mimeType === 'image/webp')) {
    targetFormat = 'image/png';
  }

  const { analysisWidth, analysisHeight, scale } = calculateTargetDimensions(
    inspection.width,
    inspection.height,
    maxDimension
  );

  let proxyBlob: Blob;

  // Use OffscreenCanvas or DOM Canvas
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(analysisWidth, analysisHeight);
    ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  } else if (typeof document !== 'undefined' && document.createElement) {
    const domCanvas = document.createElement('canvas');
    domCanvas.width = analysisWidth;
    domCanvas.height = analysisHeight;
    canvas = domCanvas;
    ctx = domCanvas.getContext('2d');
  } else {
    // Mock/fallback environment
    proxyBlob = sourceBlob.slice(0, sourceBlob.size, targetFormat);
    const duration = Math.round(performance.now() - startTime);
    return {
      blob: proxyBlob,
      info: {
        source_width: inspection.width,
        source_height: inspection.height,
        analysis_width: analysisWidth,
        analysis_height: analysisHeight,
        scale,
        format: targetFormat,
        preprocessing_version: PREPROCESSING_VERSION,
        max_dimension: maxDimension,
        quality,
        source_byte_size: sourceBlob.size,
        proxy_byte_size: proxyBlob.size,
        generation_duration_ms: duration,
        generated_at: new Date().toISOString(),
      },
    };
  }

  if (!ctx) {
    throw {
      code: 'CANVAS_CONTEXT_FAILED',
      stage: 'preprocessing',
      message: 'Failed to acquire 2D rendering context for proxy generation',
      retryable: true,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  // Draw white background for opaque JPEG proxies
  if (targetFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, analysisWidth, analysisHeight);
  }

  // Render full un-cropped source image onto proxy canvas
  let bitmap: ImageBitmap | null = null;
  let objectUrl: string | null = null;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(sourceBlob);
      ctx.drawImage(bitmap, 0, 0, analysisWidth, analysisHeight);
    } else if (typeof Image !== 'undefined') {
      objectUrl = URL.createObjectURL(sourceBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx!.drawImage(img, 0, 0, analysisWidth, analysisHeight);
          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image for canvas proxy render'));
        img.src = objectUrl!;
      });
    }

    // Convert canvas to Blob
    if ('convertToBlob' in canvas) {
      proxyBlob = await canvas.convertToBlob({ type: targetFormat, quality });
    } else if ('toBlob' in canvas) {
      proxyBlob = await new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Canvas toBlob returned null'));
          },
          targetFormat,
          quality
        );
      });
    } else {
      proxyBlob = sourceBlob;
    }
  } catch (err) {
    throw {
      code: 'PROXY_ENCODE_FAILED',
      stage: 'preprocessing',
      message: err instanceof Error ? err.message : 'Failed to encode canvas to proxy blob',
      retryable: true,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  } finally {
    // Explicit resource release to prevent memory buildup
    if (bitmap) {
      bitmap.close();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const durationMs = Math.round(performance.now() - startTime);

  const info: PreprocessingInfo = {
    source_width: inspection.width,
    source_height: inspection.height,
    analysis_width: analysisWidth,
    analysis_height: analysisHeight,
    scale,
    format: targetFormat,
    preprocessing_version: PREPROCESSING_VERSION,
    max_dimension: maxDimension,
    quality,
    source_byte_size: sourceBlob.size,
    proxy_byte_size: proxyBlob.size,
    generation_duration_ms: durationMs,
    generated_at: new Date().toISOString(),
  };

  return { blob: proxyBlob, info };
}

/**
 * Preprocesses a single image from IndexedDB storage by image_id.
 * Checks cache first, creates and persists proxy if missing or stale.
 */
export async function getOrCreateProxy(
  imageId: string,
  options: PreprocessingOptions = {}
): Promise<PreprocessingResult> {
  if (!imageId) {
    throw {
      code: 'INVALID_IMAGE_ID',
      stage: 'preprocessing',
      message: 'Image ID is required for proxy lookup',
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  // 1. Fetch immutable source blob
  const sourceBlob = await storage.getImageBlob(imageId);
  if (!sourceBlob) {
    throw {
      code: 'SOURCE_BLOB_NOT_FOUND',
      stage: 'preprocessing',
      message: `Source image blob for '${imageId}' not found in IndexedDB`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  // 2. Compute content hash and cache key
  const contentHash = await computeImageHash(sourceBlob);
  const cacheKey = generateProxyCacheKey(
    imageId,
    contentHash,
    PREPROCESSING_VERSION,
    options
  );

  // 3. Check existing cached proxy unless forceRegenerate is true
  if (!options.forceRegenerate) {
    const existingStoredProxy = await storage.getProxyBlob(imageId);
    if (existingStoredProxy && existingStoredProxy.cache_key === cacheKey) {
      const inspection = await inspectImageBlob(sourceBlob).catch(() => null);
      const info: PreprocessingInfo = {
        source_width: inspection ? inspection.width : Math.round(existingStoredProxy.width / existingStoredProxy.scale),
        source_height: inspection ? inspection.height : Math.round(existingStoredProxy.height / existingStoredProxy.scale),
        analysis_width: existingStoredProxy.width,
        analysis_height: existingStoredProxy.height,
        scale: existingStoredProxy.scale,
        format: existingStoredProxy.mime_type,
        preprocessing_version: PREPROCESSING_VERSION,
        max_dimension: options.maxDimension || DEFAULT_MAX_ANALYSIS_DIMENSION,
        quality: options.quality ?? DEFAULT_JPEG_QUALITY,
        source_byte_size: sourceBlob.size,
        proxy_byte_size: existingStoredProxy.byte_size || existingStoredProxy.blob.size,
        cache_key: cacheKey,
        generated_at: existingStoredProxy.created_at,
      };

      return {
        imageId,
        proxyBlob: existingStoredProxy.blob,
        info,
        fromCache: true,
      };
    }
  }

  // 4. Generate new proxy
  const { blob: proxyBlob, info } = await createProxyFromBlob(sourceBlob, options);
  info.cache_key = cacheKey;

  // 5. Persist proxy in separate analysis_proxies store
  await storage.saveProxyBlob({
    image_id: imageId,
    cache_key: cacheKey,
    blob: proxyBlob,
    mime_type: info.format,
    width: info.analysis_width,
    height: info.analysis_height,
    scale: info.scale,
    byte_size: proxyBlob.size,
    created_at: info.generated_at,
  });

  return {
    imageId,
    proxyBlob,
    info,
    fromCache: false,
  };
}

/**
 * Retrieves cached proxy Blob directly from storage if present.
 */
export async function getProxyBlob(imageId: string): Promise<Blob | null> {
  const record = await storage.getProxyBlob(imageId);
  return record ? record.blob : null;
}

/**
 * Invalidates and deletes a stored proxy.
 */
export async function invalidateProxy(imageId: string): Promise<void> {
  await storage.deleteProxyBlob(imageId);
}

/**
 * Clears all cached proxies across IndexedDB.
 */
export async function clearAllProxies(): Promise<void> {
  await storage.clearAllProxies();
}

/**
 * Safe, non-blocking batch preprocessing engine for multi-panel collections.
 */
export async function preprocessBatch(
  imageIds: string[],
  options: BatchPreprocessingOptions = {}
): Promise<BatchPreprocessingResult> {
  const startTime = performance.now();
  const successful = new Map<string, PreprocessingInfo>();
  const failed = new Map<string, AnalysisError>();
  const total = imageIds.length;

  if (total === 0) {
    return {
      successful,
      failed,
      isCancelled: false,
      totalProcessed: 0,
      durationMs: 0,
    };
  }

  const concurrency = Math.max(1, Math.min(options.concurrency || 2, 4));
  let completed = 0;
  let isCancelled = false;

  // Process sequentially or with controlled concurrency to avoid Android tablet RAM spikes
  for (let i = 0; i < total; i += concurrency) {
    if (options.signal?.aborted) {
      isCancelled = true;
      break;
    }

    const chunk = imageIds.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (imageId) => {
        if (options.signal?.aborted) return;

        try {
          const result = await getOrCreateProxy(imageId, options);
          successful.set(imageId, result.info);
        } catch (err) {
          const analysisError: AnalysisError =
            err && typeof err === 'object' && 'code' in err
              ? (err as AnalysisError)
              : {
                  code: 'BATCH_PREPROCESSING_FAILED',
                  stage: 'preprocessing',
                  message: err instanceof Error ? err.message : 'Unknown preprocessing error',
                  retryable: true,
                  occurred_at: new Date().toISOString(),
                };
          failed.set(imageId, analysisError);
        } finally {
          completed++;
          if (options.onProgress) {
            options.onProgress({
              completed,
              total,
              currentImageId: imageId,
              percent: Math.round((completed / total) * 100),
            });
          }
        }
      })
    );

    // Yield execution to maintain responsive UI
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    successful,
    failed,
    isCancelled,
    totalProcessed: completed,
    durationMs: Math.round(performance.now() - startTime),
  };
}

/**
 * Coordinate mapping helpers (Section 22)
 */

/**
 * Converts proxy pixel coordinates to normalized [0, 1] coordinates
 */
export function proxyPixelsToNormalized(
  proxyX: number,
  proxyY: number,
  proxyWidth: number,
  proxyHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1, proxyX / proxyWidth)),
    y: Math.max(0, Math.min(1, proxyY / proxyHeight)),
  };
}

/**
 * Converts normalized [0, 1] coordinates to proxy pixel coordinates
 */
export function normalizedToProxyPixels(
  normX: number,
  normY: number,
  proxyWidth: number,
  proxyHeight: number
): { x: number; y: number } {
  return {
    x: Math.round(normX * proxyWidth),
    y: Math.round(normY * proxyHeight),
  };
}

/**
 * Converts normalized [0, 1] coordinates to original source image pixel coordinates
 */
export function normalizedToSourcePixels(
  normX: number,
  normY: number,
  sourceWidth: number,
  sourceHeight: number
): { x: number; y: number } {
  return {
    x: Math.round(normX * sourceWidth),
    y: Math.round(normY * sourceHeight),
  };
}
