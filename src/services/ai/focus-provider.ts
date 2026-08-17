/**
 * Part 2.7 — Visual Salience, Focus & Story-Relevant Region Provider Abstraction & Response Normalizer
 * 
 * Provides normalizers, validation filters, coordinate clamping, and reference integrity checks
 * for visual focus targets, visual salience, and descriptive camera-safe interest regions.
 */

import {
  VisualFocus,
  VisualFocusTarget,
  FocusTargetType,
  CameraAnalysis,
  CameraRegion,
  CameraTargetType,
  BoundingBox,
  AnalysisSource,
  SceneContext,
  ActionObservation,
} from '../../types';
import {
  AIVisualFocusResponseSchema,
  VisualFocusSchema,
  CameraAnalysisSchema,
} from '../../data/schemas/visual-analysis.schema';

export interface FocusPromptPayload {
  imageBlob: Blob;
  mimeType: string;
  panelId: string;
  context?: {
    order?: number;
    aspectRatio?: number;
    characters?: Array<{ id: string; label?: string; bounding_box?: BoundingBox }>;
    subjects?: Array<{ id: string; label?: string; type?: string; bounding_box?: BoundingBox }>;
    textElements?: Array<{ id: string; type?: string; content?: string; bounding_box?: BoundingBox }>;
    scene?: SceneContext;
    actions?: ActionObservation[];
    readingDirection?: string;
  };
}

/**
 * Normalizes focus target types to canonical FocusTargetType enum.
 */
export function normalizeFocusTargetType(raw?: string): FocusTargetType {
  if (!raw) return 'character';
  const cleaned = raw.toLowerCase().trim().replace(/[-_\s]+/g, '');

  if (cleaned.includes('face') || cleaned.includes('head') || cleaned.includes('portrait')) {
    return 'face';
  }
  if (cleaned.includes('char') || cleaned.includes('person') || cleaned.includes('figure') || cleaned.includes('hero')) {
    return 'character';
  }
  if (cleaned.includes('action') || cleaned.includes('combat') || cleaned.includes('impact') || cleaned.includes('strike') || cleaned.includes('motion')) {
    return 'action_area';
  }
  if (cleaned.includes('text') || cleaned.includes('dialogue') || cleaned.includes('speech') || cleaned.includes('sfx') || cleaned.includes('bubble')) {
    return 'text';
  }
  if (cleaned.includes('object') || cleaned.includes('weapon') || cleaned.includes('item') || cleaned.includes('prop')) {
    return 'object';
  }
  if (cleaned.includes('env') || cleaned.includes('scene') || cleaned.includes('bg') || cleaned.includes('background') || cleaned.includes('wide')) {
    return 'environment';
  }

  return 'character';
}

/**
 * Normalizes camera target types to canonical CameraTargetType enum.
 */
export function normalizeCameraTargetType(raw?: string): CameraTargetType {
  if (!raw) return 'focal_point';
  const cleaned = raw.toLowerCase().trim().replace(/[-_\s]+/g, '');

  if (cleaned.includes('char') || cleaned.includes('face')) {
    return 'character';
  }
  if (cleaned.includes('action') || cleaned.includes('motion')) {
    return 'full_action';
  }
  if (cleaned.includes('establish') || cleaned.includes('wide') || cleaned.includes('env') || cleaned.includes('scene')) {
    return 'establishing';
  }
  if (cleaned.includes('text') || cleaned.includes('safe') || cleaned.includes('margin')) {
    return 'text_safe';
  }

  return 'focal_point';
}

/**
 * Normalizes importance/salience score to number [0.0, 1.0].
 */
export function normalizeImportanceScore(raw?: unknown, fallback: number = 0.85): number {
  if (typeof raw === 'number' && !isNaN(raw)) {
    return Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000));
  }
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim();
    if (lower === 'high' || lower === 'critical' || lower === 'primary') return 0.92;
    if (lower === 'medium' || lower === 'moderate' || lower === 'secondary') return 0.65;
    if (lower === 'low' || lower === 'subtle' || lower === 'minor') return 0.35;
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      return Math.max(0, Math.min(1, Math.round(parsed * 1000) / 1000));
    }
  }
  return fallback;
}

/**
 * Normalizes and clamps a bounding box strictly into [0.0, 1.0] coordinates.
 */
export function normalizeAndValidateBoundingBox(raw?: any): BoundingBox | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  let x = typeof raw.x === 'number' ? raw.x : typeof raw.left === 'number' ? raw.left : 0;
  let y = typeof raw.y === 'number' ? raw.y : typeof raw.top === 'number' ? raw.top : 0;
  let width = typeof raw.width === 'number' ? raw.width : typeof raw.w === 'number' ? raw.w : 0.5;
  let height = typeof raw.height === 'number' ? raw.height : typeof raw.h === 'number' ? raw.h : 0.5;

  // Handle accidental pixel coordinates (> 1.0)
  if (x > 1.0 || y > 1.0 || width > 1.0 || height > 1.0) {
    if (width > 1.0 && height > 1.0) {
      // Normalize down assuming a 1000x1000 or similar scale if plausible
      const maxDim = Math.max(x + width, y + height);
      if (maxDim > 0) {
        x = x / maxDim;
        y = y / maxDim;
        width = width / maxDim;
        height = height / maxDim;
      }
    }
  }

  x = Math.max(0, Math.min(0.99, x));
  y = Math.max(0, Math.min(0.99, y));
  width = Math.max(0.01, Math.min(1.0 - x, width));
  height = Math.max(0.01, Math.min(1.0 - y, height));

  return {
    x: Math.round(x * 10000) / 10000,
    y: Math.round(y * 10000) / 10000,
    width: Math.round(width * 10000) / 10000,
    height: Math.round(height * 10000) / 10000,
  };
}

/**
 * Validates entity reference against known IDs to prevent phantom links.
 */
export function validateEntityReference(
  ref: string | null | undefined,
  knownIds?:
    | Set<string>
    | {
        characters?: Set<string>;
        subjects?: Set<string>;
        texts?: Set<string>;
        actions?: Set<string>;
      }
): string | undefined {
  if (!ref || typeof ref !== 'string') return undefined;
  const trimmed = ref.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'none') {
    return undefined;
  }

  if (!knownIds) return trimmed;

  if (knownIds instanceof Set) {
    return knownIds.has(trimmed) ? trimmed : undefined;
  }

  const isKnown =
    knownIds.characters?.has(trimmed) ||
    knownIds.subjects?.has(trimmed) ||
    knownIds.texts?.has(trimmed) ||
    knownIds.actions?.has(trimmed);

  return isKnown ? trimmed : undefined;
}

/**
 * Normalizes and validates raw AI visual focus & salience responses into canonical models.
 */
export function normalizeAndValidateAIFocusAnalysis(
  raw: unknown,
  provenance: AnalysisSource,
  knownIds?: {
    characters?: Set<string>;
    subjects?: Set<string>;
    texts?: Set<string>;
    actions?: Set<string>;
  }
): {
  visualFocus: VisualFocus;
  cameraAnalysis: CameraAnalysis;
} {
  // 1. Zod Raw Schema Validation
  const parseResult = AIVisualFocusResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    console.warn('AI Visual Focus response had raw schema validation warnings:', parseResult.error);
  }

  const rawData = parseResult.success ? parseResult.data : ((raw || {}) as any);

  // 2. Extract & Normalize Visual Focus
  const rawFocus = rawData.visual_focus || rawData;
  const rawPrimary = rawFocus.primary_target || rawFocus.primary;

  let primaryTarget: VisualFocusTarget | undefined = undefined;
  if (rawPrimary && typeof rawPrimary === 'object') {
    const targetType = normalizeFocusTargetType(rawPrimary.type || rawPrimary.target_type);
    const subjectId = validateEntityReference(
      rawPrimary.subject_id || rawPrimary.target_ref || rawPrimary.character_ref,
      knownIds
    );
    const region = normalizeAndValidateBoundingBox(rawPrimary.region || rawPrimary.bounding_box);
    const description =
      typeof (rawPrimary.description || rawPrimary.reason) === 'string'
        ? (rawPrimary.description || rawPrimary.reason).trim()
        : undefined;

    primaryTarget = {
      type: targetType,
      subject_id: subjectId,
      region,
      description,
    };
  }

  // Extract secondary targets
  const rawSecondary = Array.isArray(rawFocus.secondary_targets)
    ? rawFocus.secondary_targets
    : Array.isArray(rawFocus.secondary)
    ? rawFocus.secondary
    : [];

  const secondaryTargets: VisualFocusTarget[] = [];
  for (const s of rawSecondary) {
    if (!s || typeof s !== 'object') continue;
    const targetType = normalizeFocusTargetType(s.type || s.target_type);
    const subjectId = validateEntityReference(
      s.subject_id || s.target_ref || s.character_ref,
      knownIds
    );
    const region = normalizeAndValidateBoundingBox(s.region || s.bounding_box);
    const description = typeof s.description === 'string' ? s.description.trim() : undefined;

    secondaryTargets.push({
      type: targetType,
      subject_id: subjectId,
      region,
      description,
    });
  }

  // Calculate overall focus_region
  let focusRegion: BoundingBox =
    normalizeAndValidateBoundingBox(rawFocus.focus_region || rawFocus.region) ||
    primaryTarget?.region || {
      x: 0.15,
      y: 0.15,
      width: 0.7,
      height: 0.7,
    };

  const importance = normalizeImportanceScore(rawFocus.importance ?? rawFocus.salience, 0.9);
  const confidence = normalizeImportanceScore(rawFocus.confidence, 0.88);
  const reason =
    typeof rawFocus.reason === 'string' && rawFocus.reason.trim().length > 0
      ? rawFocus.reason.trim()
      : primaryTarget?.description || 'Primary visual element based on size and focal centrality.';

  const visualFocusCandidate: VisualFocus = {
    primary_target: primaryTarget,
    secondary_targets: secondaryTargets.length > 0 ? secondaryTargets : undefined,
    focus_region: focusRegion,
    importance,
    confidence,
    reason,
  };

  const focusValidation = VisualFocusSchema.safeParse(visualFocusCandidate);
  const finalVisualFocus: VisualFocus = focusValidation.success
    ? visualFocusCandidate
    : {
        focus_region: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        confidence: 0.8,
        importance: 0.85,
        reason: 'Default fallback focus region.',
      };

  // 3. Extract & Normalize Descriptive Camera Analysis (Safe Regions / Shot Framing metadata)
  const rawCam = rawData.camera_analysis || {};
  const recommendedTarget =
    normalizeAndValidateBoundingBox(rawCam.recommended_target) || focusRegion;

  const rawSafeRegions = Array.isArray(rawCam.safe_regions) ? rawCam.safe_regions : [];
  const safeRegions: CameraRegion[] = [];

  for (let i = 0; i < rawSafeRegions.length; i++) {
    const sr = rawSafeRegions[i];
    if (!sr || typeof sr !== 'object') continue;

    const rBox = normalizeAndValidateBoundingBox(sr.region || sr.bounding_box);
    if (!rBox) continue;

    const regionId =
      typeof sr.region_id === 'string' && sr.region_id.length > 0
        ? sr.region_id
        : `cam_reg_${Date.now()}_${i}`;

    const targetType = normalizeCameraTargetType(sr.target_type);
    const safeMargin = typeof sr.safe_margin === 'number' ? Math.max(0, Math.min(0.2, sr.safe_margin)) : 0.05;
    const regImportance = normalizeImportanceScore(sr.importance, 0.8);
    const regConfidence = normalizeImportanceScore(sr.confidence, 0.85);

    safeRegions.push({
      region_id: regionId,
      region: rBox,
      safe_margin: safeMargin,
      target_type: targetType,
      importance: regImportance,
      confidence: regConfidence,
    });
  }

  // If no safe regions were extracted, synthesize one around primary focus
  if (safeRegions.length === 0) {
    safeRegions.push({
      region_id: `cam_reg_primary`,
      region: focusRegion,
      safe_margin: 0.05,
      target_type: 'focal_point',
      importance: importance,
      confidence: confidence,
    });
  }

  const zoomPotential =
    rawCam.zoom_potential === 'low' || rawCam.zoom_potential === 'medium' || rawCam.zoom_potential === 'high'
      ? rawCam.zoom_potential
      : 'medium';

  const panPotential =
    rawCam.pan_potential === 'static' ||
    rawCam.pan_potential === 'vertical_down' ||
    rawCam.pan_potential === 'vertical_up' ||
    rawCam.pan_potential === 'horizontal' ||
    rawCam.pan_potential === 'diagonal'
      ? rawCam.pan_potential
      : 'static';

  const cameraAnalysisCandidate: CameraAnalysis = {
    recommended_target: recommendedTarget,
    safe_regions: safeRegions,
    shot_type: typeof rawCam.shot_type === 'string' ? rawCam.shot_type.trim() : undefined,
    zoom_potential: zoomPotential,
    pan_potential: panPotential,
    suggested_motion: typeof rawCam.suggested_motion === 'string' ? rawCam.suggested_motion.trim() : undefined,
    duration_seconds: typeof rawCam.duration_seconds === 'number' ? Math.max(0.5, rawCam.duration_seconds) : undefined,
    constraints: Array.isArray(rawCam.constraints) ? rawCam.constraints.map(String) : undefined,
    confidence: normalizeImportanceScore(rawCam.confidence, confidence),
  };

  const camValidation = CameraAnalysisSchema.safeParse(cameraAnalysisCandidate);
  const finalCameraAnalysis: CameraAnalysis = camValidation.success
    ? cameraAnalysisCandidate
    : {
        recommended_target: focusRegion,
        safe_regions: safeRegions,
        zoom_potential: 'medium',
        pan_potential: 'static',
        confidence: 0.85,
      };

  return {
    visualFocus: finalVisualFocus,
    cameraAnalysis: finalCameraAnalysis,
  };
}
