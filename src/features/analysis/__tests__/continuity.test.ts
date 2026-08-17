/**
 * Part 2.8 — Test Suite for Visual Continuity & Cross-Panel Relationship Analysis
 * 
 * Verifies schema validation, normalization rules, reference integrity checks,
 * zero-fabrication guarantees, scope separation, and mock provider fixtures.
 */

import {
  TransitionTypeSchema,
  CrossPanelRelationshipSchema,
  ContinuityAnalysisSchema,
  AIContinuityResponseSchema,
} from '../../../data/schemas/visual-analysis.schema';
import {
  normalizeTransitionType,
  normalizeContinuityStatus,
  normalizeRelationshipType,
  normalizeEntityContinuityType,
  normalizeObjectContinuityType,
  normalizeActionContinuityType,
  normalizeFocusContinuityType,
  normalizeVisualStateChangeType,
  normalizeConfidenceScore,
  normalizeAndValidateAIContinuityAnalysis,
} from '../../../services/ai/continuity-provider';
import { MockVisionAnalysisProvider } from '../../../services/ai/mock-provider';
import { ContinuityStageAnalyzer } from '../../../engines/visual-analysis/continuity';
import { Panel, AnalysisSource, ContinuityAnalysis } from '../../../types';

export async function runContinuityTests(): Promise<{
  passed: number;
  failed: number;
  errors: string[];
}> {
  let passed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      errors.push(`Assertion failed: ${message}`);
    } else {
      passed++;
    }
  }

  // 1. Valid ContinuityAnalysisSchema parsing
  try {
    const validData = {
      transition_type: 'CONTINUOUS_ACTION',
      scene_continuity: {
        status: 'SCENE_CONTINUES',
        confidence: 0.94,
        evidence: ['Consistent dusk lighting and background pillar architecture'],
      },
      action_continuity: {
        status: 'ACTION_RESULT',
        confidence: 0.91,
        source_action_id: 'act_001',
        target_action_id: 'act_002',
        evidence: ['Impact recoil following sword swing'],
      },
      focus_continuity: {
        status: 'FOCUS_CONTINUES',
        confidence: 0.92,
        shift_description: 'Character center focus preserved through impact resolution',
      },
      relationships: [
        {
          relationship_id: 'rel_01',
          source_panel_id: 'panel_01',
          target_panel_id: 'panel_02',
          relationship_type: 'SAME_ENTITY',
          source_entity_ref: 'char_001',
          target_entity_ref: 'char_001',
          entity_type: 'character',
          confidence: 0.95,
          evidence: ['Matching hair color, jacket, facial structure'],
          description: 'Protagonist follows through on combat movement',
        },
      ],
      state_changes: [
        {
          change_type: 'character_posture',
          subject_ref: 'char_001',
          description: 'Transited from ready stance to follow-through posture',
          confidence: 0.89,
        },
      ],
      summary: 'Action sequence continuing protagonist combat encounter',
      confidence: 0.92,
    };

    const parsed = ContinuityAnalysisSchema.safeParse(validData);
    assert(parsed.success, 'ContinuityAnalysisSchema accepts valid continuity structure');
  } catch (err: any) {
    errors.push(`Test 1 exception: ${err.message}`);
  }

  // 2. Normalization helpers for transitions, relationships, scenes, actions, and state changes
  try {
    assert(normalizeTransitionType('continuous_action') === 'CONTINUOUS_ACTION', 'Normalizes lowercase transition type');
    assert(normalizeTransitionType('scene-cut') === 'SCENE_CHANGE', 'Maps scene-cut to SCENE_CHANGE');
    assert(normalizeTransitionType('new_shot') === 'NEW_SHOT_SAME_SCENE', 'Maps new_shot to NEW_SHOT_SAME_SCENE');
    assert(normalizeTransitionType('unknown') === 'UNKNOWN', 'Fallback transition type is UNKNOWN');

    assert(normalizeContinuityStatus('scene_continues') === 'SCENE_CONTINUES', 'Normalizes scene continuity status');
    assert(normalizeContinuityStatus('new_location') === 'SCENE_CHANGES', 'Maps new_location to SCENE_CHANGES');

    assert(normalizeRelationshipType('same-character') === 'SAME_ENTITY', 'Normalizes same-character to SAME_ENTITY');
    assert(normalizeRelationshipType('likely_same') === 'POSSIBLE_SAME_ENTITY', 'Normalizes likely_same to POSSIBLE_SAME_ENTITY');
    assert(normalizeRelationshipType('different_person') === 'DIFFERENT_ENTITY', 'Normalizes different_person to DIFFERENT_ENTITY');
    assert(normalizeRelationshipType('prop-persists') === 'SAME_OBJECT', 'Maps prop-persists to SAME_OBJECT');
    assert(normalizeRelationshipType('new_prop') === 'OBJECT_APPEARS', 'Maps new_prop to OBJECT_APPEARS');
    assert(normalizeRelationshipType('object_disappears') === 'OBJECT_DISAPPEARS', 'Maps object_disappears to OBJECT_DISAPPEARS');

    assert(normalizeActionContinuityType('consequence') === 'ACTION_RESULT', 'Maps consequence to ACTION_RESULT');
    assert(normalizeActionContinuityType('ongoing') === 'ACTION_CONTINUES', 'Maps ongoing to ACTION_CONTINUES');
    assert(normalizeActionContinuityType('follow_through') === 'ACTION_TRANSITION', 'Maps follow_through to ACTION_TRANSITION');
    assert(normalizeActionContinuityType('unrelated') === 'NO_CONTINUITY', 'Maps unrelated to NO_CONTINUITY');

    assert(normalizeFocusContinuityType('maintained') === 'FOCUS_CONTINUES', 'Maps maintained to FOCUS_CONTINUES');
    assert(normalizeFocusContinuityType('shifted') === 'FOCUS_SHIFT', 'Maps shifted to FOCUS_SHIFT');

    assert(normalizeVisualStateChangeType('facial expression') === 'expression', 'Maps facial expression to expression');
    assert(normalizeVisualStateChangeType('sword state') === 'object_state', 'Maps sword state to object_state');
    assert(normalizeVisualStateChangeType('dimmed lighting') === 'lighting', 'Maps dimmed lighting to lighting');
  } catch (err: any) {
    errors.push(`Test 2 exception: ${err.message}`);
  }

  // 3. Confidence score clamping bounds
  try {
    assert(normalizeConfidenceScore(0.95) === 0.95, 'Preserves normal confidence');
    assert(normalizeConfidenceScore(1.5) === 1.0, 'Clamps upper bound confidence to 1.0');
    assert(normalizeConfidenceScore(-0.2) === 0.0, 'Clamps lower bound confidence to 0.0');
    assert(normalizeConfidenceScore('0.85') === 0.85, 'Parses string confidence values');
    assert(normalizeConfidenceScore(undefined, 0.75) === 0.75, 'Uses fallback for missing confidence');
  } catch (err: any) {
    errors.push(`Test 3 exception: ${err.message}`);
  }

  // 4. Normalization & reference integrity with AI response payload (Zero-Fabrication Anti-Hallucination)
  try {
    const rawAiResponse = {
      transition_type: 'continuous_scene',
      scene_continuity: {
        status: 'scene_continues',
        confidence: 0.92,
        evidence: ['Same hallway background'],
      },
      action_continuity: {
        status: 'action_continues',
        confidence: 0.88,
        source_action_id: 'act_valid_1',
        target_action_id: 'act_valid_2',
        evidence: ['Movement continues rightward'],
      },
      relationships: [
        {
          relationship_type: 'same_character',
          source_entity_ref: 'char_001',
          target_entity_ref: 'char_001',
          confidence: 0.96,
          evidence: ['Identical outfit and hair'],
          description: 'Main character moving across room',
        },
        // Hallucinated entity references that are NOT in allowed sets must be sanitized
        {
          relationship_type: 'same_character',
          source_entity_ref: 'char_hallucinated_999',
          target_entity_ref: 'char_001',
          confidence: 0.8,
          description: 'Ghost entity link',
        },
        {
          relationship_type: 'same_object',
          source_entity_ref: 'sub_001',
          target_entity_ref: 'sub_hallucinated_888',
          confidence: 0.75,
          description: 'Ghost target link',
        },
      ],
      state_changes: [
        {
          change_type: 'character_expression',
          subject_ref: 'char_001',
          description: 'Expression changed from calm to alert',
        },
        {
          change_type: 'appearance',
          subject_ref: 'ghost_ref_777',
          description: 'Unverified ghost appearance',
        },
      ],
      summary: 'Continuous indoor dialogue scene',
      confidence: 0.90,
    };

    const provenance: AnalysisSource = {
      provider: 'mock-vision',
      model: 'mock-model-v1',
      model_version: '1.0.0',
      prompt_version: 'continuity-v1',
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    const normalized = normalizeAndValidateAIContinuityAnalysis(
      rawAiResponse,
      provenance,
      {
        currentPanelId: 'panel_02',
        previousPanelId: 'panel_01',
        validSourceEntityIds: new Set(['char_001', 'sub_001', 'act_valid_1']),
        validTargetEntityIds: new Set(['char_001', 'sub_002', 'act_valid_2']),
      }
    );

    assert(normalized.transition_type === 'CONTINUOUS_SCENE', 'Normalized transition type');
    assert(normalized.scene_continuity?.status === 'SCENE_CONTINUES', 'Normalized scene status');
    assert(normalized.relationships.length === 3, 'All relationship objects normalized');
    assert(normalized.relationships[0].source_entity_ref === 'char_001', 'Preserved verified source entity ref');
    assert(normalized.relationships[1].source_entity_ref === undefined, 'Sanitized hallucinated source entity ref');
    assert(normalized.relationships[2].target_entity_ref === undefined, 'Sanitized hallucinated target entity ref');
    assert(normalized.state_changes?.[0].subject_ref === 'char_001', 'Preserved verified subject_ref in state changes');
    assert(normalized.state_changes?.[1].subject_ref === undefined, 'Sanitized invalid subject_ref in state changes');
  } catch (err: any) {
    errors.push(`Test 4 exception: ${err.message}`);
  }

  // 5. Malformed & Empty AI Response Resilience
  try {
    const provenance: AnalysisSource = {
      provider: 'mock-vision',
      model: 'mock-model-v1',
      model_version: '1.0.0',
      prompt_version: 'continuity-v1',
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    const nullResult = normalizeAndValidateAIContinuityAnalysis(
      null,
      provenance,
      {
        currentPanelId: 'panel_02',
        previousPanelId: 'panel_01',
        validSourceEntityIds: new Set(),
        validTargetEntityIds: new Set(),
      }
    );

    assert(nullResult.transition_type === 'UNKNOWN', 'Null AI response produces safe UNKNOWN transition');
    assert(nullResult.relationships.length === 0, 'Null AI response yields empty relationships');
    assert(nullResult.confidence !== undefined && nullResult.confidence >= 0, 'Null AI response has bounded fallback confidence');
  } catch (err: any) {
    errors.push(`Test 5 exception: ${err.message}`);
  }

  // 6. Mock Provider Continuity Analysis
  try {
    const mockProvider = new MockVisionAnalysisProvider();
    const result = await mockProvider.analyzePanelContinuity({
      currentImageBlob: new Blob(['test-current'], { type: 'image/jpeg' }),
      currentPanelId: 'panel_002',
      previousPanelId: 'panel_001',
      currentContext: {
        panelId: 'panel_002',
        order: 2,
      },
    });

    assert(result !== null && typeof result === 'object', 'Mock provider returned result');
    assert(result.provenance.source_type === 'ai', 'Provenance contains ai source');
    assert((result.raw as any).transition_type === 'CONTINUOUS_ACTION', 'Mock raw contains transition_type');
  } catch (err: any) {
    errors.push(`Test 6 exception: ${err.message}`);
  }

  // 7. Strict Scope Separation: Verify No Narration, Camera Trajectory, or XML Fields in Continuity Models
  try {
    const continuityKeys = Object.keys(ContinuityAnalysisSchema.shape);
    const forbiddenPatterns = ['narration', 'recap', 'script', 'trajectory', 'keyframe', 'xml', 'timeline', 'timestamp'];
    const hasForbidden = continuityKeys.some(k => forbiddenPatterns.some(p => k.toLowerCase().includes(p)));
    assert(!hasForbidden, 'ContinuityAnalysisSchema is strictly isolated from narration, camera motion, and XML generation');
  } catch (err: any) {
    errors.push(`Test 7 exception: ${err.message}`);
  }

  return {
    passed,
    failed: errors.length,
    errors,
  };
}
