import { Project, Panel, SourceImage } from '../../types';
import { validateProject } from '../../data/schemas';
import { getOrderedPanels, validatePanelSequenceIntegrity } from '../panels/sequence-manager.service';
import { getImageBlob, checkStorageConsistency } from '../../services/storage/indexeddb';
import { ValidationCheck, ValidationReport, ValidationSeverity, ReadinessState } from './types';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface ValidateProjectOptions {
  checkBlobsInStorage?: boolean;
  checkStorageConsistency?: boolean;
}

/**
 * Executes the complete Pre-Analysis Validation & Readiness Gate checks on a Project.
 * Deterministically verifies structural health, identity invariants, storage consistency,
 * and sequence integrity without mutating or modifying user data.
 */
export async function validateProjectForAnalysis(
  project: Project,
  options: ValidateProjectOptions = { checkBlobsInStorage: true, checkStorageConsistency: true }
): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];
  const errors: ValidationCheck[] = [];
  const warnings: ValidationCheck[] = [];

  const panels = project.panels || [];
  const images = project.images || [];

  const imageMap = new Map<string, SourceImage>();
  const imageToPanelsMap = new Map<string, string[]>();

  for (const img of images) {
    imageMap.set(img.image_id, img);
    imageToPanelsMap.set(img.image_id, []);
  }

  for (const panel of panels) {
    const list = imageToPanelsMap.get(panel.image_id);
    if (list) {
      list.push(panel.id);
    }
  }

  // =========================================================================
  // CHECK 1: Project Schema Validation (Zod)
  // =========================================================================
  const schemaResult = validateProject(project);
  if (!schemaResult.valid) {
    const check: ValidationCheck = {
      check_id: 'schema_root',
      category: 'schema',
      name: 'Project Root Schema Validation',
      severity: 'ERROR',
      status: 'FAIL',
      message: 'Project schema validation failed against canonical Schema v1.0.0',
      details: schemaResult.errors?.map((e) => `Path "${e.path}": ${e.message}`) || [
        schemaResult.errorSummary || 'Schema validation error',
      ],
    };
    checks.push(check);
    errors.push(check);
  } else {
    checks.push({
      check_id: 'schema_root',
      category: 'schema',
      name: 'Project Root Schema Validation',
      severity: 'INFO',
      status: 'PASS',
      message: 'Project schema strictly conforms to Schema v1.0.0 specification.',
    });
  }

  // =========================================================================
  // CHECK 2: Panel Identity Validation
  // =========================================================================
  const missingPanelIds: string[] = [];
  const panelIdCounts = new Map<string, number>();
  const duplicatePanelIds: string[] = [];

  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (!p.id || typeof p.id !== 'string' || p.id.trim().length === 0) {
      missingPanelIds.push(`index_${i}`);
    } else {
      const count = (panelIdCounts.get(p.id) || 0) + 1;
      panelIdCounts.set(p.id, count);
      if (count === 2) {
        duplicatePanelIds.push(p.id);
      }
    }
  }

  if (missingPanelIds.length > 0) {
    const check: ValidationCheck = {
      check_id: 'panel_id_missing',
      category: 'panel_identity',
      name: 'Panel ID Integrity (Missing IDs)',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${missingPanelIds.length} panel(s) are missing a valid panel_id identifier.`,
      details: missingPanelIds.map((idx) => `Panel at ${idx} has an empty or invalid ID.`),
      affected_panel_ids: missingPanelIds,
    };
    checks.push(check);
    errors.push(check);
  }

  if (duplicatePanelIds.length > 0) {
    const check: ValidationCheck = {
      check_id: 'panel_id_duplicate',
      category: 'duplicate_ids',
      name: 'Panel ID Collision (Duplicate IDs)',
      severity: 'ERROR',
      status: 'FAIL',
      message: `Duplicate panel IDs detected: ${duplicatePanelIds.join(', ')}`,
      details: duplicatePanelIds.map((id) => `Panel ID "${id}" appears more than once in the dataset.`),
      affected_panel_ids: duplicatePanelIds,
    };
    checks.push(check);
    errors.push(check);
  }

  if (missingPanelIds.length === 0 && duplicatePanelIds.length === 0) {
    checks.push({
      check_id: 'panel_identity_ok',
      category: 'panel_identity',
      name: 'Panel Identity & Uniqueness',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${panels.length} panel identities are valid and unique.`,
    });
  }

  // =========================================================================
  // CHECK 3: Source Image Identity Validation
  // =========================================================================
  const missingImageIds: string[] = [];
  const imageIdCounts = new Map<string, number>();
  const duplicateImageIds: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img.image_id || typeof img.image_id !== 'string' || img.image_id.trim().length === 0) {
      missingImageIds.push(`image_index_${i}`);
    } else {
      const count = (imageIdCounts.get(img.image_id) || 0) + 1;
      imageIdCounts.set(img.image_id, count);
      if (count === 2) {
        duplicateImageIds.push(img.image_id);
      }
    }
  }

  if (missingImageIds.length > 0) {
    const check: ValidationCheck = {
      check_id: 'image_id_missing',
      category: 'source_image_identity',
      name: 'Source Image ID Integrity (Missing IDs)',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${missingImageIds.length} source image(s) are missing a valid image_id identifier.`,
      details: missingImageIds,
      affected_image_ids: missingImageIds,
    };
    checks.push(check);
    errors.push(check);
  }

  if (duplicateImageIds.length > 0) {
    const check: ValidationCheck = {
      check_id: 'image_id_duplicate',
      category: 'duplicate_ids',
      name: 'Source Image ID Collision (Duplicate IDs)',
      severity: 'ERROR',
      status: 'FAIL',
      message: `Duplicate source image IDs detected: ${duplicateImageIds.join(', ')}`,
      details: duplicateImageIds.map((id) => `Image ID "${id}" is shared by multiple image records.`),
      affected_image_ids: duplicateImageIds,
    };
    checks.push(check);
    errors.push(check);
  }

  if (missingImageIds.length === 0 && duplicateImageIds.length === 0) {
    checks.push({
      check_id: 'image_identity_ok',
      category: 'source_image_identity',
      name: 'Source Image Identity & Uniqueness',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${images.length} source image identities are valid and unique.`,
    });
  }

  // =========================================================================
  // CHECK 4: Original Filename Integrity Validation
  // =========================================================================
  const invalidFilenames: { imageId: string; filename: string; reason: string }[] = [];

  for (const img of images) {
    if (!img.original_filename || typeof img.original_filename !== 'string' || img.original_filename.trim().length === 0) {
      invalidFilenames.push({
        imageId: img.image_id,
        filename: String(img.original_filename),
        reason: 'Filename is empty or missing.',
      });
      continue;
    }

    const lowerName = img.original_filename.toLowerCase();
    const hasValidExt = SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      invalidFilenames.push({
        imageId: img.image_id,
        filename: img.original_filename,
        reason: `Unsupported file extension in "${img.original_filename}". Expected .jpg, .jpeg, .png, or .webp.`,
      });
    }
  }

  if (invalidFilenames.length > 0) {
    const check: ValidationCheck = {
      check_id: 'filename_integrity_fail',
      category: 'filename_integrity',
      name: 'Original Filename Integrity',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${invalidFilenames.length} source image(s) have invalid or unsupported filenames.`,
      details: invalidFilenames.map((f) => `Image [${f.imageId}]: ${f.reason}`),
      affected_image_ids: invalidFilenames.map((f) => f.imageId),
    };
    checks.push(check);
    errors.push(check);
  } else {
    checks.push({
      check_id: 'filename_integrity_ok',
      category: 'filename_integrity',
      name: 'Original Filename Integrity',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${images.length} source image original filenames are preserved and valid.`,
    });
  }

  // =========================================================================
  // CHECK 5: Panel -> Source Image Relationship Integrity
  // =========================================================================
  const brokenPanelRefs: { panelId: string; missingImageId: string }[] = [];
  for (const p of panels) {
    if (!p.image_id || !imageMap.has(p.image_id)) {
      brokenPanelRefs.push({
        panelId: p.id,
        missingImageId: p.image_id || 'null',
      });
    }
  }

  if (brokenPanelRefs.length > 0) {
    const check: ValidationCheck = {
      check_id: 'panel_image_ref_broken',
      category: 'relationships',
      name: 'Panel to Source Image Reference Integrity',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${brokenPanelRefs.length} panel(s) reference non-existent source image records.`,
      details: brokenPanelRefs.map((r) => `Panel [${r.panelId}] points to missing image_id "${r.missingImageId}".`),
      affected_panel_ids: brokenPanelRefs.map((r) => r.panelId),
    };
    checks.push(check);
    errors.push(check);
  } else {
    checks.push({
      check_id: 'relationships_ok',
      category: 'relationships',
      name: 'Panel to Source Image Linkages',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${panels.length} panels are linked to verified source image records.`,
    });
  }

  // Orphan Source Images (images without any panels) - Non-blocking Warning/Info
  const orphanImageIds: string[] = [];
  for (const [imgId, linkedPanels] of imageToPanelsMap.entries()) {
    if (linkedPanels.length === 0) {
      orphanImageIds.push(imgId);
    }
  }

  if (orphanImageIds.length > 0 && panels.length > 0) {
    const check: ValidationCheck = {
      check_id: 'orphan_source_images',
      category: 'relationships',
      name: 'Orphan Source Images Detected',
      severity: 'WARNING',
      status: 'WARN',
      message: `${orphanImageIds.length} source image(s) have no extracted panels linked to them.`,
      details: orphanImageIds.map((id) => {
        const img = imageMap.get(id);
        return `Image [${id}] "${img?.original_filename || 'Unknown'}" contains 0 linked panels.`;
      }),
      affected_image_ids: orphanImageIds,
    };
    checks.push(check);
    warnings.push(check);
  }

  // =========================================================================
  // CHECK 6 & 7: Image Dimensions & Readability Integrity
  // =========================================================================
  const invalidDimensions: { imageId: string; width: number; height: number; reason: string }[] = [];
  const extremeAspectRatios: { imageId: string; width: number; height: number; ratio: string }[] = [];
  const unsupportedMimeTypes: { imageId: string; mimeType: string }[] = [];

  for (const img of images) {
    // 1. Dimensions check
    if (!img.width || !img.height || img.width <= 0 || img.height <= 0 || isNaN(img.width) || isNaN(img.height)) {
      invalidDimensions.push({
        imageId: img.image_id,
        width: img.width,
        height: img.height,
        reason: `Invalid non-positive dimensions: ${img.width}x${img.height}`,
      });
    } else {
      // Check extreme aspect ratios (ratio > 1:15 or width > 16000)
      const ratio = img.height / img.width;
      if (ratio > 15 || ratio < 0.05) {
        extremeAspectRatios.push({
          imageId: img.image_id,
          width: img.width,
          height: img.height,
          ratio: `1:${ratio.toFixed(1)}`,
        });
      }
    }

    // 2. MIME type check
    if (!img.mime_type || !SUPPORTED_MIME_TYPES.has(img.mime_type.toLowerCase())) {
      unsupportedMimeTypes.push({
        imageId: img.image_id,
        mimeType: String(img.mime_type),
      });
    }
  }

  if (invalidDimensions.length > 0) {
    const check: ValidationCheck = {
      check_id: 'dimensions_invalid',
      category: 'image_dimensions',
      name: 'Image Pixel Dimensions Invariant',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${invalidDimensions.length} image(s) have invalid non-positive width/height dimensions.`,
      details: invalidDimensions.map((d) => `Image [${d.imageId}]: ${d.reason}`),
      affected_image_ids: invalidDimensions.map((d) => d.imageId),
    };
    checks.push(check);
    errors.push(check);
  } else {
    checks.push({
      check_id: 'dimensions_ok',
      category: 'image_dimensions',
      name: 'Image Pixel Dimensions Invariant',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${images.length} source images have valid positive pixel dimensions.`,
    });
  }

  if (extremeAspectRatios.length > 0) {
    const check: ValidationCheck = {
      check_id: 'dimensions_extreme_ratio',
      category: 'image_dimensions',
      name: 'Extreme Aspect Ratio Notice',
      severity: 'WARNING',
      status: 'WARN',
      message: `${extremeAspectRatios.length} image(s) have unusually tall/wide aspect ratios (e.g. uncut webtoon continuous vertical strip).`,
      details: extremeAspectRatios.map((e) => `Image [${e.imageId}] dimensions ${e.width}x${e.height} (ratio ${e.ratio})`),
      affected_image_ids: extremeAspectRatios.map((e) => e.imageId),
    };
    checks.push(check);
    warnings.push(check);
  }

  if (unsupportedMimeTypes.length > 0) {
    const check: ValidationCheck = {
      check_id: 'mime_unsupported',
      category: 'unsupported_assets',
      name: 'MIME Type Compatibility Check',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${unsupportedMimeTypes.length} image(s) have unsupported MIME types.`,
      details: unsupportedMimeTypes.map((m) => `Image [${m.imageId}] has MIME "${m.mimeType}". Expected image/jpeg, image/png, or image/webp.`),
      affected_image_ids: unsupportedMimeTypes.map((m) => m.imageId),
    };
    checks.push(check);
    errors.push(check);
  }

  // =========================================================================
  // CHECK 8 & 9: Canonical Sequence Integrity & Continuity (0..N-1)
  // =========================================================================
  const sequenceReport = validatePanelSequenceIntegrity(project);
  const duplicateSequenceOrders = new Map<number, string[]>();
  const invalidSequencePanels: { panelId: string; order: number; expected: number }[] = [];

  const orderedPanels = getOrderedPanels(panels);

  for (let i = 0; i < orderedPanels.length; i++) {
    const p = orderedPanels[i];
    const existing = duplicateSequenceOrders.get(p.order) || [];
    existing.push(p.id);
    duplicateSequenceOrders.set(p.order, existing);

    if (p.order !== i) {
      invalidSequencePanels.push({
        panelId: p.id,
        order: p.order,
        expected: i,
      });
    }
  }

  const collidingOrderIndices: { order: number; panelIds: string[] }[] = [];
  for (const [orderIdx, panelIds] of duplicateSequenceOrders.entries()) {
    if (panelIds.length > 1) {
      collidingOrderIndices.push({ order: orderIdx, panelIds });
    }
  }

  if (collidingOrderIndices.length > 0) {
    const check: ValidationCheck = {
      check_id: 'sequence_collision',
      category: 'sequence_continuity',
      name: 'Sequence Position Collision Check',
      severity: 'ERROR',
      status: 'FAIL',
      message: `Multiple panels share duplicate sequence order index positions.`,
      details: collidingOrderIndices.map(
        (c) => `Sequence index [${c.order}] is assigned to ${c.panelIds.length} panels: ${c.panelIds.join(', ')}`
      ),
      affected_panel_ids: collidingOrderIndices.flatMap((c) => c.panelIds),
    };
    checks.push(check);
    errors.push(check);
  }

  if (invalidSequencePanels.length > 0) {
    const check: ValidationCheck = {
      check_id: 'sequence_continuity_fail',
      category: 'sequence_integrity',
      name: '0-Based Contiguous Sequence Integrity',
      severity: 'ERROR',
      status: 'FAIL',
      message: `${invalidSequencePanels.length} panel(s) break contiguous 0..N-1 sequence ordering.`,
      details: invalidSequencePanels.map(
        (p) => `Panel [${p.panelId}] has order=${p.order}, but expected index=${p.expected}`
      ),
      affected_panel_ids: invalidSequencePanels.map((p) => p.panelId),
    };
    checks.push(check);
    errors.push(check);
  } else if (collidingOrderIndices.length === 0) {
    checks.push({
      check_id: 'sequence_integrity_ok',
      category: 'sequence_integrity',
      name: '0-Based Contiguous Sequence Integrity',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${panels.length} panels form a strictly contiguous 0..${Math.max(0, panels.length - 1)} canonical sequence.`,
    });
  }

  // =========================================================================
  // CHECK 10: Original Import Sequence Validation
  // =========================================================================
  const panelsMissingInitialOrder: string[] = [];
  for (const p of panels) {
    if (p.initial_order === undefined || typeof p.initial_order !== 'number' || p.initial_order < 0) {
      panelsMissingInitialOrder.push(p.id);
    }
  }

  if (panelsMissingInitialOrder.length > 0 && panels.length > 0) {
    // If some panels have initial_order and some don't, or all missing, check if source_order is present
    const hasSourceOrderFallback = images.every((img) => typeof img.source_order === 'number');
    if (!hasSourceOrderFallback) {
      const check: ValidationCheck = {
        check_id: 'import_order_missing',
        category: 'original_import_sequence',
        name: 'Original Import Sequence Record',
        severity: 'WARNING',
        status: 'WARN',
        message: `${panelsMissingInitialOrder.length} panel(s) do not contain an explicit initial_order property. Fallback to source_order will be utilized.`,
        details: panelsMissingInitialOrder.map((id) => `Panel [${id}] missing initial_order`),
        affected_panel_ids: panelsMissingInitialOrder,
      };
      checks.push(check);
      warnings.push(check);
    } else {
      checks.push({
        check_id: 'import_order_ok',
        category: 'original_import_sequence',
        name: 'Original Import Sequence Preservation',
        severity: 'INFO',
        status: 'PASS',
        message: 'Import sequence metadata is preserved and deterministically resolvable.',
      });
    }
  } else if (panels.length > 0) {
    checks.push({
      check_id: 'import_order_ok',
      category: 'original_import_sequence',
      name: 'Original Import Sequence Preservation',
      severity: 'INFO',
      status: 'PASS',
      message: `All ${panels.length} panels preserve valid initial import sequence metadata.`,
    });
  }

  // =========================================================================
  // CHECK 11, 12, 13: Image Binary Availability & Storage Consistency
  // =========================================================================
  let validAssetsCount = 0;
  let missingBinaryCount = 0;
  let corruptedBinaryCount = 0;

  if (options.checkBlobsInStorage && images.length > 0) {
    const missingBinaryImageIds: string[] = [];
    const corruptedBinaryImageIds: string[] = [];

    // Verify each image's binary blob in IndexedDB
    for (const img of images) {
      try {
        const blob = await getImageBlob(img.image_id);
        if (!blob) {
          missingBinaryImageIds.push(img.image_id);
          missingBinaryCount++;
        } else if (blob.size === 0) {
          corruptedBinaryImageIds.push(img.image_id);
          corruptedBinaryCount++;
        } else {
          validAssetsCount++;
        }
      } catch {
        missingBinaryImageIds.push(img.image_id);
        missingBinaryCount++;
      }
    }

    if (missingBinaryImageIds.length > 0) {
      const affectedPanels = missingBinaryImageIds.flatMap((imgId) => imageToPanelsMap.get(imgId) || []);
      const check: ValidationCheck = {
        check_id: 'binary_missing_storage',
        category: 'binary_availability',
        name: 'Image Binary Storage Availability',
        severity: 'ERROR',
        status: 'FAIL',
        message: `${missingBinaryImageIds.length} source image(s) have missing binary blobs in local storage.`,
        details: missingBinaryImageIds.map((id) => {
          const img = imageMap.get(id);
          return `Missing binary for [${id}] "${img?.original_filename || 'Unknown'}"`;
        }),
        affected_image_ids: missingBinaryImageIds,
        affected_panel_ids: affectedPanels,
      };
      checks.push(check);
      errors.push(check);
    }

    if (corruptedBinaryImageIds.length > 0) {
      const affectedPanels = corruptedBinaryImageIds.flatMap((imgId) => imageToPanelsMap.get(imgId) || []);
      const check: ValidationCheck = {
        check_id: 'binary_corrupted_storage',
        category: 'corrupted_assets',
        name: 'Corrupted Image Binary Check (0-byte blob)',
        severity: 'ERROR',
        status: 'FAIL',
        message: `${corruptedBinaryImageIds.length} image binary blob(s) are empty (0 bytes) or unreadable.`,
        details: corruptedBinaryImageIds.map((id) => `Corrupted 0-byte blob for [${id}]`),
        affected_image_ids: corruptedBinaryImageIds,
        affected_panel_ids: affectedPanels,
      };
      checks.push(check);
      errors.push(check);
    }

    if (missingBinaryImageIds.length === 0 && corruptedBinaryImageIds.length === 0) {
      checks.push({
        check_id: 'binary_availability_ok',
        category: 'binary_availability',
        name: 'Image Binary Storage Availability',
        severity: 'INFO',
        status: 'PASS',
        message: `All ${images.length} source image binary blobs are present and verified in IndexedDB.`,
      });
    }

    // Storage Consistency Check (Cross-referencing project image list vs storage keys)
    if (options.checkStorageConsistency) {
      const storageReport = await checkStorageConsistency(project);
      if (storageReport.orphanedBlobImageIds.length > 0) {
        const check: ValidationCheck = {
          check_id: 'storage_orphaned_blobs',
          category: 'storage_consistency',
          name: 'Storage Consistency (Orphaned Blobs Detected)',
          severity: 'WARNING',
          status: 'WARN',
          message: `${storageReport.orphanedBlobImageIds.length} binary blob(s) in local storage are not referenced in the project image manifest.`,
          details: storageReport.orphanedBlobImageIds.map((id) => `Orphaned stored blob [${id}]`),
          affected_image_ids: storageReport.orphanedBlobImageIds,
        };
        checks.push(check);
        warnings.push(check);
      } else {
        checks.push({
          check_id: 'storage_consistency_ok',
          category: 'storage_consistency',
          name: 'Storage Manifest Consistency',
          severity: 'INFO',
          status: 'PASS',
          message: `Local IndexedDB binary storage strictly matches project manifest (${storageReport.projectBlobCount} verified blobs).`,
        });
      }
    }
  } else if (images.length === 0) {
    checks.push({
      check_id: 'binary_availability_empty',
      category: 'binary_availability',
      name: 'Image Binary Storage Availability',
      severity: 'INFO',
      status: 'PASS',
      message: 'No image binaries registered in empty project.',
    });
  }

  // =========================================================================
  // READINESS STATE COMPUTATION
  // =========================================================================
  let readiness: ReadinessState = 'READY';
  let readinessReason = '';

  const totalPanels = panels.length;
  const totalImages = images.length;
  const totalErrors = errors.length;
  const totalWarnings = warnings.length;

  if (totalPanels === 0) {
    readiness = 'BLOCKED';
    readinessReason = 'No panels are available for analysis. Import manhwa chapter images to begin.';
  } else if (totalErrors > 0) {
    readiness = 'BLOCKED';
    readinessReason = `${totalErrors} blocking error(s) prevent AI analysis. Resolve schema, identity, or binary storage errors first.`;
  } else if (totalWarnings > 0) {
    readiness = 'READY_WITH_WARNINGS';
    readinessReason = `Project dataset is structurally sound and ready for analysis with ${totalWarnings} non-blocking notice(s).`;
  } else {
    readiness = 'READY';
    readinessReason = `All ${checks.length} validation checks passed. Dataset is verified and ready for AI analysis.`;
  }

  const summary = {
    total_panels: totalPanels,
    total_images: totalImages,
    valid_assets: validAssetsCount,
    missing_assets: missingBinaryCount,
    corrupted_assets: corruptedBinaryCount,
    schema_errors: !schemaResult.valid ? 1 : 0,
    identity_errors: (missingPanelIds.length > 0 ? 1 : 0) + (duplicatePanelIds.length > 0 ? 1 : 0) + (missingImageIds.length > 0 ? 1 : 0) + (duplicateImageIds.length > 0 ? 1 : 0),
    ordering_errors: (invalidSequencePanels.length > 0 ? 1 : 0) + (collidingOrderIndices.length > 0 ? 1 : 0),
    storage_errors: missingBinaryCount > 0 ? 1 : 0,
    total_errors: totalErrors,
    total_warnings: totalWarnings,
    total_checks_run: checks.length,
  };

  return {
    project_id: project.id,
    project_title: project.metadata?.title || 'Untitled Project',
    schema_version: project.schemaVersion || '1.0.0',
    readiness,
    readiness_reason: readinessReason,
    summary,
    checks,
    errors,
    warnings,
    generated_at: new Date().toISOString(),
  };
}
