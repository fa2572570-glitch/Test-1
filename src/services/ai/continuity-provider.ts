/**
 * Part 2.8 — Visual Continuity & Cross-Panel Relationship Provider Abstraction & Response Normalizer
 * 
 * Provides normalizers, validation filters, reference integrity checks, and confidence clamping
 * for cross-panel character continuity, object persistence, action continuation, and visual state changes.
 */

import {
  ContinuityAnalysis,
  CrossPanelRelationship,
  CrossPanelRelationshipType,
  EntityContinuityType,
  ObjectContinuityType,
  ActionContinuityType,
  SceneContinuityType,
  FocusContinuityType,
  PanelTransitionType,
  VisualStateChange,
  AnalysisSource,
  SceneContext,
  ActionObservation,
  CharacterDetection,
  Subject,
  TextElement,
  VisualFocus,
} from '../../types';
import {
  AICrossPanelContinuityResponseSchema,
  ContinuityAnalysisSchema,
} from '../../data/schemas/visual-analysis.schema';
import { validateEntityReference } from './focus-provider';

export interface PanelContextSummary {
  panelId: string;
  order: number;
  aspectRatio?: number;
  characters?: CharacterDetection[];
  subjects?: Subject[];
  textElements?: TextElement[];
  scene?: SceneContext;
  actions?: ActionObservation[];
  visualFocus?: VisualFocus;
}

export interface ContinuityPromptPayload {
  currentImageBlob: Blob;
  previousImageBlob?: Blob;
  nextImageBlob?: Blob;
  currentPanelId: string;
  previousPanelId?: string;
  nextPanelId?: string;
  currentContext: PanelContextSummary;
  previousContext?: PanelContextSummary;
  nextContext?: PanelContextSummary;
}

/**
 * Normalizes relationship types to canonical CrossPanelRelationshipType enum.
 */
export function normalizeCrossPanelRelationshipType(raw?: string): CrossPanelRelationshipType {
  if (!raw) return 'UNKNOWN';
  const cleaned = raw.toUpperCase().trim().replace(/[-\s]+/g, '_');

  if (cleaned.includes('SAME_ENTITY') || cleaned === 'SAME_CHARACTER' || cleaned === 'IDENTICAL_CHARACTER') {
    return 'SAME_ENTITY';
  }
  if (cleaned.includes('POSSIBLE_SAME') || cleaned.includes('LIKELY_SAME') || cleaned.includes('PROBABLE_SAME')) {
    return 'POSSIBLE_SAME_ENTITY';
  }
  if (cleaned.includes('DIFF') || cleaned.includes('DISTINCT')) {
    return 'DIFFERENT_ENTITY';
  }
  if (cleaned === 'SAME_OBJECT' || cleaned === 'OBJECT_CONTINUES' || cleaned.includes('PERSISTENT_OBJECT') || cleaned.includes('PROP_PERSIST')) {
    return 'SAME_OBJECT';
  }
  if (cleaned.includes('OBJECT_DISAPPEAR') || cleaned === 'PROP_REMOVED') {
    return 'OBJECT_DISAPPEARS';
  }
  if (cleaned.includes('OBJECT_APPEAR') || cleaned === 'NEW_PROP') {
    return 'OBJECT_APPEARS';
  }
  if (cleaned.includes('ACTION_CONTINUE') || cleaned === 'CONTINUOUS_ACTION') {
    return 'ACTION_CONTINUES';
  }
  if (cleaned.includes('ACTION_RESULT') || cleaned === 'IMPACT_RESULT' || cleaned === 'CONSEQUENCE') {
    return 'ACTION_RESULT';
  }
  if (cleaned.includes('ACTION_TRANSITION') || cleaned === 'MOTION_TRANSITION') {
    return 'ACTION_TRANSITION';
  }
  if (cleaned.includes('NEW_ACTION')) {
    return 'NEW_ACTION';
  }
  if (cleaned.includes('SCENE_CONTINUE') || cleaned === 'SAME_SCENE' || cleaned === 'CONTINUOUS_SCENE') {
    return 'SCENE_CONTINUES';
  }
  if (cleaned.includes('SCENE_CHANGE') || cleaned === 'NEW_SCENE' || cleaned === 'LOCATION_CHANGE') {
    return 'SCENE_CHANGES';
  }
  if (cleaned.includes('TEXT_CONTINUE') || cleaned === 'DIALOGUE_CONTINUES') {
    return 'TEXT_CONTINUES';
  }
  if (cleaned.includes('TEXT_DISAPPEAR')) {
    return 'TEXT_DISAPPEARS';
  }
  if (cleaned.includes('NEW_TEXT') || cleaned === 'TEXT_APPEARS') {
    return 'NEW_TEXT_APPEARS';
  }
  if (cleaned.includes('SFX_CONTINUE')) {
    return 'SFX_CONTINUES';
  }
  if (cleaned.includes('FOCUS_CONTINUE') || cleaned === 'SAME_FOCUS') {
    return 'FOCUS_CONTINUES';
  }
  if (cleaned.includes('FOCUS_SHIFT') || cleaned === 'NEW_FOCUS') {
    return 'FOCUS_SHIFT';
  }
  if (cleaned.includes('POSITION_CHANGE') || cleaned === 'MOVED') {
    return 'POSITION_CHANGED';
  }
  if (cleaned.includes('POSITION_STABLE') || cleaned === 'STATIONARY') {
    return 'POSITION_STABLE';
  }
  if (cleaned.includes('STATE_CHANGE') || cleaned === 'VISUAL_CHANGE') {
    return 'VISUAL_STATE_CHANGES';
  }

  return 'UNKNOWN';
}

/**
 * Normalizes panel transition types.
 */
export function normalizePanelTransitionType(raw?: string): PanelTransitionType {
  if (!raw) return 'UNKNOWN';
  const cleaned = raw.toUpperCase().trim().replace(/[-\s]+/g, '_');

  if (cleaned.includes('CONTINUOUS_ACTION') || cleaned.includes('ACTION_CUT')) {
    return 'CONTINUOUS_ACTION';
  }
  if (cleaned.includes('CONTINUOUS_SCENE') || cleaned.includes('SAME_SCENE')) {
    return 'CONTINUOUS_SCENE';
  }
  if (cleaned.includes('NEW_SHOT') || cleaned.includes('ANGLE_CHANGE') || cleaned.includes('SAME_SCENE_NEW_SHOT')) {
    return 'NEW_SHOT_SAME_SCENE';
  }
  if (cleaned.includes('SCENE_CHANGE') || cleaned.includes('LOCATION_CHANGE') || cleaned.includes('TIME_SKIP') || cleaned.includes('SCENE_CUT')) {
    return 'SCENE_CHANGE';
  }

  return 'UNKNOWN';
}

/**
 * Normalizes scene continuity status.
 */
export function normalizeSceneContinuityType(raw?: string): SceneContinuityType {
  if (!raw) return 'UNKNOWN';
  const cleaned = raw.toUpperCase().trim().replace(/[-\s]+/g, '_');

  if (cleaned.includes('CONTINUE') || cleaned.includes('SAME')) {
    return 'SCENE_CONTINUES';
  }
  if (cleaned.includes('CHANGE') || cleaned.includes('NEW') || cleaned.includes('DIFFERENT') || cleaned.includes('CUT')) {
    return 'SCENE_CHANGES';
  }

  return 'UNKNOWN';
}

/**
 * Normalizes action continuity status.
 */
export function normalizeActionContinuityType(raw?: string): ActionContinuityType {
  if (!raw) return 'UNKNOWN';
  const cleaned = raw.toUpperCase().trim().replace(/[-\s]+/g, '_');

  if (cleaned.includes('RESULT') || cleaned.includes('IMPACT') || cleaned.includes('AFTERMATH') || cleaned.includes('CONSEQUENCE')) {
    return 'ACTION_RESULT';
  }
  if (cleaned.includes('CONTINUE') || cleaned.includes('ONGOING')) {
    return 'ACTION_CONTINUES';
  }
  if (cleaned.includes('TRANSITION') || cleaned.includes('FOLLOW_THROUGH')) {
    return 'ACTION_TRANSITION';
  }
  if (cleaned.includes('NEW')) {
    return 'NEW_ACTION';
  }
  if (cleaned.includes('NO_CONTINUITY') || cleaned.includes('NONE') || cleaned.includes('UNRELATED')) {
    return 'NO_CONTINUITY';
  }

  return 'UNKNOWN';
}

/**
 * Normalizes focus continuity status.
 */
export function normalizeFocusContinuityType(raw?: string): FocusContinuityType {
  if (!raw) return 'UNKNOWN';
  const cleaned = raw.toUpperCase().trim().replace(/[-\s]+/g, '_');

  if (cleaned.includes('CONTINUE') || cleaned.includes('SAME') || cleaned.includes('MAINTAINED')) {
    return 'FOCUS_CONTINUES';
  }
  if (cleaned.includes('SHIFT') || cleaned.includes('CHANGE') || cleaned.includes('MOVED')) {
    return 'FOCUS_SHIFT';
  }

  return 'UNKNOWN';
}

/**
 * Normalizes visual state change types.
 */
export function normalizeVisualStateChangeType(raw?: string): VisualStateChange['change_type'] {
  if (!raw) return 'other';
  const cleaned = raw.toLowerCase().trim().replace(/[-\s]+/g, '_');

  if (cleaned.includes('posture') || cleaned.includes('pose') || cleaned.includes('stance')) {
    return 'character_posture';
  }
  if (cleaned.includes('expression') || cleaned.includes('face') || cleaned.includes('emotion')) {
    return 'expression';
  }
  if (cleaned.includes('object') || cleaned.includes('weapon') || cleaned.includes('item') || cleaned.includes('sword')) {
    return 'object_state';
  }
  if (cleaned.includes('appear') && !cleaned.includes('disappear')) {
    return 'appearance';
  }
  if (cleaned.includes('disappear') || cleaned.includes('exit') || cleaned.includes('gone')) {
    return 'disappearance';
  }
  if (cleaned.includes('obscur') || cleaned.includes('occlud') || cleaned.includes('shadow')) {
    return 'obscuration';
  }
  if (cleaned.includes('light') || cleaned.includes('color') || cleaned.includes('tone')) {
    return 'lighting';
  }
  if (cleaned.includes('action') || cleaned.includes('motion') || cleaned.includes('combat')) {
    return 'action_state';
  }
  if (cleaned.includes('focus') || cleaned.includes('salien')) {
    return 'focus_shift';
  }
  if (cleaned.includes('env') || cleaned.includes('scene') || cleaned.includes('bg')) {
    return 'environment';
  }

  return 'other';
}

/**
 * Normalizes confidence score strictly into [0.0, 1.0].
 */
export function normalizeConfidenceScore(raw?: unknown, fallback: number = 0.8): number {
  if (typeof raw === 'number' && !isNaN(raw)) {
    return Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000));
  }
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      return Math.max(0, Math.min(1, Math.round(parsed * 1000) / 1000));
    }
  }
  return fallback;
}

export const normalizeTransitionType = normalizePanelTransitionType;
export const normalizeRelationshipType = normalizeCrossPanelRelationshipType;
export const normalizeEntityContinuityType = normalizeCrossPanelRelationshipType;
export const normalizeObjectContinuityType = normalizeCrossPanelRelationshipType;
export function normalizeContinuityStatus(raw?: string): SceneContinuityType {
  return normalizeSceneContinuityType(raw);
}

/**
 * Normalizes and validates raw AI response into canonical ContinuityAnalysis.
 */
export function normalizeAndValidateAIContinuityAnalysis(
  raw: unknown,
  provenance: AnalysisSource,
  referenceContext: {
    currentPanelId: string;
    previousPanelId?: string;
    nextPanelId?: string;
    validSourceEntityIds: Set<string>;
    validTargetEntityIds: Set<string>;
  }
): ContinuityAnalysis {
  const parseResult = AICrossPanelContinuityResponseSchema.safeParse(raw);
  const data = parseResult.success ? parseResult.data : (raw as any) || {};

  const currentPanelId = referenceContext.currentPanelId;
  const previousPanelId = referenceContext.previousPanelId || null;
  const nextPanelId = referenceContext.nextPanelId || null;

  // 1. Transition type
  const transitionType = normalizePanelTransitionType(data.transition_type || data.panel_transition);

  // 2. Scene continuity
  const sceneRaw = data.scene_continuity;
  const sceneStatus = normalizeSceneContinuityType(sceneRaw?.status || sceneRaw?.continuity);
  const sceneConfidence = normalizeConfidenceScore(sceneRaw?.confidence, 0.85);
  const sceneEvidence: string[] = Array.isArray(sceneRaw?.evidence)
    ? sceneRaw.evidence.filter((e: any) => typeof e === 'string' && e.trim().length > 0)
    : typeof sceneRaw?.evidence === 'string' && sceneRaw.evidence.trim()
    ? [sceneRaw.evidence.trim()]
    : [];

  const sceneContinuity = {
    status: sceneStatus,
    confidence: sceneConfidence,
    evidence: sceneEvidence.length > 0 ? sceneEvidence : undefined,
  };

  // 3. Action continuity
  const actionRaw = data.action_continuity;
  const actionStatus = normalizeActionContinuityType(actionRaw?.status || actionRaw?.continuity);
  const actionConfidence = normalizeConfidenceScore(actionRaw?.confidence, 0.8);
  const sourceActionId = validateEntityReference(actionRaw?.source_action_id, referenceContext.validSourceEntityIds);
  const targetActionId = validateEntityReference(actionRaw?.target_action_id, referenceContext.validTargetEntityIds);
  const actionEvidence: string[] = Array.isArray(actionRaw?.evidence)
    ? actionRaw.evidence.filter((e: any) => typeof e === 'string' && e.trim().length > 0)
    : typeof actionRaw?.evidence === 'string' && actionRaw.evidence.trim()
    ? [actionRaw.evidence.trim()]
    : [];

  const actionContinuity = {
    status: actionStatus,
    confidence: actionConfidence,
    source_action_id: sourceActionId,
    target_action_id: targetActionId,
    evidence: actionEvidence.length > 0 ? actionEvidence : undefined,
  };

  // 4. Focus continuity
  const focusRaw = data.focus_continuity;
  const focusStatus = normalizeFocusContinuityType(focusRaw?.status || focusRaw?.continuity);
  const focusConfidence = normalizeConfidenceScore(focusRaw?.confidence, 0.85);
  const shiftDescription = focusRaw?.shift_description || focusRaw?.reason || undefined;

  const focusContinuity = {
    status: focusStatus,
    confidence: focusConfidence,
    shift_description: shiftDescription,
  };

  // 5. Relationships
  const rawRelationships = Array.isArray(data.relationships)
    ? data.relationships
    : Array.isArray(data.panel_relationships)
    ? data.panel_relationships
    : [];

  const normalizedRelationships: CrossPanelRelationship[] = [];
  let relCounter = 1;

  for (const rel of rawRelationships) {
    if (!rel || typeof rel !== 'object') continue;

    const relationshipType = normalizeCrossPanelRelationshipType(
      rel.relationship_type || rel.relationship || rel.type
    );

    const sourcePanel = rel.source_panel_id || previousPanelId || currentPanelId;
    const targetPanel = rel.target_panel_id || currentPanelId;

    // Validate entity references against verified IDs
    const rawSourceRef = rel.source_entity_ref || rel.source_ref || rel.source_id;
    const rawTargetRef = rel.target_entity_ref || rel.target_ref || rel.target_id;

    const sourceEntityRef = validateEntityReference(rawSourceRef, referenceContext.validSourceEntityIds);
    const targetEntityRef = validateEntityReference(rawTargetRef, referenceContext.validTargetEntityIds);

    const confidence = normalizeConfidenceScore(rel.confidence, 0.8);

    const evidence: string[] = Array.isArray(rel.evidence)
      ? rel.evidence.filter((e: any) => typeof e === 'string' && e.trim().length > 0)
      : typeof rel.evidence === 'string' && rel.evidence.trim()
      ? [rel.evidence.trim()]
      : [];

    const description = rel.description || rel.reason || undefined;

    // Entity type categorization
    let entityType: CrossPanelRelationship['entity_type'] = undefined;
    if (rel.entity_type) {
      const et = String(rel.entity_type).toLowerCase();
      if (et.includes('char')) entityType = 'character';
      else if (et.includes('obj') || et.includes('weapon') || et.includes('item')) entityType = 'object';
      else if (et.includes('act')) entityType = 'action';
      else if (et.includes('txt') || et.includes('text') || et.includes('dialogue')) entityType = 'text';
      else if (et.includes('foc')) entityType = 'focus';
      else if (et.includes('scene')) entityType = 'scene';
      else if (et.includes('sub')) entityType = 'subject';
      else entityType = 'panel';
    } else if (relationshipType === 'SAME_ENTITY' || relationshipType === 'POSSIBLE_SAME_ENTITY' || relationshipType === 'DIFFERENT_ENTITY') {
      entityType = 'character';
    } else if (relationshipType === 'SAME_OBJECT' || relationshipType === 'OBJECT_APPEARS' || relationshipType === 'OBJECT_DISAPPEARS') {
      entityType = 'object';
    } else if (relationshipType === 'ACTION_CONTINUES' || relationshipType === 'ACTION_RESULT' || relationshipType === 'ACTION_TRANSITION') {
      entityType = 'action';
    } else if (relationshipType === 'SCENE_CONTINUES' || relationshipType === 'SCENE_CHANGES') {
      entityType = 'scene';
    }

    normalizedRelationships.push({
      relationship_id: rel.relationship_id || rel.id || `rel_${currentPanelId}_${relCounter++}`,
      source_panel_id: sourcePanel,
      target_panel_id: targetPanel,
      relationship_type: relationshipType,
      source_entity_ref: sourceEntityRef,
      target_entity_ref: targetEntityRef,
      entity_type: entityType,
      confidence,
      evidence: evidence.length > 0 ? evidence : undefined,
      description,
    });
  }

  // 6. Visual State Changes
  const rawStateChanges = Array.isArray(data.state_changes)
    ? data.state_changes
    : Array.isArray(data.visual_state_changes)
    ? data.visual_state_changes
    : [];

  const normalizedStateChanges: VisualStateChange[] = [];
  for (const sc of rawStateChanges) {
    if (!sc || typeof sc !== 'object') continue;
    const description = sc.description || sc.change;
    if (!description || typeof description !== 'string' || !description.trim()) continue;

    const changeType = normalizeVisualStateChangeType(sc.change_type || sc.type);
    const subjectRef = validateEntityReference(sc.subject_ref || sc.entity_ref, referenceContext.validTargetEntityIds);
    const confidence = normalizeConfidenceScore(sc.confidence, 0.85);

    normalizedStateChanges.push({
      change_type: changeType,
      subject_ref: subjectRef,
      description: description.trim(),
      confidence,
    });
  }

  const overallConfidence = normalizeConfidenceScore(data.confidence, 0.85);
  const summary = typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : undefined;

  const result: ContinuityAnalysis = {
    previous_panel_id: previousPanelId,
    next_panel_id: nextPanelId,
    transition_type: transitionType,
    scene_continuity: sceneContinuity,
    action_continuity: actionContinuity,
    focus_continuity: focusContinuity,
    relationships: normalizedRelationships,
    state_changes: normalizedStateChanges.length > 0 ? normalizedStateChanges : undefined,
    summary,
    confidence: overallConfidence,
    source: provenance,
  };

  // Final validation against canonical Zod schema
  const validation = ContinuityAnalysisSchema.safeParse(result);
  if (!validation.success) {
    console.warn('Continuity analysis validation issues:', validation.error.format());
  }

  return result;
}
