/**
 * Part 2.6 — Scene Context & Physical Action Provider Abstraction & Response Normalizer
 * 
 * Provides normalizers, validation filters, and decoupled interfaces for AI/vision models
 * analyzing environmental context and observable physical actions.
 */

import {
  SceneContext,
  ActionObservation,
  ActionIntensity,
  AnalysisSource,
  AnalysisError,
} from '../../types';
import {
  AISceneAndActionAnalysisResponseSchema,
  SceneContextSchema,
  ActionObservationSchema,
} from '../../data/schemas/visual-analysis.schema';

export interface SceneActionPromptPayload {
  imageBlob: Blob;
  mimeType: string;
  panelId: string;
  context?: {
    order?: number;
    aspectRatio?: number;
    subjects?: Array<{ id: string; label?: string; type?: string }>;
    characters?: Array<{ id: string; label?: string }>;
    textElements?: Array<{ id: string; type?: string; content?: string }>;
    readingDirection?: string;
  };
}

/**
 * Normalizes indoor/outdoor environmental classification.
 */
export function normalizeIndoorOutdoor(raw?: string): 'indoor' | 'outdoor' | 'unclear' | 'abstract' | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().trim().replace(/[-_\s]+/g, '');

  if (cleaned.includes('indoor') || cleaned.includes('interior') || cleaned.includes('inside') || cleaned === 'room') {
    return 'indoor';
  }
  if (cleaned.includes('outdoor') || cleaned.includes('exterior') || cleaned.includes('outside') || cleaned === 'street') {
    return 'outdoor';
  }
  if (cleaned.includes('abstract') || cleaned.includes('nondiegetic') || cleaned.includes('gradient') || cleaned.includes('speedline')) {
    return 'abstract';
  }
  if (cleaned.includes('unclear') || cleaned.includes('mixed') || cleaned.includes('unknown') || cleaned.includes('ambiguous')) {
    return 'unclear';
  }

  return 'unclear';
}

/**
 * Normalizes time of day context from vision model inferences.
 */
export function normalizeTimeContext(raw?: string): 'day' | 'night' | 'sunset' | 'dawn' | 'dusk' | 'timeless' | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().trim().replace(/[-_\s]+/g, '');

  if (cleaned.includes('night') || cleaned.includes('midnight') || cleaned.includes('darkness')) {
    return 'night';
  }
  if (cleaned.includes('sunset') || cleaned.includes('sundown')) {
    return 'sunset';
  }
  if (cleaned.includes('dawn') || cleaned.includes('sunrise') || cleaned.includes('earlymorning')) {
    return 'dawn';
  }
  if (cleaned.includes('dusk') || cleaned.includes('twilight') || cleaned.includes('evening')) {
    return 'dusk';
  }
  if (cleaned.includes('day') || cleaned.includes('daytime') || cleaned.includes('noon') || cleaned.includes('morning') || cleaned.includes('afternoon')) {
    return 'day';
  }
  if (cleaned.includes('timeless') || cleaned.includes('unclear') || cleaned.includes('unknown') || cleaned.includes('na') || cleaned.includes('none')) {
    return 'timeless';
  }

  return undefined;
}

/**
 * Normalizes action intensity to canonical ActionIntensity enum.
 */
export function normalizeActionIntensity(raw?: string): ActionIntensity | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().trim().replace(/[-_\s]+/g, '');

  if (cleaned.includes('explosive') || cleaned.includes('extreme') || cleaned.includes('violent') || cleaned.includes('maximum') || cleaned.includes('devastating')) {
    return 'explosive';
  }
  if (cleaned.includes('high') || cleaned.includes('intense') || cleaned.includes('heavy') || cleaned.includes('fast') || cleaned.includes('energetic')) {
    return 'high';
  }
  if (cleaned.includes('moderate') || cleaned.includes('medium') || cleaned.includes('normal') || cleaned.includes('standard') || cleaned.includes('average')) {
    return 'moderate';
  }
  if (cleaned.includes('subtle') || cleaned.includes('low') || cleaned.includes('mild') || cleaned.includes('gentle') || cleaned.includes('minor') || cleaned.includes('calm')) {
    return 'subtle';
  }

  return 'moderate';
}

/**
 * Normalizes temporal context state.
 */
export function normalizeTemporalContext(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().trim().replace(/[-_\s]+/g, '');

  if (cleaned.includes('static') || cleaned.includes('still') || cleaned.includes('paused') || cleaned.includes('idle')) {
    return 'static';
  }
  if (cleaned.includes('ongoing') || cleaned.includes('mid') || cleaned.includes('motion') || cleaned.includes('active') || cleaned.includes('inmotion')) {
    return 'ongoing';
  }
  if (cleaned.includes('impact') || cleaned.includes('contact') || cleaned.includes('strike') || cleaned.includes('collision') || cleaned.includes('hit')) {
    return 'impact';
  }
  if (cleaned.includes('aftermath') || cleaned.includes('recoil') || cleaned.includes('post') || cleaned.includes('smoke') || cleaned.includes('clearing')) {
    return 'aftermath';
  }
  if (cleaned.includes('transition') || cleaned.includes('shift') || cleaned.includes('stance')) {
    return 'transition';
  }

  return raw.trim().toLowerCase();
}

/**
 * Normalizes directional representation (e.g. vector object or string description).
 */
export function normalizeDirection(raw?: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const x = typeof obj.x === 'number' ? obj.x : undefined;
    const y = typeof obj.y === 'number' ? obj.y : undefined;
    if (x !== undefined && y !== undefined) {
      return `[x: ${x.toFixed(2)}, y: ${y.toFixed(2)}]`;
    }
  }
  return undefined;
}

/**
 * Clamps confidence score to canonical range [0.0, 1.0].
 */
export function sanitizeConfidence(val?: number, fallback: number = 0.85): number {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return Math.max(0, Math.min(1, Math.round(val * 1000) / 1000));
}

/**
 * Normalizes and validates raw AI scene and action analysis responses into canonical models.
 */
export function normalizeAndValidateAISceneAndActionAnalysis(
  raw: unknown,
  provenance: AnalysisSource,
  knownSubjectIds?: string[]
): {
  scene?: SceneContext;
  actions: ActionObservation[];
} {
  // 1. Zod Raw Schema Validation
  const parseResult = AISceneAndActionAnalysisResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    console.warn('AI Scene & Action response had raw schema validation warnings:', parseResult.error);
  }

  const rawData = parseResult.success ? parseResult.data : ((raw || {}) as any);

  // 2. Extract & Normalize Scene Context
  const rawScene = rawData.scene || rawData.scene_context;
  let scene: SceneContext | undefined = undefined;

  if (rawScene && typeof rawScene === 'object') {
    const indoor_outdoor = normalizeIndoorOutdoor(rawScene.indoor_outdoor || rawScene.setting);
    const time_context = normalizeTimeContext(rawScene.time_context || rawScene.time_of_day);
    const environment = typeof (rawScene.environment || rawScene.environment_type) === 'string'
      ? (rawScene.environment || rawScene.environment_type).trim()
      : undefined;
    const location = typeof rawScene.location === 'string' ? rawScene.location.trim() : undefined;
    const weather = typeof rawScene.weather === 'string' ? rawScene.weather.trim() : undefined;
    const lighting = typeof rawScene.lighting === 'string' ? rawScene.lighting.trim() : undefined;
    const atmosphere = typeof rawScene.atmosphere === 'string' ? rawScene.atmosphere.trim() : undefined;
    const confidence = typeof rawScene.confidence === 'number' ? sanitizeConfidence(rawScene.confidence) : 0.88;

    const candidateScene: SceneContext = {
      location: location || undefined,
      environment: environment || undefined,
      indoor_outdoor,
      time_context,
      weather: weather || undefined,
      lighting: lighting || undefined,
      atmosphere: atmosphere || undefined,
      confidence,
    };

    const validatedScene = SceneContextSchema.safeParse(candidateScene);
    if (validatedScene.success) {
      scene = candidateScene;
    } else {
      console.warn('Scene context failed validation:', validatedScene.error);
    }
  }

  // 3. Extract & Normalize Action Observations
  const rawActions = Array.isArray(rawData.actions)
    ? rawData.actions
    : Array.isArray(rawData.action)
    ? rawData.action
    : [];

  const actions: ActionObservation[] = [];
  const knownIdSet = knownSubjectIds ? new Set(knownSubjectIds) : null;

  for (let i = 0; i < rawActions.length; i++) {
    const rawAction = rawActions[i];
    if (!rawAction || typeof rawAction !== 'object') continue;

    const actionId =
      rawAction.action_id && typeof rawAction.action_id === 'string' && rawAction.action_id.length > 0
        ? rawAction.action_id
        : `act_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

    const actionType =
      typeof (rawAction.action_type || rawAction.type || rawAction.action) === 'string'
        ? (rawAction.action_type || rawAction.type || rawAction.action).trim().toLowerCase()
        : 'action';

    const description =
      typeof rawAction.description === 'string' ? rawAction.description.trim() : undefined;

    let actorId: string | undefined = undefined;
    const candidateActor = rawAction.actor_subject_id || rawAction.actor_ref || rawAction.actor;
    if (typeof candidateActor === 'string' && candidateActor.trim().length > 0) {
      const trimmed = candidateActor.trim();
      actorId = knownIdSet && !knownIdSet.has(trimmed) ? trimmed : trimmed;
    }

    let targetId: string | undefined = undefined;
    const candidateTarget = rawAction.target_subject_id || rawAction.target_ref || rawAction.target;
    if (typeof candidateTarget === 'string' && candidateTarget.trim().length > 0) {
      const trimmed = candidateTarget.trim();
      targetId = knownIdSet && !knownIdSet.has(trimmed) ? trimmed : trimmed;
    }

    const intensity = normalizeActionIntensity(rawAction.intensity);
    const direction = normalizeDirection(rawAction.direction);
    const temporalContext = normalizeTemporalContext(rawAction.temporal_context);
    const confidence = sanitizeConfidence(rawAction.confidence, 0.85);

    const candidateAction: ActionObservation = {
      action_id: actionId,
      type: actionType,
      description: description || undefined,
      actor_subject_id: actorId || undefined,
      target_subject_id: targetId || undefined,
      intensity,
      direction: direction || undefined,
      temporal_context: temporalContext || undefined,
      confidence,
    };

    const actionValidation = ActionObservationSchema.safeParse(candidateAction);
    if (actionValidation.success) {
      actions.push(candidateAction);
    } else {
      console.warn(`Action observation at index ${i} failed schema validation:`, actionValidation.error);
    }
  }

  return {
    scene,
    actions,
  };
}
