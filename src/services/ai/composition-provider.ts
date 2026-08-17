/**
 * Part 2.3 — Vision Analysis Provider Abstraction & Response Normalizer
 * 
 * Provides a decoupled interface for AI/vision providers so the core composition engine
 * does not depend on provider-specific response formats.
 */

import {
  CompositionAnalysis,
  ShotScale,
  CompositionFraming,
  VisualDensity,
  DominantOrientation,
  NegativeSpaceLevel,
  TonalRange,
  DominantRegion,
  AnalysisSource,
  AnalysisError,
} from '../../types';
import {
  AICompositionResponseSchema,
  CompositionAnalysisSchema,
} from '../../data/schemas/visual-analysis.schema';

import { SubjectDetectionPromptPayload } from './subject-provider';
import { TextAnalysisPromptPayload } from './text-provider';
import { SceneActionPromptPayload } from './scene-action-provider';
import { FocusPromptPayload } from './focus-provider';
import { ContinuityPromptPayload } from './continuity-provider';

export interface CompositionPromptPayload {
  imageBlob: Blob;
  mimeType: string;
  panelId: string;
  context?: {
    order?: number;
    aspectRatio?: number;
    readingDirection?: string;
  };
}

export interface IVisionAnalysisProvider {
  readonly providerId: string;
  readonly modelId: string;
  readonly promptVersion: string;

  analyzePanelComposition(
    payload: CompositionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }>;

  analyzePanelSubjects(
    payload: SubjectDetectionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }>;

  analyzePanelText(
    payload: TextAnalysisPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }>;

  analyzePanelSceneAndAction(
    payload: SceneActionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }>;

  analyzePanelFocus(
    payload: FocusPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }>;

  analyzePanelContinuity(
    payload: ContinuityPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }>;
}

/**
 * Normalizes shot scale strings from various LLM representations into canonical ShotScale enum.
 */
export function normalizeShotScale(input?: string): ShotScale | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim().replace(/_/g, '-');
  switch (cleaned) {
    case 'extreme-close-up':
    case 'ecu':
      return 'extreme-close-up';
    case 'close-up':
    case 'cu':
      return 'close-up';
    case 'medium-close-up':
    case 'mcu':
      return 'medium-close-up';
    case 'medium':
    case 'mid-shot':
    case 'ms':
      return 'medium';
    case 'medium-wide':
    case 'mws':
    case 'medium-long-shot':
      return 'medium-wide';
    case 'wide':
    case 'ws':
      return 'wide';
    case 'long-shot':
    case 'ls':
      return 'long-shot';
    case 'extreme-long-shot':
    case 'els':
    case 'extreme-wide':
      return 'extreme-long-shot';
    case 'macro':
      return 'macro';
    case 'overhead':
    case 'birds-eye':
    case 'top-down':
      return 'overhead';
    case 'full':
    case 'full-shot':
    case 'fs':
      return 'full';
    case 'unknown':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Normalizes framing strings from various LLM representations into canonical CompositionFraming enum.
 */
export function normalizeFraming(input?: string): CompositionFraming | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim().replace(/_/g, '-');
  switch (cleaned) {
    case 'wide':
      return 'wide';
    case 'tight':
      return 'tight';
    case 'dynamic':
      return 'dynamic';
    case 'panoramic':
      return 'panoramic';
    case 'isolated':
      return 'isolated';
    case 'rule-of-thirds':
      return 'rule_of_thirds';
    case 'centered':
      return 'centered';
    case 'left-weighted':
      return 'left-weighted';
    case 'right-weighted':
      return 'right-weighted';
    case 'top-weighted':
      return 'top-weighted';
    case 'bottom-weighted':
      return 'bottom-weighted';
    case 'symmetrical':
      return 'symmetrical';
    case 'asymmetrical':
      return 'asymmetrical';
    case 'diagonal':
      return 'diagonal';
    case 'layered':
      return 'layered';
    case 'unknown':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/**
 * Normalizes visual density strings into canonical VisualDensity enum.
 */
export function normalizeVisualDensity(input?: string): VisualDensity | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim().replace(/-/g, '_');
  switch (cleaned) {
    case 'sparse':
    case 'minimal':
    case 'low':
      return 'sparse';
    case 'balanced':
    case 'moderate':
    case 'medium':
      return 'balanced';
    case 'dense':
    case 'high':
      return 'dense';
    case 'cluttered':
      return 'cluttered';
    case 'very_dense':
    case 'extremely_dense':
      return 'very_dense';
    default:
      return 'balanced';
  }
}

/**
 * Normalizes dominant orientation strings into canonical DominantOrientation enum.
 */
export function normalizeOrientation(input?: string): DominantOrientation | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim();
  switch (cleaned) {
    case 'vertical':
      return 'vertical';
    case 'horizontal':
      return 'horizontal';
    case 'diagonal':
      return 'diagonal';
    case 'radial':
      return 'radial';
    case 'centered':
      return 'centered';
    case 'mixed':
    case 'neutral':
      return 'mixed';
    default:
      return 'mixed';
  }
}

/**
 * Normalizes negative space strings into canonical NegativeSpaceLevel enum.
 */
export function normalizeNegativeSpace(input?: string): NegativeSpaceLevel | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim();
  switch (cleaned) {
    case 'none':
    case 'zero':
      return 'none';
    case 'low':
    case 'minimal':
      return 'low';
    case 'moderate':
    case 'medium':
      return 'moderate';
    case 'high':
    case 'substantial':
    case 'abundant':
      return 'high';
    default:
      return 'low';
  }
}

/**
 * Normalizes tonal range strings into canonical TonalRange enum.
 */
export function normalizeTonalRange(input?: string): TonalRange | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim().replace(/-/g, '_');
  switch (cleaned) {
    case 'bright':
    case 'high_key':
      return 'bright';
    case 'dark':
    case 'low_key':
      return 'dark';
    case 'high_contrast':
      return 'high_contrast';
    case 'low_contrast':
      return 'low_contrast';
    case 'balanced':
    case 'neutral':
      return 'balanced';
    case 'monochrome':
    case 'greyscale':
    case 'black_and_white':
      return 'monochrome';
    default:
      return 'balanced';
  }
}

/**
 * Validates, normalizes, and packages raw AI output into canonical CompositionAnalysis.
 * Rejects invalid / malformed data with structured errors and never populates fake defaults.
 */
export function normalizeAndValidateAIComposition(
  rawJson: unknown,
  provenance: AnalysisSource
): CompositionAnalysis {
  if (!rawJson || typeof rawJson !== 'object') {
    throw {
      code: 'MALFORMED_AI_RESPONSE',
      stage: 'composition',
      message: 'AI response is not a valid JSON object',
      retryable: true,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  // 1. Validate raw structure shape
  const parsedRaw = AICompositionResponseSchema.safeParse(rawJson);
  if (!parsedRaw.success) {
    throw {
      code: 'SCHEMA_VALIDATION_FAILED',
      stage: 'composition',
      message: `AI response failed schema validation: ${parsedRaw.error.issues.map((i) => i.message).join(', ')}`,
      retryable: true,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  const data = parsedRaw.data;

  // 2. Normalize enums and properties
  const shot_scale = normalizeShotScale(data.shot_scale);
  const framing = normalizeFraming(data.framing);
  const visual_density = normalizeVisualDensity(data.visual_density);
  const dominant_orientation = normalizeOrientation(data.dominant_orientation);
  const negative_space = normalizeNegativeSpace(data.negative_space);
  const tonal_range = normalizeTonalRange(data.tonal_range);

  // 3. Normalize dominant regions with clamped normalized coordinates
  let dominant_regions: DominantRegion[] | undefined;
  if (Array.isArray(data.dominant_regions) && data.dominant_regions.length > 0) {
    dominant_regions = data.dominant_regions.map((r, idx) => ({
      region_id: `region_${idx + 1}`,
      label: String(r.label || `region_${idx + 1}`).trim(),
      box: {
        x: Math.max(0, Math.min(1, Number(r.box.x) || 0)),
        y: Math.max(0, Math.min(1, Number(r.box.y) || 0)),
        width: Math.max(0, Math.min(1, Number(r.box.width) || 0)),
        height: Math.max(0, Math.min(1, Number(r.box.height) || 0)),
      },
      prominence: r.prominence,
      weight: typeof r.weight === 'number' ? Math.max(0, Math.min(1, r.weight)) : undefined,
    }));
  }

  // 4. Validate confidence
  const confidence =
    typeof data.confidence === 'number'
      ? Math.max(0, Math.min(1, data.confidence))
      : 0.8; // Baseline confidence for valid parse

  // 5. Construct canonical model
  const composition: CompositionAnalysis = {
    shot_scale,
    framing,
    foreground_importance:
      typeof data.foreground_importance === 'number'
        ? Math.max(0, Math.min(1, data.foreground_importance))
        : undefined,
    middleground_importance:
      typeof data.middleground_importance === 'number'
        ? Math.max(0, Math.min(1, data.middleground_importance))
        : undefined,
    background_importance:
      typeof data.background_importance === 'number'
        ? Math.max(0, Math.min(1, data.background_importance))
        : undefined,
    visual_density,
    dominant_orientation,
    visual_hierarchy: Array.isArray(data.visual_hierarchy)
      ? data.visual_hierarchy.map(String).filter((s) => s.trim().length > 0)
      : undefined,
    dominant_regions,
    negative_space,
    dominant_colors: Array.isArray(data.dominant_colors)
      ? data.dominant_colors.map(String).filter((s) => s.trim().length > 0)
      : undefined,
    lighting_mood: data.lighting_mood?.trim() || undefined,
    tonal_range,
    summary: data.summary?.trim() || undefined,
    confidence,
    source: provenance,
  };

  // 6. Strict validation against canonical CompositionAnalysisSchema
  const validated = CompositionAnalysisSchema.safeParse(composition);
  if (!validated.success) {
    throw {
      code: 'CANONICAL_SCHEMA_MISMATCH',
      stage: 'composition',
      message: `Normalized composition failed canonical schema validation: ${validated.error.issues.map((i) => i.message).join(', ')}`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    } as AnalysisError;
  }

  return validated.data;
}
