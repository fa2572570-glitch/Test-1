import { Project, SourceImage, Panel } from '../types';
import { createDefaultProject } from '../data/defaults/project.default';
import { validateProject } from '../data/schemas';
import { migrateProject } from '../data/migrations';
import * as storage from '../services/storage/indexeddb';
import { generateStableId } from './id';
import {
  inspectSelectedFiles,
  executeBatchImport,
  cleanupPreviewUrls,
} from '../features/import/image-import.service';
import { isSupportedImageType, extractDimensions } from '../engines/image';
import {
  movePanelUp,
  movePanelDown,
  movePanelToFirst,
  movePanelToLast,
  movePanelToPosition,
  reversePanelOrder,
  resetPanelOrderToImport,
  validatePanelSequenceIntegrity,
  isPanelOrderModified,
  getOrderedPanels,
} from '../features/panels/sequence-manager.service';
import {
  inspectProjectAssets,
  inspectPanelAsset,
  calculateOptimalZoom,
  formatAspectRatio,
} from '../features/review/asset-inspection.service';
import {
  VisualAnalysis,
  VisualAnalysisStatus,
  createDefaultVisualAnalysis,
} from '../types';
import {
  VisualAnalysisSchema,
  ConfidenceNumberSchema,
  SubjectSchema,
  CharacterDetectionSchema,
  TextElementSchema,
  SceneContextSchema,
  ActionObservationSchema,
  VisualFocusSchema,
  CameraRegionSchema,
  CameraAnalysisSchema,
  AnalysisErrorSchema,
  BoundingBoxSchema,
} from '../data/schemas';
import { FoundationVisualAnalysisEngine } from '../engines/visual-analysis';
import { validateProjectForAnalysis } from '../features/validation/project-validation.service';
import { runCompositionTests } from '../features/analysis/__tests__/composition.test';
import { runSubjectTests } from '../features/analysis/__tests__/subjects.test';
import { runContinuityTests } from '../features/analysis/__tests__/continuity.test';

export interface TestResult {
  name: string;
  category:
    | 'Schema'
    | 'Storage'
    | 'Migration'
    | 'Coordinate Math'
    | 'Identity Preservation'
    | 'Import Engine'
    | 'Duplicate Engine'
    | 'Ordering Engine'
    | 'Sequence Management'
    | 'Asset Inspection'
    | 'Validation Gate'
    | 'Visual Analysis Model'
    | 'Composition Analysis'
    | 'Subject & Character Detection'
    | 'Visual Continuity Analysis'
    | 'Stress & Performance';
  passed: boolean;
  message: string;
  durationMs: number;
}

/**
 * Creates a valid synthetic test image File for browser tests.
 */
async function createSyntheticImageFile(
  filename: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  width = 120,
  height = 240
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(filename, 10, 30);
  }

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        const file = new File([blob || new Blob(['synthetic'])], filename, {
          type: mimeType,
          lastModified: Date.now(),
        });
        resolve(file);
      },
      mimeType,
      0.9
    );
  });
}

/**
 * Built-in Verification Test Suite
 * Automatically verifies schema validation, persistence, image identity preservation, and Part 1.2 Import Engine requirements.
 */
export async function runFoundationTestSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // ==========================================
  // 1. Core Foundation & Schema Tests
  // ==========================================

  // Test 1: Canonical Project Creation & Validation
  const t1Start = performance.now();
  try {
    const defaultProj = createDefaultProject({ title: 'Test Project 1' });
    const validation = validateProject(defaultProj);
    results.push({
      name: 'Default Project matches Schema v1.0.0',
      category: 'Schema',
      passed: validation.valid && validation.data?.schemaVersion === '1.0.0',
      message: validation.valid ? 'Project schema strictly valid' : (validation.errorSummary || 'Failed'),
      durationMs: Math.round(performance.now() - t1Start),
    });
  } catch (err) {
    results.push({
      name: 'Default Project matches Schema v1.0.0',
      category: 'Schema',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t1Start),
    });
  }

  // Test 2: Normalized Coordinate Boundary Invariant
  const t2Start = performance.now();
  try {
    const validBox = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
    const invalidBox = { x: 0.8, y: 0.2, width: 0.5, height: 0.4 }; // exceeds 1.0 boundary

    const proj = createDefaultProject({ title: 'Bounds Test' });
    const imgId = generateStableId('img');
    proj.images.push({
      image_id: imgId,
      original_filename: 'chapter_01_raw.png',
      mime_type: 'image/png',
      width: 1200,
      height: 8000,
      file_size: 4500000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });

    proj.panels.push({
      id: generateStableId('pnl'),
      image_id: imgId,
      panel_index: 0,
      order: 0,
      boundary: validBox,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const validResult = validateProject(proj);

    const invalidProj = JSON.parse(JSON.stringify(proj));
    invalidProj.panels[0].boundary = invalidBox;
    const invalidResult = validateProject(invalidProj);

    const passed = validResult.valid && !invalidResult.valid;
    results.push({
      name: 'Normalized Coordinates Boundary Invariant (0.0 - 1.0)',
      category: 'Coordinate Math',
      passed,
      message: passed
        ? 'Correctly allows valid normalized bounds and rejects boundary overflow'
        : 'Failed coordinate boundary test',
      durationMs: Math.round(performance.now() - t2Start),
    });
  } catch (err) {
    results.push({
      name: 'Normalized Coordinates Boundary Invariant',
      category: 'Coordinate Math',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t2Start),
    });
  }

  // Test 3: Critical Image Identity Rule
  const t3Start = performance.now();
  try {
    const rawFilename = 'Episode_01_RAW_KR_[HD]_Scan.webp';
    const proj = createDefaultProject({ title: 'Identity Test' });
    const imgId = generateStableId('img');
    const panelId = generateStableId('pnl');

    proj.images.push({
      image_id: imgId,
      original_filename: rawFilename,
      mime_type: 'image/webp',
      width: 1080,
      height: 12000,
      file_size: 7800000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });

    proj.panels.push({
      id: panelId,
      image_id: imgId,
      panel_index: 0,
      order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 0.15 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const preserved =
      proj.images[0].original_filename === rawFilename &&
      proj.images[0].original_filename !== proj.images[0].image_id &&
      proj.panels[0].id === panelId &&
      proj.panels[0].image_id === imgId;

    results.push({
      name: 'Critical Image Identity: original_filename Preserved Separately',
      category: 'Identity Preservation',
      passed: preserved,
      message: preserved
        ? `Original filename preserved verbatim ('${rawFilename}') alongside stable internal IDs`
        : 'Filename was improperly modified',
      durationMs: Math.round(performance.now() - t3Start),
    });
  } catch (err) {
    results.push({
      name: 'Critical Image Identity: original_filename Preserved Separately',
      category: 'Identity Preservation',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t3Start),
    });
  }

  // ==========================================
  // 2. Part 1.2 — Image Import Engine Tests
  // ==========================================

  // Test 4: Single JPG Import & Dimension Extraction
  const t4Start = performance.now();
  try {
    const jpgFile = await createSyntheticImageFile('page_001.jpg', 'image/jpeg', 800, 1600);
    const inspected = await inspectSelectedFiles([jpgFile], []);
    const item = inspected[0];

    const passed =
      item &&
      item.status === 'ready' &&
      item.original_filename === 'page_001.jpg' &&
      item.mime_type === 'image/jpeg' &&
      item.width === 800 &&
      item.height === 1600;

    cleanupPreviewUrls(inspected);
    results.push({
      name: 'Import Engine: Single JPG Format & Dimension Extraction',
      category: 'Import Engine',
      passed,
      message: passed
        ? `Successfully parsed JPG ('${item.original_filename}', ${item.width}x${item.height})`
        : 'Failed JPG parsing or dimension extraction',
      durationMs: Math.round(performance.now() - t4Start),
    });
  } catch (err) {
    results.push({
      name: 'Import Engine: Single JPG Format & Dimension Extraction',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t4Start),
    });
  }

  // Test 5: Single PNG & Single WEBP Import
  const t5Start = performance.now();
  try {
    const pngFile = await createSyntheticImageFile('ch2_005.png', 'image/png', 900, 1800);
    const webpFile = await createSyntheticImageFile('IMG_4821.webp', 'image/webp', 1080, 2400);

    const inspected = await inspectSelectedFiles([pngFile, webpFile], []);

    const pngOk =
      inspected[0]?.status === 'ready' &&
      inspected[0]?.original_filename === 'ch2_005.png' &&
      inspected[0]?.mime_type === 'image/png';
    const webpOk =
      inspected[1]?.status === 'ready' &&
      inspected[1]?.original_filename === 'IMG_4821.webp' &&
      inspected[1]?.mime_type === 'image/webp';

    cleanupPreviewUrls(inspected);
    const passed = Boolean(pngOk && webpOk);
    results.push({
      name: 'Import Engine: PNG and WEBP Multi-Format Ingestion',
      category: 'Import Engine',
      passed,
      message: passed
        ? 'Successfully inspected PNG and WEBP files preserving exact extensions and types'
        : 'PNG/WEBP parsing failure',
      durationMs: Math.round(performance.now() - t5Start),
    });
  } catch (err) {
    results.push({
      name: 'Import Engine: PNG and WEBP Multi-Format Ingestion',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t5Start),
    });
  }

  // Test 6: Rejection of Unsupported File Types (e.g. GIF, TXT, PDF)
  const t6Start = performance.now();
  try {
    const gifFile = new File(['GIF89a_fake_data'], 'animation.gif', { type: 'image/gif' });
    const txtFile = new File(['hello text'], 'notes.txt', { type: 'text/plain' });

    const inspected = await inspectSelectedFiles([gifFile, txtFile], []);
    const gifRejected = inspected[0]?.status === 'invalid' && inspected[0]?.errorMessage?.includes('Unsupported');
    const txtRejected = inspected[1]?.status === 'invalid' && inspected[1]?.errorMessage?.includes('Unsupported');

    const passed = Boolean(gifRejected && txtRejected);
    cleanupPreviewUrls(inspected);
    results.push({
      name: 'Import Engine: Unsupported Format Rejection (GIF / TXT / PDF)',
      category: 'Import Engine',
      passed,
      message: passed
        ? 'Successfully flagged unsupported MIME types with informative error messages'
        : 'Unsupported file was improperly accepted',
      durationMs: Math.round(performance.now() - t6Start),
    });
  } catch (err) {
    results.push({
      name: 'Import Engine: Unsupported Format Rejection',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t6Start),
    });
  }

  // Test 7: Corrupted / Unreadable Image Handling
  const t7Start = performance.now();
  try {
    const corruptedPng = new File(['NOT_A_REAL_PNG_HEADER_CORRUPTED'], 'corrupted_page.png', {
      type: 'image/png',
    });
    const inspected = await inspectSelectedFiles([corruptedPng], []);
    const passed =
      inspected[0]?.status === 'invalid' &&
      inspected[0]?.errorMessage?.includes('decode');

    cleanupPreviewUrls(inspected);
    results.push({
      name: 'Import Engine: Corrupted / Unreadable Image Safety Handling',
      category: 'Import Engine',
      passed,
      message: passed
        ? 'Safely caught decoding failure for corrupted image without crashing execution'
        : 'Corrupted image handling failed',
      durationMs: Math.round(performance.now() - t7Start),
    });
  } catch (err) {
    results.push({
      name: 'Import Engine: Corrupted / Unreadable Image Safety Handling',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t7Start),
    });
  }

  // Test 8: Duplicate Detection & Skip / Import Anyway Options
  const t8Start = performance.now();
  try {
    const imgFile = await createSyntheticImageFile('chapter17-003.jpg', 'image/jpeg', 1000, 2000);
    const existingImages: SourceImage[] = [
      {
        image_id: 'img_existing_123',
        original_filename: 'chapter17-003.jpg',
        mime_type: 'image/jpeg',
        width: 1000,
        height: 2000,
        file_size: imgFile.size,
        source_order: 0,
        created_at: new Date().toISOString(),
      },
    ];

    const inspected = await inspectSelectedFiles([imgFile], existingImages);
    const duplicateDetected =
      inspected[0]?.status === 'duplicate' &&
      inspected[0]?.isDuplicate === true &&
      inspected[0]?.duplicateAction === 'skip';

    cleanupPreviewUrls(inspected);
    results.push({
      name: 'Duplicate Engine: Filename + Size Matching & Non-Destructive Skip',
      category: 'Duplicate Engine',
      passed: duplicateDetected,
      message: duplicateDetected
        ? 'Correctly identified existing image match and defaulted to non-destructive skip'
        : 'Duplicate was not recognized',
      durationMs: Math.round(performance.now() - t8Start),
    });
  } catch (err) {
    results.push({
      name: 'Duplicate Engine: Filename + Size Matching',
      category: 'Duplicate Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t8Start),
    });
  }

  // Test 9: Complete Batch Execution & Panel-Source Linkage
  const t9Start = performance.now();
  try {
    const testProject = createDefaultProject({ title: 'Batch Linkage Test' });
    await storage.saveProject(testProject);

    const f1 = await createSyntheticImageFile('p1.png', 'image/png', 500, 1000);
    const f2 = await createSyntheticImageFile('p2.webp', 'image/webp', 600, 1200);

    const inspected = await inspectSelectedFiles([f1, f2], []);
    const batchResult = await executeBatchImport(testProject.id, inspected, 0);

    const countOk = batchResult.successfulImages.length === 2 && batchResult.successfulPanels.length === 2;
    const idsUnique =
      batchResult.successfulImages[0].image_id !== batchResult.successfulImages[1].image_id &&
      batchResult.successfulPanels[0].id !== batchResult.successfulPanels[1].id;
    const linksValid =
      batchResult.successfulPanels[0].image_id === batchResult.successfulImages[0].image_id &&
      batchResult.successfulPanels[1].image_id === batchResult.successfulImages[1].image_id;
    const filenamesPreserved =
      batchResult.successfulImages[0].original_filename === 'p1.png' &&
      batchResult.successfulImages[1].original_filename === 'p2.webp';

    // Verify binary blobs stored in IndexedDB
    const blob1 = await storage.getImageBlob(batchResult.successfulImages[0].image_id);
    const blob2 = await storage.getImageBlob(batchResult.successfulImages[1].image_id);
    const blobsExist = Boolean(blob1 && blob2 && blob1.size > 0 && blob2.size > 0);

    // Clean up
    await storage.deleteProject(testProject.id);
    await storage.deleteImageBlob(batchResult.successfulImages[0].image_id);
    await storage.deleteImageBlob(batchResult.successfulImages[1].image_id);
    cleanupPreviewUrls(inspected);

    const passed = Boolean(countOk && idsUnique && linksValid && filenamesPreserved && blobsExist);
    results.push({
      name: 'Import Engine: Batch Execution, Stable IDs & Panel Linkage',
      category: 'Import Engine',
      passed,
      message: passed
        ? 'Successfully generated stable unique IDs, linked Panels->SourceImages, and stored binary blobs'
        : 'Linkage or storage mismatch',
      durationMs: Math.round(performance.now() - t9Start),
    });
  } catch (err) {
    results.push({
      name: 'Import Engine: Batch Execution, Stable IDs & Panel Linkage',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t9Start),
    });
  }

  // Test 10: Partial Batch Failure Isolation (Safe Import Recovery)
  const t10Start = performance.now();
  try {
    const testProject = createDefaultProject({ title: 'Partial Failure Test' });
    await storage.saveProject(testProject);

    const validFile = await createSyntheticImageFile('valid_page.png', 'image/png', 400, 800);
    const corruptedFile = new File(['CORRUPT_BYTES'], 'bad_page.png', { type: 'image/png' });

    const inspected = await inspectSelectedFiles([validFile, corruptedFile], []);
    const batchResult = await executeBatchImport(testProject.id, inspected, 0);

    // Valid file must be imported, corrupted skipped without rolling back valid
    const passed = batchResult.successfulImages.length === 1 && batchResult.successfulImages[0].original_filename === 'valid_page.png';

    await storage.deleteProject(testProject.id);
    if (batchResult.successfulImages[0]) {
      await storage.deleteImageBlob(batchResult.successfulImages[0].image_id);
    }
    cleanupPreviewUrls(inspected);

    results.push({
      name: 'Import Engine: Partial Batch Failure Isolation',
      category: 'Import Engine',
      passed,
      message: passed
        ? 'Successful imports were preserved when another file in the batch failed'
        : 'Partial batch failure handling failed',
      durationMs: Math.round(performance.now() - t10Start),
    });
  } catch (err) {
    results.push({
      name: 'Import Engine: Partial Batch Failure Isolation',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t10Start),
    });
  }

  // Test 11: IndexedDB Persistence Round-Trip & Zod Schema Validation
  const t11Start = performance.now();
  try {
    const testProject = createDefaultProject({ title: 'Persistence Roundtrip' });
    const imgId = generateStableId('img');
    const panelId = generateStableId('pnl');

    const sourceImage: SourceImage = {
      image_id: imgId,
      original_filename: 'Episode_01_page_001.webp',
      mime_type: 'image/webp',
      width: 1080,
      height: 3200,
      file_size: 2048500,
      source_order: 0,
      created_at: new Date().toISOString(),
    };

    const panel: Panel = {
      id: panelId,
      image_id: imgId,
      panel_index: 0,
      order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    testProject.images.push(sourceImage);
    testProject.panels.push(panel);

    // Save and retrieve
    await storage.saveProject(testProject);
    const retrieved = await storage.getProject(testProject.id);

    const validation = validateProject(retrieved || {});
    const passed =
      validation.valid &&
      retrieved?.images.length === 1 &&
      retrieved?.images[0].original_filename === 'Episode_01_page_001.webp' &&
      retrieved?.panels[0].id === panelId;

    await storage.deleteProject(testProject.id);

    results.push({
      name: 'Persistence & Zod Validation Roundtrip',
      category: 'Storage',
      passed,
      message: passed
        ? 'Stored project with imported image/panel records passed strict Zod schema validation'
        : 'Zod validation or roundtrip error',
      durationMs: Math.round(performance.now() - t11Start),
    });
  } catch (err) {
    results.push({
      name: 'Persistence & Zod Validation Roundtrip',
      category: 'Storage',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t11Start),
    });
  }

  // Test 12: Stress & Scale Simulation (50 Synthetic Images Batch)
  const t12Start = performance.now();
  try {
    const testProject = createDefaultProject({ title: 'Scale Simulation (50)' });
    const count = 50;

    for (let i = 0; i < count; i++) {
      const imgId = generateStableId('img');
      const panelId = generateStableId('pnl');
      const filename = `chapter_10_scroll_${String(i + 1).padStart(3, '0')}.webp`;

      testProject.images.push({
        image_id: imgId,
        original_filename: filename,
        mime_type: 'image/webp',
        width: 1080,
        height: 2400,
        file_size: 1500000 + i * 1000,
        source_order: i,
        created_at: new Date().toISOString(),
      });

      testProject.panels.push({
        id: panelId,
        image_id: imgId,
        panel_index: 0,
        order: i,
        boundary: { x: 0, y: 0, width: 1, height: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const validation = validateProject(testProject);
    await storage.saveProject(testProject);
    const retrieved = await storage.getProject(testProject.id);

    const passed =
      validation.valid &&
      retrieved?.images.length === 50 &&
      retrieved?.panels.length === 50 &&
      retrieved?.images[49].source_order === 49;

    await storage.deleteProject(testProject.id);

    results.push({
      name: 'Stress & Scale Simulation (50 Images Schema & Storage Batch)',
      category: 'Stress & Performance',
      passed,
      message: passed
        ? `Validated and persisted 50 manhwa scroll images in ${Math.round(performance.now() - t12Start)}ms`
        : 'Failed 50 image batch test',
      durationMs: Math.round(performance.now() - t12Start),
    });
  } catch (err) {
    results.push({
      name: 'Stress & Scale Simulation (50 Images Batch)',
      category: 'Stress & Performance',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t12Start),
    });
  }

  // ==========================================
  // 3. Part 1.3 — Panel Ordering & Sequence Management Tests
  // ==========================================

  // Test 13: Basic Directional Ordering Operations (Move Up, Down, First, Last, Position)
  const t13Start = performance.now();
  try {
    const pA: Panel = {
      id: 'pnl_A',
      image_id: 'img_A',
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pB: Panel = {
      id: 'pnl_B',
      image_id: 'img_B',
      panel_index: 0,
      order: 1,
      initial_order: 1,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pC: Panel = {
      id: 'pnl_C',
      image_id: 'img_C',
      panel_index: 0,
      order: 2,
      initial_order: 2,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pD: Panel = {
      id: 'pnl_D',
      image_id: 'img_D',
      panel_index: 0,
      order: 3,
      initial_order: 3,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const initial = [pA, pB, pC, pD];

    // Move B up: Expect [B, A, C, D]
    const afterBUp = movePanelUp(initial, 'pnl_B');
    const orderBUp = afterBUp.map((p) => p.id).join('');

    // Move B down from initial: Expect [A, C, B, D]
    const afterBDown = movePanelDown(initial, 'pnl_B');
    const orderBDown = afterBDown.map((p) => p.id).join('');

    // Move C first from initial: Expect [C, A, B, D]
    const afterCFirst = movePanelToFirst(initial, 'pnl_C');
    const orderCFirst = afterCFirst.map((p) => p.id).join('');

    // Move A last from initial: Expect [B, C, D, A]
    const afterALast = movePanelToLast(initial, 'pnl_A');
    const orderALast = afterALast.map((p) => p.id).join('');

    // Move A to index 2: Expect [B, C, A, D]
    const afterAPos2 = movePanelToPosition(initial, 'pnl_A', 2);
    const orderAPos2 = afterAPos2.map((p) => p.id).join('');

    const passed =
      orderBUp === 'BACD' &&
      orderBDown === 'ACBD' &&
      orderCFirst === 'CABD' &&
      orderALast === 'BCDA' &&
      orderAPos2 === 'BCAD' &&
      afterBUp.every((p, idx) => p.order === idx) &&
      afterBDown.every((p, idx) => p.order === idx) &&
      afterCFirst.every((p, idx) => p.order === idx) &&
      afterALast.every((p, idx) => p.order === idx) &&
      afterAPos2.every((p, idx) => p.order === idx);

    results.push({
      name: 'Ordering Engine: Basic Move Operations (Up, Down, First, Last, Position)',
      category: 'Ordering Engine',
      passed,
      message: passed
        ? 'Successfully performed all directional swaps and verified 0..N-1 contiguous sequences'
        : `Order mismatch: BUp=${orderBUp}, BDown=${orderBDown}, CFirst=${orderCFirst}, ALast=${orderALast}, APos2=${orderAPos2}`,
      durationMs: Math.round(performance.now() - t13Start),
    });
  } catch (err) {
    results.push({
      name: 'Ordering Engine: Basic Move Operations',
      category: 'Ordering Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t13Start),
    });
  }

  // Test 14: Reverse Order Operation
  const t14Start = performance.now();
  try {
    const panels: Panel[] = ['pnl_A', 'pnl_B', 'pnl_C', 'pnl_D'].map((id, idx) => ({
      id,
      image_id: `img_${id}`,
      panel_index: 0,
      order: idx,
      initial_order: idx,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const reversed = reversePanelOrder(panels);
    const reversedIds = reversed.map((p) => p.id).join('');
    const ordersContiguous = reversed.every((p, idx) => p.order === idx);

    const passed = reversedIds === 'pnl_Dpnl_Cpnl_Bpnl_A' && ordersContiguous;
    results.push({
      name: 'Ordering Engine: Reverse Sequence Operation (A B C D -> D C B A)',
      category: 'Ordering Engine',
      passed,
      message: passed
        ? 'Reversed 4-panel sequence accurately with contiguous order re-indexing'
        : `Failed reverse sequence: got ${reversedIds}`,
      durationMs: Math.round(performance.now() - t14Start),
    });
  } catch (err) {
    results.push({
      name: 'Ordering Engine: Reverse Sequence Operation',
      category: 'Ordering Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t14Start),
    });
  }

  // Test 15: Reset to Initial Import Order
  const t15Start = performance.now();
  try {
    // Original import order was A, B, C, D (indices 0, 1, 2, 3)
    const pA: Panel = {
      id: 'pnl_A',
      image_id: 'img_A',
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pB: Panel = {
      id: 'pnl_B',
      image_id: 'img_B',
      panel_index: 0,
      order: 1,
      initial_order: 1,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pC: Panel = {
      id: 'pnl_C',
      image_id: 'img_C',
      panel_index: 0,
      order: 2,
      initial_order: 2,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const pD: Panel = {
      id: 'pnl_D',
      image_id: 'img_D',
      panel_index: 0,
      order: 3,
      initial_order: 3,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Current scrambled state: D, B, A, C
    const scrambled: Panel[] = [
      { ...pD, order: 0 },
      { ...pB, order: 1 },
      { ...pA, order: 2 },
      { ...pC, order: 3 },
    ];

    const images: SourceImage[] = [
      { image_id: 'img_A', original_filename: 'scan_01.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 0, created_at: new Date().toISOString() },
      { image_id: 'img_B', original_filename: 'scan_02.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 1, created_at: new Date().toISOString() },
      { image_id: 'img_C', original_filename: 'scan_03.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 2, created_at: new Date().toISOString() },
      { image_id: 'img_D', original_filename: 'scan_04.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 3, created_at: new Date().toISOString() },
    ];

    const isModifiedBefore = isPanelOrderModified(scrambled, images);
    const restored = resetPanelOrderToImport(scrambled, images);
    const isModifiedAfter = isPanelOrderModified(restored, images);

    const restoredIds = restored.map((p) => p.id).join('');
    const passed =
      isModifiedBefore === true &&
      isModifiedAfter === false &&
      restoredIds === 'pnl_Apnl_Bpnl_Cpnl_D' &&
      restored.every((p, idx) => p.order === idx);

    results.push({
      name: 'Ordering Engine: Reset to Initial Import Order (D B A C -> A B C D)',
      category: 'Ordering Engine',
      passed,
      message: passed
        ? 'Restored exact initial import sequence without parsing filenames'
        : `Failed reset to import order: got ${restoredIds}`,
      durationMs: Math.round(performance.now() - t15Start),
    });
  } catch (err) {
    results.push({
      name: 'Ordering Engine: Reset to Initial Import Order',
      category: 'Ordering Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t15Start),
    });
  }

  // Test 16: Boundary Conditions & Edge Case Safety
  const t16Start = performance.now();
  try {
    const singlePanel: Panel[] = [
      {
        id: 'pnl_solo',
        image_id: 'img_solo',
        panel_index: 0,
        order: 0,
        boundary: { x: 0, y: 0, width: 1, height: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const emptyPanels: Panel[] = [];

    // Safe no-ops
    const moveSingleUp = movePanelUp(singlePanel, 'pnl_solo');
    const moveSingleDown = movePanelDown(singlePanel, 'pnl_solo');
    const reverseSingle = reversePanelOrder(singlePanel);
    const moveEmptyUp = movePanelUp(emptyPanels, 'any');
    const reverseEmpty = reversePanelOrder(emptyPanels);

    const twoPanels: Panel[] = [
      { id: 'pnl_1', image_id: 'img_1', panel_index: 0, order: 0, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'pnl_2', image_id: 'img_2', panel_index: 0, order: 1, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    // Moving first item up -> no-op
    const moveFirstUp = movePanelUp(twoPanels, 'pnl_1');
    // Moving last item down -> no-op
    const moveLastDown = movePanelDown(twoPanels, 'pnl_2');

    const passed =
      moveSingleUp.length === 1 &&
      moveSingleDown.length === 1 &&
      reverseSingle.length === 1 &&
      moveEmptyUp.length === 0 &&
      reverseEmpty.length === 0 &&
      moveFirstUp[0].id === 'pnl_1' &&
      moveLastDown[1].id === 'pnl_2';

    results.push({
      name: 'Ordering Engine: Boundary Conditions & Edge Case Safety',
      category: 'Ordering Engine',
      passed,
      message: passed
        ? 'Safely handled boundaries: top-of-list no-ops, bottom-of-list no-ops, single-item and empty arrays'
        : 'Boundary test failed',
      durationMs: Math.round(performance.now() - t16Start),
    });
  } catch (err) {
    results.push({
      name: 'Ordering Engine: Boundary Conditions & Edge Case Safety',
      category: 'Ordering Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t16Start),
    });
  }

  // Test 17: Critical Identity & Filename Preservation through Multiple Reorder Cycles
  const t17Start = performance.now();
  try {
    const rawFilenames = [
      'RAW_EP01_[HD]_001_Scan.webp',
      'RAW_EP01_[HD]_002_Scan.webp',
      'RAW_EP01_[HD]_003_Scan.webp',
    ];

    const project = createDefaultProject({ title: 'Identity Audit Project' });
    const imageIds = ['img_001_aaa', 'img_002_bbb', 'img_003_ccc'];
    const panelIds = ['pnl_001_xxx', 'pnl_002_yyy', 'pnl_003_zzz'];

    for (let i = 0; i < 3; i++) {
      project.images.push({
        image_id: imageIds[i],
        original_filename: rawFilenames[i],
        mime_type: 'image/webp',
        width: 1080,
        height: 2400,
        file_size: 2500000,
        source_order: i,
        created_at: new Date().toISOString(),
      });
      project.panels.push({
        id: panelIds[i],
        image_id: imageIds[i],
        panel_index: 0,
        order: i,
        initial_order: i,
        boundary: { x: 0, y: 0, width: 1, height: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Perform multiple reorder cycles:
    // 1. Move panel 2 to first -> [2, 0, 1]
    project.panels = movePanelToFirst(project.panels, panelIds[2]);
    // 2. Move panel 0 down -> [2, 1, 0]
    project.panels = movePanelDown(project.panels, panelIds[0]);
    // 3. Reverse -> [0, 1, 2]
    project.panels = reversePanelOrder(project.panels);
    // 4. Move panel 1 to last -> [0, 2, 1]
    project.panels = movePanelToLast(project.panels, panelIds[1]);

    // Verify critical identity rules:
    const filenamesIntact =
      project.images[0].original_filename === rawFilenames[0] &&
      project.images[1].original_filename === rawFilenames[1] &&
      project.images[2].original_filename === rawFilenames[2];

    const imageIdsIntact =
      project.images[0].image_id === imageIds[0] &&
      project.images[1].image_id === imageIds[1] &&
      project.images[2].image_id === imageIds[2];

    const panelIdsIntact =
      project.panels.some((p) => p.id === panelIds[0]) &&
      project.panels.some((p) => p.id === panelIds[1]) &&
      project.panels.some((p) => p.id === panelIds[2]);

    const linksIntact = project.panels.every((p) => {
      const idx = panelIds.indexOf(p.id);
      return p.image_id === imageIds[idx];
    });

    const integrity = validatePanelSequenceIntegrity(project);
    const passed = filenamesIntact && imageIdsIntact && panelIdsIntact && linksIntact && integrity.valid;

    results.push({
      name: 'Identity Preservation: Verbatim Filenames & Stable IDs across Multiple Reorders',
      category: 'Identity Preservation',
      passed,
      message: passed
        ? '100% identity preservation confirmed: verbatim filenames, stable IDs, and linked references untouched'
        : 'Identity violation during reordering',
      durationMs: Math.round(performance.now() - t17Start),
    });
  } catch (err) {
    results.push({
      name: 'Identity Preservation: Verbatim Filenames & Stable IDs',
      category: 'Identity Preservation',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t17Start),
    });
  }

  // Test 18: Reordered Sequence IndexedDB Persistence Round-Trip
  const t18Start = performance.now();
  try {
    const testProject = createDefaultProject({ title: 'Reorder Persistence Roundtrip' });
    const p1Id = generateStableId('pnl');
    const p2Id = generateStableId('pnl');
    const p3Id = generateStableId('pnl');

    const i1Id = generateStableId('img');
    const i2Id = generateStableId('img');
    const i3Id = generateStableId('img');

    testProject.images = [
      { image_id: i1Id, original_filename: 'p1.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 0, created_at: new Date().toISOString() },
      { image_id: i2Id, original_filename: 'p2.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 1, created_at: new Date().toISOString() },
      { image_id: i3Id, original_filename: 'p3.png', mime_type: 'image/png', width: 800, height: 1600, file_size: 1000, source_order: 2, created_at: new Date().toISOString() },
    ];

    testProject.panels = [
      { id: p1Id, image_id: i1Id, panel_index: 0, order: 0, initial_order: 0, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: p2Id, image_id: i2Id, panel_index: 0, order: 1, initial_order: 1, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: p3Id, image_id: i3Id, panel_index: 0, order: 2, initial_order: 2, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    // Reorder: Move p3 to first -> [p3, p1, p2]
    testProject.panels = movePanelToFirst(testProject.panels, p3Id);

    // Save to IndexedDB
    await storage.saveProject(testProject);

    // Retrieve from IndexedDB
    const retrieved = await storage.getProject(testProject.id);

    const orderedRetrieved = retrieved ? getOrderedPanels(retrieved.panels) : [];
    const passed =
      retrieved !== null &&
      orderedRetrieved.length === 3 &&
      orderedRetrieved[0].id === p3Id &&
      orderedRetrieved[0].order === 0 &&
      orderedRetrieved[1].id === p1Id &&
      orderedRetrieved[1].order === 1 &&
      orderedRetrieved[2].id === p2Id &&
      orderedRetrieved[2].order === 2 &&
      validateProject(retrieved).valid;

    await storage.deleteProject(testProject.id);

    results.push({
      name: 'Persistence: Reordered Panel Sequence IndexedDB Round-Trip',
      category: 'Storage',
      passed,
      message: passed
        ? 'Reordered sequence persisted to IndexedDB and reloaded with exact order preserved'
        : 'Persistence roundtrip mismatch',
      durationMs: Math.round(performance.now() - t18Start),
    });
  } catch (err) {
    results.push({
      name: 'Persistence: Reordered Panel Sequence IndexedDB Round-Trip',
      category: 'Storage',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t18Start),
    });
  }

  // Test 19: High-Scale Sequence Stress Test (100 and 200 Panels Reordering)
  const t19Start = performance.now();
  try {
    const scaleProject = createDefaultProject({ title: '200 Panel Sequence Stress Test' });
    const count = 200;

    for (let i = 0; i < count; i++) {
      const imgId = generateStableId('img');
      const pnlId = generateStableId('pnl');
      scaleProject.images.push({
        image_id: imgId,
        original_filename: `page_${String(i + 1).padStart(3, '0')}.webp`,
        mime_type: 'image/webp',
        width: 1080,
        height: 2400,
        file_size: 1500000,
        source_order: i,
        created_at: new Date().toISOString(),
      });
      scaleProject.panels.push({
        id: pnlId,
        image_id: imgId,
        panel_index: 0,
        order: i,
        initial_order: i,
        boundary: { x: 0, y: 0, width: 1, height: 1 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Reorder operations on 200 panels:
    // 1. Move panel #180 to position 10
    const target180 = scaleProject.panels[180].id;
    scaleProject.panels = movePanelToPosition(scaleProject.panels, target180, 10);

    // 2. Move panel #50 to last
    const target50 = scaleProject.panels[50].id;
    scaleProject.panels = movePanelToLast(scaleProject.panels, target50);

    // 3. Reverse entire 200-panel sequence
    scaleProject.panels = reversePanelOrder(scaleProject.panels);

    // 4. Reset back to import order
    scaleProject.panels = resetPanelOrderToImport(scaleProject.panels, scaleProject.images);

    const integrity = validatePanelSequenceIntegrity(scaleProject);
    const passed =
      scaleProject.panels.length === 200 &&
      scaleProject.panels.every((p, idx) => p.order === idx && p.initial_order === idx) &&
      integrity.valid;

    results.push({
      name: 'Stress & Scale: 200-Panel Sequence Reordering & Integrity Benchmark',
      category: 'Stress & Performance',
      passed,
      message: passed
        ? `Executed complex reorder cycles on 200 panels with 100% integrity validation in ${Math.round(performance.now() - t19Start)}ms`
        : 'Scale reorder test failed',
      durationMs: Math.round(performance.now() - t19Start),
    });
  } catch (err) {
    results.push({
      name: 'Stress & Scale: 200-Panel Sequence Reordering',
      category: 'Stress & Performance',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t19Start),
    });
  }

  // ==========================================
  // 6. Asset Inspection & Review Workspace Tests
  // ==========================================

  // Test 20: Asset Inspection Report Generation & Binary Blob Health Verification
  const t20Start = performance.now();
  try {
    const proj = createDefaultProject({ title: 'Inspection Health Test' });
    const imgId = generateStableId('img');
    const pnlId = generateStableId('pnl');

    const file = await createSyntheticImageFile('chapter_01_p001.webp', 'image/webp', 800, 1600);
    await storage.saveImageBlob(proj.id, imgId, file, 'image/webp');

    proj.images.push({
      image_id: imgId,
      original_filename: 'chapter_01_p001.webp',
      mime_type: 'image/webp',
      width: 800,
      height: 1600,
      file_size: file.size,
      source_order: 0,
      created_at: new Date().toISOString(),
    });

    proj.panels.push({
      id: pnlId,
      image_id: imgId,
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await inspectProjectAssets(proj);

    const passed =
      report.totalPanels === 1 &&
      report.validPanelsCount === 1 &&
      report.missingBinaryCount === 0 &&
      report.missingImageRefCount === 0 &&
      report.panelReports.length === 1 &&
      report.panelReports[0].hasBlob === true &&
      report.panelReports[0].status === 'valid' &&
      formatAspectRatio(report.panelReports[0].width, report.panelReports[0].height) === '1:2.00';

    await storage.deleteImageBlob(imgId);

    results.push({
      name: 'Asset Inspection: Comprehensive Project Health & Blob Verification',
      category: 'Asset Inspection',
      passed,
      message: passed
        ? 'Successfully inspected asset binaries, aspect ratio, and generated valid health report'
        : 'Health report generation failed',
      durationMs: Math.round(performance.now() - t20Start),
    });
  } catch (err) {
    results.push({
      name: 'Asset Inspection: Comprehensive Project Health & Blob Verification',
      category: 'Asset Inspection',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t20Start),
    });
  }

  // Test 21: Asset Inspection Anomaly Detection (Missing Binary & Orphaned Panels)
  const t21Start = performance.now();
  try {
    const proj = createDefaultProject({ title: 'Anomaly Inspection Test' });
    const imgMissingId = generateStableId('img');
    const pnl1Id = generateStableId('pnl');
    const pnlOrphanId = generateStableId('pnl');

    // Panel 1: References image metadata whose blob is intentionally missing from IndexedDB
    proj.images.push({
      image_id: imgMissingId,
      original_filename: 'missing_blob.png',
      mime_type: 'image/png',
      width: 1000,
      height: 2000,
      file_size: 500000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });

    proj.panels.push({
      id: pnl1Id,
      image_id: imgMissingId,
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Panel 2: Orphaned panel referencing non-existent image_id
    proj.panels.push({
      id: pnlOrphanId,
      image_id: 'non_existent_image_id',
      panel_index: 1,
      order: 1,
      initial_order: 1,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await inspectProjectAssets(proj);

    const passed =
      report.totalPanels === 2 &&
      report.validPanelsCount === 0 &&
      report.missingBinaryCount === 1 &&
      report.missingImageRefCount === 1 &&
      report.panelReports[0].status === 'missing_binary' &&
      report.panelReports[1].status === 'missing_image_ref';

    results.push({
      name: 'Asset Inspection: Missing Binary & Orphaned Panel Anomaly Detection',
      category: 'Asset Inspection',
      passed,
      message: passed
        ? 'Accurately detected missing binary blob and orphaned panel reference'
        : 'Anomaly detection failed to flag issues',
      durationMs: Math.round(performance.now() - t21Start),
    });
  } catch (err) {
    results.push({
      name: 'Asset Inspection: Missing Binary & Orphaned Panel Anomaly Detection',
      category: 'Asset Inspection',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t21Start),
    });
  }

  // Test 22: Image Previewer Zoom Math & Aspect Ratio Helper Precision
  const t22Start = performance.now();
  try {
    const zoomFit = calculateOptimalZoom(1000, 2000, 500, 500, 'fit');
    const zoomWidth = calculateOptimalZoom(1000, 2000, 500, 500, 'fit-width');
    const zoomHeight = calculateOptimalZoom(1000, 2000, 500, 500, 'fit-height');
    const zoomOriginal = calculateOptimalZoom(1000, 2000, 500, 500, 'original');

    const arTall = formatAspectRatio(800, 2400); // 1:3.00
    const arSquare = formatAspectRatio(1000, 1000); // 1:1.00
    const arWide = formatAspectRatio(1600, 900); // 16:9

    const passed =
      zoomFit === 0.25 &&
      zoomWidth === 0.5 &&
      zoomHeight === 0.25 &&
      zoomOriginal === 1 &&
      arTall === '1:3.00' &&
      arSquare === '1:1.00' &&
      arWide === '16:9';

    results.push({
      name: 'Inspection Math: Zoom Mode Calculations & Aspect Ratio Formatting',
      category: 'Asset Inspection',
      passed,
      message: passed
        ? 'Precision zoom math and canonical aspect ratio calculations validated'
        : 'Zoom calculation mismatch',
      durationMs: Math.round(performance.now() - t22Start),
    });
  } catch (err) {
    results.push({
      name: 'Inspection Math: Zoom Mode Calculations & Aspect Ratio Formatting',
      category: 'Asset Inspection',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t22Start),
    });
  }

  // Test 23: File Input & Device File Picker Ingestion Compliance
  const t23Start = performance.now();
  try {
    // Validate supported file extensions whitelist
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const invalidExtensions = ['.gif', '.bmp', '.pdf', '.svg', '.tiff'];

    const validResults = validExtensions.every((ext) =>
      isSupportedImageType({ type: '', name: `test_page${ext}` })
    );

    const invalidResults = invalidExtensions.every(
      (ext) => !isSupportedImageType({ type: '', name: `test_page${ext}` })
    );

    const passed = validResults && invalidResults;

    results.push({
      name: 'File Ingestion Compliance: Explicit Extension Whitelist & Standard Input',
      category: 'Import Engine',
      passed,
      message: passed
        ? 'Validated explicit file extensions whitelist (.jpg, .jpeg, .png, .webp) with immediate client-side validation'
        : 'File ingestion extension validation failed',
      durationMs: Math.round(performance.now() - t23Start),
    });
  } catch (err) {
    results.push({
      name: 'File Ingestion Compliance: Explicit Extension Whitelist & Standard Input',
      category: 'Import Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t23Start),
    });
  }

  // Test 24: Comprehensive Interactive Panel Reorder Engine Suite
  const t24Start = performance.now();
  try {
    const panels: Panel[] = [
      { id: 'p0', image_id: 'i0', panel_index: 0, order: 0, initial_order: 0, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'p1', image_id: 'i1', panel_index: 0, order: 1, initial_order: 1, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'p2', image_id: 'i2', panel_index: 0, order: 2, initial_order: 2, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'p3', image_id: 'i3', panel_index: 0, order: 3, initial_order: 3, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'p4', image_id: 'i4', panel_index: 0, order: 4, initial_order: 4, boundary: { x: 0, y: 0, width: 1, height: 1 }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];

    // Step 1: Move p3 Up -> [p0, p1, p3, p2, p4]
    const s1 = movePanelUp(panels, 'p3');
    const s1Order = s1.map((p) => p.id).join(',');

    // Step 2: Move p0 Down -> [p1, p0, p3, p2, p4]
    const s2 = movePanelDown(s1, 'p0');
    const s2Order = s2.map((p) => p.id).join(',');

    // Step 3: Move p4 to First -> [p4, p1, p0, p3, p2]
    const s3 = movePanelToFirst(s2, 'p4');
    const s3Order = s3.map((p) => p.id).join(',');

    // Step 4: Move p1 to Last -> [p4, p0, p3, p2, p1]
    const s4 = movePanelToLast(s3, 'p1');
    const s4Order = s4.map((p) => p.id).join(',');

    // Step 5: Move p3 to Position 0 -> [p3, p4, p0, p2, p1]
    const s5 = movePanelToPosition(s4, 'p3', 0);
    const s5Order = s5.map((p) => p.id).join(',');

    // Step 6: Contiguity check
    const isContiguous = s5.every((p, idx) => p.order === idx);

    const passed =
      s1Order === 'p0,p1,p3,p2,p4' &&
      s2Order === 'p1,p0,p3,p2,p4' &&
      s3Order === 'p4,p1,p0,p3,p2' &&
      s4Order === 'p4,p0,p3,p2,p1' &&
      s5Order === 'p3,p4,p0,p2,p1' &&
      isContiguous;

    results.push({
      name: 'Ordering Engine: Move Up, Down, First, Last, and Position Destination Matrix',
      category: 'Ordering Engine',
      passed,
      message: passed
        ? 'All 5 reorder movements (Up, Down, First, Last, Target Position) passed strict order tests'
        : `Reorder sequence failed: s1=${s1Order}, s2=${s2Order}, s3=${s3Order}, s4=${s4Order}, s5=${s5Order}`,
      durationMs: Math.round(performance.now() - t24Start),
    });
  } catch (err) {
    results.push({
      name: 'Ordering Engine: Move Up, Down, First, Last, and Position Destination Matrix',
      category: 'Ordering Engine',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t24Start),
    });
  }

  // ==========================================
  // Part 1.5: Pre-Analysis Validation Gate Tests
  // ==========================================

  // Test 25: Pre-Analysis Readiness for valid complete project
  const t25Start = performance.now();
  try {
    const validProj = createDefaultProject({ title: 'Validation Pass Test' });
    const imgId = generateStableId('img');
    validProj.images.push({
      image_id: imgId,
      original_filename: 'panel_page_01.png',
      mime_type: 'image/png',
      width: 1000,
      height: 2000,
      file_size: 150000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });
    validProj.panels.push({
      id: generateStableId('pnl'),
      image_id: imgId,
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await validateProjectForAnalysis(validProj, { checkBlobsInStorage: false });
    const passed = report.readiness === 'READY' && report.errors.length === 0;

    results.push({
      name: 'Validation Gate: Clean Project yields READY state',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Clean project correctly verified with READY status' : `Got readiness: ${report.readiness}`,
      durationMs: Math.round(performance.now() - t25Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Clean Project yields READY state',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t25Start),
    });
  }

  // Test 26: Pre-Analysis Readiness for empty project yields BLOCKED without corruption
  const t26Start = performance.now();
  try {
    const emptyProj = createDefaultProject({ title: 'Empty Proj' });
    const report = await validateProjectForAnalysis(emptyProj, { checkBlobsInStorage: false });
    const passed = report.readiness === 'BLOCKED' && report.readiness_reason.includes('No panels');

    results.push({
      name: 'Validation Gate: Empty Project yields BLOCKED with clear message',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Empty project marked BLOCKED with non-corrupted explanation' : `Got: ${report.readiness}`,
      durationMs: Math.round(performance.now() - t26Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Empty Project yields BLOCKED with clear message',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t26Start),
    });
  }

  // Test 27: Pre-Analysis Readiness detects missing panel IDs
  const t27Start = performance.now();
  try {
    const brokenProj = createDefaultProject({ title: 'Broken Panel ID' });
    const imgId = generateStableId('img');
    brokenProj.images.push({
      image_id: imgId,
      original_filename: 'sample.png',
      mime_type: 'image/png',
      width: 1000,
      height: 1000,
      file_size: 1000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });
    brokenProj.panels.push({
      id: '', // Missing ID
      image_id: imgId,
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await validateProjectForAnalysis(brokenProj, { checkBlobsInStorage: false });
    const hasPanelIdError = report.errors.some((e) => e.category === 'panel_identity');
    const passed = report.readiness === 'BLOCKED' && hasPanelIdError;

    results.push({
      name: 'Validation Gate: Missing Panel ID correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Missing panel ID detected and flagged as blocking error' : 'Failed to detect missing panel ID',
      durationMs: Math.round(performance.now() - t27Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Missing Panel ID correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t27Start),
    });
  }

  // Test 28: Pre-Analysis Readiness detects duplicate panel IDs
  const t28Start = performance.now();
  try {
    const dupProj = createDefaultProject({ title: 'Duplicate Panel ID' });
    const imgId = generateStableId('img');
    dupProj.images.push({
      image_id: imgId,
      original_filename: 'sample.png',
      mime_type: 'image/png',
      width: 1000,
      height: 1000,
      file_size: 1000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });
    dupProj.panels.push(
      {
        id: 'dup_panel_123',
        image_id: imgId,
        panel_index: 0,
        order: 0,
        initial_order: 0,
        boundary: { x: 0, y: 0, width: 0.5, height: 0.5 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'dup_panel_123', // duplicate ID
        image_id: imgId,
        panel_index: 1,
        order: 1,
        initial_order: 1,
        boundary: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    const report = await validateProjectForAnalysis(dupProj, { checkBlobsInStorage: false });
    const hasDupError = report.errors.some((e) => e.category === 'duplicate_ids');
    const passed = report.readiness === 'BLOCKED' && hasDupError;

    results.push({
      name: 'Validation Gate: Duplicate Panel ID collision correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Duplicate panel ID collision detected and blocked' : 'Failed to detect duplicate panel IDs',
      durationMs: Math.round(performance.now() - t28Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Duplicate Panel ID collision correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t28Start),
    });
  }

  // Test 29: Pre-Analysis Readiness detects broken panel-to-image reference
  const t29Start = performance.now();
  try {
    const brokenRefProj = createDefaultProject({ title: 'Broken Ref' });
    brokenRefProj.panels.push({
      id: generateStableId('pnl'),
      image_id: 'non_existent_image_id_xyz',
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await validateProjectForAnalysis(brokenRefProj, { checkBlobsInStorage: false });
    const hasRelError = report.errors.some((e) => e.category === 'relationships');
    const passed = report.readiness === 'BLOCKED' && hasRelError;

    results.push({
      name: 'Validation Gate: Broken panel-image linkage correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Broken image reference detected and flagged as blocking' : 'Failed to detect broken reference',
      durationMs: Math.round(performance.now() - t29Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Broken panel-image linkage correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t29Start),
    });
  }

  // Test 30: Pre-Analysis Readiness detects sequence discontinuity / gap
  const t30Start = performance.now();
  try {
    const gapProj = createDefaultProject({ title: 'Sequence Gap' });
    const imgId = generateStableId('img');
    gapProj.images.push({
      image_id: imgId,
      original_filename: 'gap.png',
      mime_type: 'image/png',
      width: 1000,
      height: 1000,
      file_size: 1000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });
    gapProj.panels.push(
      {
        id: generateStableId('pnl'),
        image_id: imgId,
        panel_index: 0,
        order: 0,
        initial_order: 0,
        boundary: { x: 0, y: 0, width: 0.5, height: 0.5 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateStableId('pnl'),
        image_id: imgId,
        panel_index: 1,
        order: 3, // Gap: expected 1
        initial_order: 1,
        boundary: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    const report = await validateProjectForAnalysis(gapProj, { checkBlobsInStorage: false });
    const hasSeqError = report.errors.some((e) => e.category === 'sequence_integrity');
    const passed = report.readiness === 'BLOCKED' && hasSeqError;

    results.push({
      name: 'Validation Gate: Non-contiguous sequence gap correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Sequence order gap (0, 3) detected and flagged as blocking' : 'Failed to detect sequence gap',
      durationMs: Math.round(performance.now() - t30Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Non-contiguous sequence gap correctly BLOCKS analysis',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t30Start),
    });
  }

  // Test 31: Pre-Analysis Readiness flags orphan images with warning
  const t31Start = performance.now();
  try {
    const orphanProj = createDefaultProject({ title: 'Orphan Image' });
    const img1 = generateStableId('img');
    const img2 = generateStableId('img');
    orphanProj.images.push(
      {
        image_id: img1,
        original_filename: 'active.png',
        mime_type: 'image/png',
        width: 1000,
        height: 1000,
        file_size: 1000,
        source_order: 0,
        created_at: new Date().toISOString(),
      },
      {
        image_id: img2,
        original_filename: 'orphan.png',
        mime_type: 'image/png',
        width: 1000,
        height: 1000,
        file_size: 1000,
        source_order: 1,
        created_at: new Date().toISOString(),
      }
    );
    orphanProj.panels.push({
      id: generateStableId('pnl'),
      image_id: img1, // Only linked to img1
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await validateProjectForAnalysis(orphanProj, { checkBlobsInStorage: false });
    const hasOrphanWarning = report.warnings.some((w) => w.check_id === 'orphan_source_images');
    const passed = report.readiness === 'READY_WITH_WARNINGS' && hasOrphanWarning;

    results.push({
      name: 'Validation Gate: Orphan source image yields READY_WITH_WARNINGS',
      category: 'Validation Gate',
      passed,
      message: passed ? 'Orphan image correctly generated non-blocking warning' : `Got readiness: ${report.readiness}`,
      durationMs: Math.round(performance.now() - t31Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Orphan source image yields READY_WITH_WARNINGS',
      category: 'Validation Gate',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t31Start),
    });
  }

  // ==========================================
  // Part 2.1: Visual Analysis Data Model & Engine Foundation Tests
  // ==========================================

  // Test 32: Valid VisualAnalysis schema (full structure & minimal structure)
  const t32Start = performance.now();
  try {
    const minimalAnalysis: VisualAnalysis = {
      analysis_version: '1.0.0',
      status: 'NOT_ANALYZED',
    };
    const minimalParse = VisualAnalysisSchema.safeParse(minimalAnalysis);

    const fullAnalysis: VisualAnalysis = {
      analysis_version: '1.0.0',
      status: 'COMPLETED',
      source: {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        analyzed_at: new Date().toISOString(),
        source_type: 'ai',
      },
      preprocessing: {
        source_width: 1000,
        source_height: 2000,
        analysis_width: 500,
        analysis_height: 1000,
        scale: 0.5,
        format: 'image/webp',
        generated_at: new Date().toISOString(),
      },
      composition: {
        shot_scale: 'medium',
        framing: 'dynamic',
        foreground_importance: 0.8,
        confidence: 0.95,
      },
      subjects: [
        {
          subject_id: 'sub_001',
          type: 'character',
          label: 'Hero protagonist',
          bounding_box: { x: 0.1, y: 0.2, width: 0.4, height: 0.6 },
          importance: 'primary',
          confidence: 0.92,
        },
      ],
      characters: [
        {
          detection_id: 'char_001',
          character_id: 'chr_hero',
          bounding_box: { x: 0.1, y: 0.2, width: 0.4, height: 0.6 },
          face_region: { x: 0.2, y: 0.22, width: 0.15, height: 0.15 },
          visibility: 'full_body',
          screen_position: 'center',
          confidence: 0.9,
        },
      ],
      text: [
        {
          text_id: 'txt_001',
          type: 'dialogue',
          content: 'Watch out!',
          bounding_box: { x: 0.6, y: 0.1, width: 0.3, height: 0.2 },
          reading_order: 0,
          confidence: 0.98,
        },
      ],
      scene: {
        location: 'Dark Forest',
        environment: 'woodland',
        indoor_outdoor: 'outdoor',
        time_context: 'night',
        confidence: 0.85,
      },
      action: [
        {
          action_id: 'act_001',
          type: 'combat',
          description: 'Swinging glowing sword',
          intensity: 'high',
          confidence: 0.88,
        },
      ],
      visual_focus: {
        primary_target: {
          type: 'character',
          subject_id: 'sub_001',
          description: 'Protagonist mid-attack',
        },
        focus_region: { x: 0.1, y: 0.2, width: 0.4, height: 0.6 },
        importance: 0.95,
        confidence: 0.9,
      },
      camera: {
        recommended_target: { x: 0.1, y: 0.2, width: 0.4, height: 0.6 },
        shot_type: 'medium-shot',
        zoom_potential: 'medium',
        pan_potential: 'vertical_down',
        confidence: 0.88,
      },
      confidence: 0.91,
    };
    const fullParse = VisualAnalysisSchema.safeParse(fullAnalysis);

    const passed = minimalParse.success && fullParse.success;
    results.push({
      name: 'Visual Analysis: Valid Minimal & Full Schema verification',
      category: 'Visual Analysis Model',
      passed,
      message: passed
        ? 'Both minimal and complete VisualAnalysis schemas validated successfully'
        : `Errors: ${JSON.stringify(minimalParse.error || fullParse.error)}`,
      durationMs: Math.round(performance.now() - t32Start),
    });
  } catch (err) {
    results.push({
      name: 'Visual Analysis: Valid Minimal & Full Schema verification',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t32Start),
    });
  }

  // Test 33: Invalid VisualAnalysis schema rejection
  const t33Start = performance.now();
  try {
    const invalidStatusAnalysis = {
      analysis_version: '1.0.0',
      status: 'INVALID_STATUS_XYZ',
    };
    const parseRes = VisualAnalysisSchema.safeParse(invalidStatusAnalysis);
    const passed = !parseRes.success;

    results.push({
      name: 'Visual Analysis: Invalid status strictly rejected',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Invalid analysis status correctly rejected by Zod' : 'Failed to reject invalid status',
      durationMs: Math.round(performance.now() - t33Start),
    });
  } catch (err) {
    results.push({
      name: 'Visual Analysis: Invalid status strictly rejected',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t33Start),
    });
  }

  // Test 34: Valid confidence values (0.0 to 1.0)
  const t34Start = performance.now();
  try {
    const valid0 = ConfidenceNumberSchema.safeParse(0.0).success;
    const validMid = ConfidenceNumberSchema.safeParse(0.725).success;
    const valid1 = ConfidenceNumberSchema.safeParse(1.0).success;
    const passed = valid0 && validMid && valid1;

    results.push({
      name: 'Confidence Model: Valid 0.0 to 1.0 boundary values accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Accepted boundary confidence scores (0.0, 0.725, 1.0)' : 'Failed valid confidence values',
      durationMs: Math.round(performance.now() - t34Start),
    });
  } catch (err) {
    results.push({
      name: 'Confidence Model: Valid 0.0 to 1.0 boundary values accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t34Start),
    });
  }

  // Test 35: Invalid confidence values (< 0.0, > 1.0)
  const t35Start = performance.now();
  try {
    const rejectNegative = !ConfidenceNumberSchema.safeParse(-0.1).success;
    const rejectAboveOne = !ConfidenceNumberSchema.safeParse(1.05).success;
    const rejectNaN = !ConfidenceNumberSchema.safeParse('high').success;
    const passed = rejectNegative && rejectAboveOne && rejectNaN;

    results.push({
      name: 'Confidence Model: Out-of-bounds confidence values strictly rejected',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Negative, >1.0, and string confidence values correctly rejected' : 'Failed to reject invalid confidence',
      durationMs: Math.round(performance.now() - t35Start),
    });
  } catch (err) {
    results.push({
      name: 'Confidence Model: Out-of-bounds confidence values strictly rejected',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t35Start),
    });
  }

  // Test 36: Valid normalized coordinates
  const t36Start = performance.now();
  try {
    const validBox = { x: 0.1, y: 0.15, width: 0.8, height: 0.7 };
    const parseRes = BoundingBoxSchema.safeParse(validBox);
    const passed = parseRes.success;

    results.push({
      name: 'Coordinates: Valid normalized bounding box accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Normalized bounding box correctly validated within 0..1' : 'Failed valid box',
      durationMs: Math.round(performance.now() - t36Start),
    });
  } catch (err) {
    results.push({
      name: 'Coordinates: Valid normalized bounding box accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t36Start),
    });
  }

  // Test 37: Invalid normalized coordinates
  const t37Start = performance.now();
  try {
    const overflowBox = { x: 0.8, y: 0.2, width: 0.5, height: 0.5 }; // x + width = 1.3 > 1.0
    const parseRes = BoundingBoxSchema.safeParse(overflowBox);
    const passed = !parseRes.success;

    results.push({
      name: 'Coordinates: Out-of-bounds bounding box (x+width > 1.0) rejected',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Overflow bounding box correctly rejected' : 'Failed to reject overflow box',
      durationMs: Math.round(performance.now() - t37Start),
    });
  } catch (err) {
    results.push({
      name: 'Coordinates: Out-of-bounds bounding box (x+width > 1.0) rejected',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t37Start),
    });
  }

  // Test 38: Valid Subject schema
  const t38Start = performance.now();
  try {
    const validSub = {
      subject_id: 'sub_hero_01',
      type: 'character',
      label: 'Main character',
      bounding_box: { x: 0.2, y: 0.2, width: 0.4, height: 0.5 },
      visibility: 'fully_visible',
      importance: 'primary',
      confidence: 0.95,
    };
    const parseRes = SubjectSchema.safeParse(validSub);
    const passed = parseRes.success;

    results.push({
      name: 'Subject Model: Valid Subject schema accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Subject schema verified with valid attributes' : 'Failed Subject schema',
      durationMs: Math.round(performance.now() - t38Start),
    });
  } catch (err) {
    results.push({
      name: 'Subject Model: Valid Subject schema accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t38Start),
    });
  }

  // Test 39: Valid CharacterDetection schema
  const t39Start = performance.now();
  try {
    const validChar = {
      detection_id: 'det_char_01',
      character_id: 'chr_jinwoo',
      bounding_box: { x: 0.1, y: 0.1, width: 0.5, height: 0.8 },
      face_region: { x: 0.2, y: 0.15, width: 0.2, height: 0.2 },
      visibility: 'full_body',
      pose: 'combat stance',
      expression: 'determined',
      screen_position: 'center',
      confidence: 0.93,
    };
    const parseRes = CharacterDetectionSchema.safeParse(validChar);
    const passed = parseRes.success;

    results.push({
      name: 'Character Model: Valid CharacterDetection schema accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Character detection schema verified with pose and face attributes' : 'Failed CharacterDetection schema',
      durationMs: Math.round(performance.now() - t39Start),
    });
  } catch (err) {
    results.push({
      name: 'Character Model: Valid CharacterDetection schema accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t39Start),
    });
  }

  // Test 40: Valid TextElement schema
  const t40Start = performance.now();
  try {
    const validText = {
      text_id: 'txt_speech_01',
      type: 'dialogue',
      content: 'I will protect everyone.',
      bounding_box: { x: 0.5, y: 0.05, width: 0.4, height: 0.2 },
      reading_order: 0,
      speaker_reference: 'chr_jinwoo',
      confidence: 0.97,
    };
    const parseRes = TextElementSchema.safeParse(validText);
    const passed = parseRes.success;

    results.push({
      name: 'Text & Dialogue Model: Valid TextElement schema accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Text element verified with bubble classification and reading order' : 'Failed TextElement schema',
      durationMs: Math.round(performance.now() - t40Start),
    });
  } catch (err) {
    results.push({
      name: 'Text & Dialogue Model: Valid TextElement schema accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t40Start),
    });
  }

  // Test 41: Valid SceneContext schema
  const t41Start = performance.now();
  try {
    const validScene = {
      location: 'Dungeon Boss Room',
      environment: 'subterranean throne chamber',
      indoor_outdoor: 'indoor',
      time_context: 'timeless',
      lighting: 'eerie blue torches',
      atmosphere: 'tense, oppressive',
      confidence: 0.89,
    };
    const parseRes = SceneContextSchema.safeParse(validScene);
    const passed = parseRes.success;

    results.push({
      name: 'Scene Model: Valid SceneContext schema accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Scene context verified with atmospheric and environmental attributes' : 'Failed SceneContext schema',
      durationMs: Math.round(performance.now() - t41Start),
    });
  } catch (err) {
    results.push({
      name: 'Scene Model: Valid SceneContext schema accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t41Start),
    });
  }

  // Test 42: Valid ActionObservation schema
  const t42Start = performance.now();
  try {
    const validAction = {
      action_id: 'act_slash_01',
      type: 'combat_strike',
      description: 'Downward dagger slash with shadow trail',
      actor_subject_id: 'sub_hero_01',
      intensity: 'high',
      direction: 'diagonal_down_right',
      confidence: 0.91,
    };
    const parseRes = ActionObservationSchema.safeParse(validAction);
    const passed = parseRes.success;

    results.push({
      name: 'Action Model: Valid ActionObservation schema accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Action observation verified with intensity and motion direction' : 'Failed ActionObservation schema',
      durationMs: Math.round(performance.now() - t42Start),
    });
  } catch (err) {
    results.push({
      name: 'Action Model: Valid ActionObservation schema accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t42Start),
    });
  }

  // Test 43: Valid VisualFocus schema
  const t43Start = performance.now();
  try {
    const validFocus = {
      primary_target: {
        type: 'character',
        subject_id: 'sub_hero_01',
        description: 'Protagonist face in focus',
      },
      secondary_targets: [
        {
          type: 'object',
          description: 'Glowing legendary blade',
        },
      ],
      focus_region: { x: 0.2, y: 0.1, width: 0.5, height: 0.6 },
      importance: 0.95,
      confidence: 0.92,
      reason: 'Hero expression defines panel dramatic tension',
    };
    const parseRes = VisualFocusSchema.safeParse(validFocus);
    const passed = parseRes.success;

    results.push({
      name: 'Visual Focus Model: Valid VisualFocus with targets accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Visual focus schema verified with primary and secondary target regions' : 'Failed VisualFocus schema',
      durationMs: Math.round(performance.now() - t43Start),
    });
  } catch (err) {
    results.push({
      name: 'Visual Focus Model: Valid VisualFocus with targets accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t43Start),
    });
  }

  // Test 44: Valid CameraRegion & CameraAnalysis foundation
  const t44Start = performance.now();
  try {
    const validCameraRegion = {
      region_id: 'cam_reg_01',
      region: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      safe_margin: 0.05,
      target_type: 'character',
      importance: 0.9,
      confidence: 0.94,
    };
    const regionValid = CameraRegionSchema.safeParse(validCameraRegion).success;

    const validCamera = {
      recommended_target: { x: 0.15, y: 0.15, width: 0.7, height: 0.7 },
      safe_regions: [validCameraRegion],
      shot_type: 'medium_close_up',
      zoom_potential: 'high',
      pan_potential: 'vertical_down',
      suggested_motion: 'slow_pan_down',
      duration_seconds: 3.5,
      confidence: 0.88,
    };
    const cameraValid = CameraAnalysisSchema.safeParse(validCamera).success;
    const passed = regionValid && cameraValid;

    results.push({
      name: 'Camera Foundation: Valid CameraRegion & CameraAnalysis schemas accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Camera foundation validated with safe regions and motion potentials' : 'Failed Camera schemas',
      durationMs: Math.round(performance.now() - t44Start),
    });
  } catch (err) {
    results.push({
      name: 'Camera Foundation: Valid CameraRegion & CameraAnalysis schemas accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t44Start),
    });
  }

  // Test 45: Valid AnalysisError schema
  const t45Start = performance.now();
  try {
    const validErr = {
      code: 'IMAGE_DECODE_FAILED',
      stage: 'preprocessing',
      message: 'Failed to extract pixel bitmap from source blob',
      retryable: true,
      occurred_at: new Date().toISOString(),
    };
    const parseRes = AnalysisErrorSchema.safeParse(validErr);
    const passed = parseRes.success;

    results.push({
      name: 'Failure Model: Valid AnalysisError schema accepted',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Structured analysis error details validated without leaking secrets' : 'Failed AnalysisError schema',
      durationMs: Math.round(performance.now() - t45Start),
    });
  } catch (err) {
    results.push({
      name: 'Failure Model: Valid AnalysisError schema accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t45Start),
    });
  }

  // Test 46: Analysis status transitions allowed by the model
  const t46Start = performance.now();
  try {
    const statuses: VisualAnalysisStatus[] = [
      'NOT_ANALYZED',
      'QUEUED',
      'ANALYZING',
      'COMPLETED',
      'FAILED',
      'STALE',
    ];
    const allValid = statuses.every((s) => {
      const va: VisualAnalysis = { analysis_version: '1.0.0', status: s };
      return VisualAnalysisSchema.safeParse(va).success;
    });

    results.push({
      name: 'Lifecycle Status: All 6 analysis lifecycle states accepted',
      category: 'Visual Analysis Model',
      passed: allValid,
      message: allValid ? 'All 6 lifecycle statuses validated successfully' : 'Some lifecycle statuses failed validation',
      durationMs: Math.round(performance.now() - t46Start),
    });
  } catch (err) {
    results.push({
      name: 'Lifecycle Status: All 6 analysis lifecycle states accepted',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t46Start),
    });
  }

  // Test 47: Existing Part 1 projects remain loadable with VisualAnalysis
  const t47Start = performance.now();
  try {
    const proj = createDefaultProject({ title: 'Part 1 Backward Compatibility Test' });
    const imgId = generateStableId('img');
    proj.images.push({
      image_id: imgId,
      original_filename: 'legacy_page_01.png',
      mime_type: 'image/png',
      width: 800,
      height: 1600,
      file_size: 80000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });
    proj.panels.push({
      id: generateStableId('pnl'),
      image_id: imgId,
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      visual_analysis: {
        analysis_version: '1.0.0',
        status: 'NOT_ANALYZED',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const validation = validateProject(proj);
    const passed = validation.valid;

    results.push({
      name: 'Compatibility: Part 1 Project with VisualAnalysis model passes validateProject',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Project with VisualAnalysis passed full canonical Zod validation' : `Validation errors: ${validation.errorSummary}`,
      durationMs: Math.round(performance.now() - t47Start),
    });
  } catch (err) {
    results.push({
      name: 'Compatibility: Part 1 Project with VisualAnalysis model passes validateProject',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t47Start),
    });
  }

  // Test 48: Existing Part 1 validation gate still passes
  const t48Start = performance.now();
  try {
    const proj = createDefaultProject({ title: 'Validation Gate Compatibility' });
    const imgId = generateStableId('img');
    proj.images.push({
      image_id: imgId,
      original_filename: 'gate_test.png',
      mime_type: 'image/png',
      width: 1000,
      height: 2000,
      file_size: 100000,
      source_order: 0,
      created_at: new Date().toISOString(),
    });
    proj.panels.push({
      id: generateStableId('pnl'),
      image_id: imgId,
      panel_index: 0,
      order: 0,
      initial_order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      visual_analysis: createDefaultVisualAnalysis('NOT_ANALYZED'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const report = await validateProjectForAnalysis(proj, { checkBlobsInStorage: false });
    const passed = report.readiness === 'READY' && report.errors.length === 0;

    results.push({
      name: 'Validation Gate: Project with default visual_analysis yields READY',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Validation Gate passed with READY state' : `Got readiness: ${report.readiness}`,
      durationMs: Math.round(performance.now() - t48Start),
    });
  } catch (err) {
    results.push({
      name: 'Validation Gate: Project with default visual_analysis yields READY',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t48Start),
    });
  }

  // Test 49: Creating a panel with NOT_ANALYZED state works
  const t49Start = performance.now();
  try {
    const defaultVA = createDefaultVisualAnalysis();
    const passed =
      defaultVA.analysis_version === '1.0.0' &&
      defaultVA.status === 'NOT_ANALYZED' &&
      defaultVA.subjects === undefined &&
      defaultVA.characters === undefined;

    results.push({
      name: 'Foundation: createDefaultVisualAnalysis initializes clean NOT_ANALYZED state',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Default visual analysis correctly created without mock data' : 'Failed default initialization',
      durationMs: Math.round(performance.now() - t49Start),
    });
  } catch (err) {
    results.push({
      name: 'Foundation: createDefaultVisualAnalysis initializes clean NOT_ANALYZED state',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t49Start),
    });
  }

  // Test 50: Verification that engine/factory never fabricates fake analysis values
  const t50Start = performance.now();
  try {
    const engine = new FoundationVisualAnalysisEngine();
    const testPanel: Panel = {
      id: 'pnl_test_contract',
      image_id: 'img_test_contract',
      panel_index: 0,
      order: 0,
      boundary: { x: 0, y: 0, width: 1, height: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await engine.analyzePanel(testPanel);
    const status = engine.getStatus(testPanel.id);
    const passed =
      res.status === 'NOT_ANALYZED' &&
      res.subjects === undefined &&
      res.characters === undefined &&
      res.text === undefined &&
      status === 'NOT_ANALYZED';

    results.push({
      name: 'Contract Integrity: Engine contract returns unanalyzed state without mock data',
      category: 'Visual Analysis Model',
      passed,
      message: passed ? 'Engine strictly adheres to zero-fabrication contract' : 'Engine fabricated values',
      durationMs: Math.round(performance.now() - t50Start),
    });
  } catch (err) {
    results.push({
      name: 'Contract Integrity: Engine contract returns unanalyzed state without mock data',
      category: 'Visual Analysis Model',
      passed: false,
      message: err instanceof Error ? err.message : 'Error',
      durationMs: Math.round(performance.now() - t50Start),
    });
  }

  // Test 51: Part 2.3 Composition Analysis Test Suite
  const t51Start = performance.now();
  try {
    const compSuite = await runCompositionTests();
    const passed = compSuite.failed === 0;
    results.push({
      name: `Part 2.3: Panel Composition Analysis Suite (${compSuite.passed} assertions)`,
      category: 'Composition Analysis',
      passed,
      message: passed
        ? `All ${compSuite.passed} composition assertions verified successfully`
        : `Failed assertions: ${compSuite.errors.join('; ')}`,
      durationMs: Math.round(performance.now() - t51Start),
    });
  } catch (err) {
    results.push({
      name: 'Part 2.3: Panel Composition Analysis Suite',
      category: 'Composition Analysis',
      passed: false,
      message: err instanceof Error ? err.message : 'Error running composition suite',
      durationMs: Math.round(performance.now() - t51Start),
    });
  }

  // Test 52: Part 2.4 Character, Face & Subject Detection Test Suite
  const t52Start = performance.now();
  try {
    const subjSuite = await runSubjectTests();
    const passed = subjSuite.failed === 0;
    results.push({
      name: `Part 2.4: Character & Subject Detection Suite (${subjSuite.passed} assertions)`,
      category: 'Subject & Character Detection',
      passed,
      message: passed
        ? `All ${subjSuite.passed} subject detection assertions verified successfully`
        : `Failed assertions: ${subjSuite.errors.join('; ')}`,
      durationMs: Math.round(performance.now() - t52Start),
    });
  } catch (err) {
    results.push({
      name: 'Part 2.4: Character & Subject Detection Suite',
      category: 'Subject & Character Detection',
      passed: false,
      message: err instanceof Error ? err.message : 'Error running subject detection suite',
      durationMs: Math.round(performance.now() - t52Start),
    });
  }

  // Test 53: Part 2.8 Visual Continuity & Cross-Panel Relationship Analysis Suite
  const t53Start = performance.now();
  try {
    const contSuite = await runContinuityTests();
    const passed = contSuite.failed === 0;
    results.push({
      name: `Part 2.8: Visual Continuity & Cross-Panel Relationship Suite (${contSuite.passed} assertions)`,
      category: 'Visual Continuity Analysis',
      passed,
      message: passed
        ? `All ${contSuite.passed} visual continuity assertions verified successfully`
        : `Failed assertions: ${contSuite.errors.join('; ')}`,
      durationMs: Math.round(performance.now() - t53Start),
    });
  } catch (err) {
    results.push({
      name: 'Part 2.8: Visual Continuity & Cross-Panel Relationship Suite',
      category: 'Visual Continuity Analysis',
      passed: false,
      message: err instanceof Error ? err.message : 'Error running continuity suite',
      durationMs: Math.round(performance.now() - t53Start),
    });
  }

  return results;
}


