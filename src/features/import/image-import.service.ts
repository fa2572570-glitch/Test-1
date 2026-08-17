import { SourceImage, Panel } from '../../types';
import { generateStableId } from '../../utils/id';
import {
  isSupportedImageType,
  resolveMimeType,
  extractDimensions,
  generateThumbnailBlob,
  computeFileHash,
} from '../../engines/image';
import { saveImageBlob } from '../../services/storage/indexeddb';

export interface PreviewItem {
  id: string;
  file: File;
  original_filename: string;
  file_size: number;
  mime_type: string;
  width: number;
  height: number;
  thumbnailUrl: string | null;
  thumbnailBlob?: Blob;
  hash: string;
  status: 'ready' | 'invalid' | 'duplicate';
  isDuplicate: boolean;
  duplicateAction: 'skip' | 'import_anyway';
  duplicateReason?: string;
  errorMessage?: string;
}

export interface ImportProgressState {
  total: number;
  current: number;
  completed: number;
  failed: number;
  currentFilename: string;
  status: 'idle' | 'inspecting' | 'importing' | 'finished' | 'error';
  errors: Array<{ filename: string; reason: string }>;
}

/**
 * Format bytes to readable unit (KB / MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Inspects a list of files selected by user, extracting dimensions,
 * validating MIME types, creating temporary thumbnails, and checking for duplicates.
 */
export async function inspectSelectedFiles(
  files: File[],
  existingImages: SourceImage[],
  onProgress?: (inspectedCount: number, totalCount: number) => void
): Promise<PreviewItem[]> {
  const items: PreviewItem[] = [];
  const seenInBatch = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const originalFilename = file.name;
    const tempId = `preview_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Check supported format
    if (!isSupportedImageType(file)) {
      items.push({
        id: tempId,
        file,
        original_filename: originalFilename,
        file_size: file.size,
        mime_type: file.type || 'unknown',
        width: 0,
        height: 0,
        thumbnailUrl: null,
        hash: '',
        status: 'invalid',
        isDuplicate: false,
        duplicateAction: 'skip',
        errorMessage: `Unsupported file format (${file.type || 'unknown'}). Supported formats are JPG, PNG, and WEBP.`,
      });
      onProgress?.(i + 1, files.length);
      continue;
    }

    const resolvedMime = resolveMimeType(file);

    // 2. Extract dimensions safely
    let dimensions = { width: 0, height: 0 };
    let thumbBlob: Blob | undefined;
    let thumbUrl: string | null = null;
    let hash = '';

    try {
      dimensions = await extractDimensions(file);
      hash = await computeFileHash(file);
      try {
        thumbBlob = await generateThumbnailBlob(file, 280);
        thumbUrl = URL.createObjectURL(thumbBlob);
      } catch {
        // Thumbnail generation failed, fallback to direct object URL
        thumbUrl = URL.createObjectURL(file);
      }
    } catch (err) {
      items.push({
        id: tempId,
        file,
        original_filename: originalFilename,
        file_size: file.size,
        mime_type: resolvedMime,
        width: 0,
        height: 0,
        thumbnailUrl: null,
        hash: '',
        status: 'invalid',
        isDuplicate: false,
        duplicateAction: 'skip',
        errorMessage: err instanceof Error ? err.message : 'Could not decode image dimensions. File may be corrupted.',
      });
      onProgress?.(i + 1, files.length);
      continue;
    }

    // 3. Duplicate check against existing project images
    const batchKey = `${originalFilename}_${file.size}`;
    const duplicateInExisting = existingImages.find(
      (img) => img.original_filename === originalFilename && img.file_size === file.size
    );
    const duplicateInCurrentBatch = seenInBatch.has(batchKey);

    const isDuplicate = Boolean(duplicateInExisting || duplicateInCurrentBatch);
    let duplicateReason: string | undefined;

    if (duplicateInExisting) {
      duplicateReason = `Matches existing project image '${duplicateInExisting.original_filename}' (${formatBytes(duplicateInExisting.file_size)})`;
    } else if (duplicateInCurrentBatch) {
      duplicateReason = `Duplicate file selected twice in this batch ('${originalFilename}')`;
    }

    seenInBatch.add(batchKey);

    items.push({
      id: tempId,
      file,
      original_filename: originalFilename,
      file_size: file.size,
      mime_type: resolvedMime,
      width: dimensions.width,
      height: dimensions.height,
      thumbnailUrl: thumbUrl,
      thumbnailBlob: thumbBlob,
      hash,
      status: isDuplicate ? 'duplicate' : 'ready',
      isDuplicate,
      duplicateAction: 'skip',
      duplicateReason,
    });

    onProgress?.(i + 1, files.length);
  }

  return items;
}

export interface BatchImportResult {
  successfulImages: SourceImage[];
  successfulPanels: Panel[];
  failedCount: number;
  skippedCount: number;
  errors: Array<{ filename: string; reason: string }>;
}

/**
 * Executes batch import of verified preview items:
 * 1. Stores image binary blob in IndexedDB
 * 2. Creates SourceImage record (preserving verbatim original_filename)
 * 3. Creates 1:1 Panel record with normalized boundary
 * 4. Links Panel -> SourceImage
 * 5. Handles partial failures gracefully without discarding previous successes.
 */
export async function executeBatchImport(
  projectId: string,
  items: PreviewItem[],
  existingImagesCount: number,
  onProgress?: (progress: ImportProgressState) => void
): Promise<BatchImportResult> {
  const successfulImages: SourceImage[] = [];
  const successfulPanels: Panel[] = [];
  const errors: Array<{ filename: string; reason: string }> = [];
  let skippedCount = 0;

  // Filter items to import
  const itemsToProcess = items.filter((item) => {
    if (item.status === 'invalid') return false;
    if (item.status === 'duplicate' && item.duplicateAction === 'skip') {
      skippedCount++;
      return false;
    }
    return true;
  });

  const total = itemsToProcess.length;
  let completed = 0;
  let currentOrder = existingImagesCount;

  onProgress?.({
    total,
    current: 0,
    completed: 0,
    failed: 0,
    currentFilename: '',
    status: 'importing',
    errors: [],
  });

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const currentIndex = i + 1;

    onProgress?.({
      total,
      current: currentIndex,
      completed,
      failed: errors.length,
      currentFilename: item.original_filename,
      status: 'importing',
      errors: [...errors],
    });

    try {
      const imageId = generateStableId('img');
      const panelId = generateStableId('pnl');
      const now = new Date().toISOString();

      // 1. Store binary in IndexedDB
      await saveImageBlob(projectId, imageId, item.file, item.mime_type);

      // 2. Create SourceImage record
      const sourceImage: SourceImage = {
        image_id: imageId,
        original_filename: item.original_filename,
        mime_type: item.mime_type,
        width: item.width,
        height: item.height,
        file_size: item.file_size,
        source_order: currentOrder,
        created_at: now,
      };

      // 3. Create canonical Panel record linked to SourceImage
      const panel: Panel = {
        id: panelId,
        image_id: imageId,
        panel_index: 0,
        order: currentOrder,
        initial_order: currentOrder,
        boundary: {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        created_at: now,
        updated_at: now,
      };

      successfulImages.push(sourceImage);
      successfulPanels.push(panel);
      currentOrder++;
      completed++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown storage failure';
      errors.push({
        filename: item.original_filename,
        reason,
      });
    }
  }

  onProgress?.({
    total,
    current: total,
    completed,
    failed: errors.length,
    currentFilename: '',
    status: 'finished',
    errors: [...errors],
  });

  return {
    successfulImages,
    successfulPanels,
    failedCount: errors.length,
    skippedCount,
    errors,
  };
}

/**
 * Cleanup helper for revoking generated object URLs to avoid memory leaks on Android/tablet.
 */
export function cleanupPreviewUrls(items: PreviewItem[]): void {
  for (const item of items) {
    if (item.thumbnailUrl && item.thumbnailUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(item.thumbnailUrl);
      } catch {
        // ignore
      }
    }
  }
}
