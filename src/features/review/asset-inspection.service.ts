import { Project, Panel, SourceImage } from '../../types';
import { validateProject } from '../../data/schemas';
import { getOrderedPanels, validatePanelSequenceIntegrity } from '../panels/sequence-manager.service';
import { getImageBlob } from '../../services/storage/indexeddb';

export type AssetHealthStatus = 'valid' | 'missing_binary' | 'missing_image_ref' | 'invalid_metadata' | 'corrupted';

export interface PanelAssetInspection {
  panelId: string;
  imageId: string;
  originalFilename: string;
  status: AssetHealthStatus;
  statusLabel: string;
  message: string;
  hasBlob: boolean;
  isMetadataValid: boolean;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  sequenceOrder: number;
  initialOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInspectionReport {
  projectId: string;
  projectTitle: string;
  schemaVersion: string;
  lastModified: string;
  totalPanels: number;
  totalImages: number;
  validPanelsCount: number;
  missingBinaryCount: number;
  missingImageRefCount: number;
  invalidMetadataCount: number;
  isSchemaValid: boolean;
  schemaErrors: string[];
  isSequenceValid: boolean;
  sequenceErrors: string[];
  panelReports: PanelAssetInspection[];
  panelReportMap: Map<string, PanelAssetInspection>;
}

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/**
 * Inspects a single panel asset and its parent image reference.
 */
export async function inspectPanelAsset(
  panel: Panel,
  image?: SourceImage,
  checkBlobExistence = true
): Promise<PanelAssetInspection> {
  const panelId = panel.id;
  const imageId = panel.image_id;
  const originalFilename = image?.original_filename || 'Unknown';
  const mimeType = image?.mime_type || 'unknown';
  const width = image?.width || 0;
  const height = image?.height || 0;
  const fileSize = image?.file_size || 0;

  // 1. Check parent source image reference
  if (!image) {
    return {
      panelId,
      imageId,
      originalFilename: 'Missing Source Image Record',
      status: 'missing_image_ref',
      statusLabel: 'Missing Image Ref',
      message: `Panel references image_id '${imageId}' which is missing from project image list.`,
      hasBlob: false,
      isMetadataValid: false,
      mimeType,
      width,
      height,
      fileSize,
      sequenceOrder: panel.order,
      initialOrder: panel.initial_order,
      createdAt: panel.created_at,
      updatedAt: panel.updated_at,
    };
  }

  // 2. Validate metadata fields
  const hasValidDims = width > 0 && height > 0;
  const hasValidFilename = Boolean(image.original_filename && image.original_filename.trim().length > 0);
  const hasValidMime = SUPPORTED_MIME_TYPES.has(image.mime_type.toLowerCase());
  const hasValidPanelId = Boolean(panel.id && panel.id.trim().length > 0);
  const hasValidImageId = Boolean(image.image_id && image.image_id.trim().length > 0);

  const isMetadataValid = hasValidDims && hasValidFilename && hasValidMime && hasValidPanelId && hasValidImageId;

  if (!isMetadataValid) {
    return {
      panelId,
      imageId,
      originalFilename,
      status: 'invalid_metadata',
      statusLabel: 'Invalid Metadata',
      message: 'Panel or source image metadata is invalid or incomplete.',
      hasBlob: false,
      isMetadataValid: false,
      mimeType,
      width,
      height,
      fileSize,
      sequenceOrder: panel.order,
      initialOrder: panel.initial_order,
      createdAt: panel.created_at,
      updatedAt: panel.updated_at,
    };
  }

  // 3. Verify IndexedDB binary blob existence if requested
  let hasBlob = true;
  if (checkBlobExistence) {
    try {
      const blob = await getImageBlob(image.image_id);
      hasBlob = blob !== null && blob.size > 0;
    } catch {
      hasBlob = false;
    }
  }

  if (!hasBlob) {
    return {
      panelId,
      imageId,
      originalFilename,
      status: 'missing_binary',
      statusLabel: 'Missing Binary',
      message: "This panel's image data is missing from local storage.",
      hasBlob: false,
      isMetadataValid: true,
      mimeType,
      width,
      height,
      fileSize,
      sequenceOrder: panel.order,
      initialOrder: panel.initial_order,
      createdAt: panel.created_at,
      updatedAt: panel.updated_at,
    };
  }

  return {
    panelId,
    imageId,
    originalFilename,
    status: 'valid',
    statusLabel: 'Valid Asset',
    message: 'Asset binary and metadata fully verified.',
    hasBlob: true,
    isMetadataValid: true,
    mimeType,
    width,
    height,
    fileSize,
    sequenceOrder: panel.order,
    initialOrder: panel.initial_order,
    createdAt: panel.created_at,
    updatedAt: panel.updated_at,
  };
}

/**
 * Helper to compute aspect ratio string representation (e.g. "1:2.00" or "16:9")
 */
export function formatAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—';
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3';
  if (Math.abs(ratio - 1) < 0.01) return '1:1.00';
  if (ratio < 1) {
    return `1:${(1 / ratio).toFixed(2)}`;
  }
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Calculates optimal zoom factor based on image dimensions, container dimensions, and zoom mode.
 */
export function calculateOptimalZoom(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
  mode: 'fit' | 'fit-width' | 'fit-height' | 'original'
): number {
  if (imageWidth <= 0 || imageHeight <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return 1;
  }

  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;

  switch (mode) {
    case 'fit':
      return Math.min(scaleX, scaleY);
    case 'fit-width':
      return scaleX;
    case 'fit-height':
      return scaleY;
    case 'original':
      return 1;
  }
}

export async function inspectProjectAssets(
  project: Project,
  checkBlobExistence = true
): Promise<ProjectInspectionReport> {
  const imageMap = new Map<string, SourceImage>();
  for (const img of project.images) {
    imageMap.set(img.image_id, img);
  }

  const orderedPanels = getOrderedPanels(project.panels);
  const panelReports: PanelAssetInspection[] = [];
  const panelReportMap = new Map<string, PanelAssetInspection>();

  let validPanelsCount = 0;
  let missingBinaryCount = 0;
  let missingImageRefCount = 0;
  let invalidMetadataCount = 0;

  for (const panel of orderedPanels) {
    const matchedImage = imageMap.get(panel.image_id);
    const report = await inspectPanelAsset(panel, matchedImage, checkBlobExistence);

    panelReports.push(report);
    panelReportMap.set(panel.id, report);

    switch (report.status) {
      case 'valid':
        validPanelsCount++;
        break;
      case 'missing_binary':
        missingBinaryCount++;
        break;
      case 'missing_image_ref':
        missingImageRefCount++;
        break;
      case 'invalid_metadata':
        invalidMetadataCount++;
        break;
    }
  }

  // Schema Validation Check
  const schemaValidation = validateProject(project);
  const schemaErrors = schemaValidation.valid ? [] : [schemaValidation.errorSummary || 'Schema validation error'];

  // Sequence Integrity Check
  const sequenceReport = validatePanelSequenceIntegrity(project);

  return {
    projectId: project.id,
    projectTitle: project.metadata.title,
    schemaVersion: project.schemaVersion,
    lastModified: project.metadata.updated_at,
    totalPanels: project.panels.length,
    totalImages: project.images.length,
    validPanelsCount,
    missingBinaryCount,
    missingImageRefCount,
    invalidMetadataCount,
    isSchemaValid: schemaValidation.valid,
    schemaErrors,
    isSequenceValid: sequenceReport.valid,
    sequenceErrors: sequenceReport.errors,
    panelReports,
    panelReportMap,
  };
}
