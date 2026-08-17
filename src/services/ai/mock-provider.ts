/**
 * Part 2.3 — Mock Vision Analysis Provider
 * 
 * Used for automated testing and deterministic validation without requiring
 * external network connectivity or paid API keys.
 */

import {
  IVisionAnalysisProvider,
  CompositionPromptPayload,
} from './composition-provider';
import { SubjectDetectionPromptPayload } from './subject-provider';
import { TextAnalysisPromptPayload } from './text-provider';
import { SceneActionPromptPayload } from './scene-action-provider';
import { FocusPromptPayload } from './focus-provider';
import { ContinuityPromptPayload } from './continuity-provider';
import { AnalysisSource, AnalysisError } from '../../types';
import { COMPOSITION_PROMPT_VERSION } from '../../features/analysis/prompts/composition.prompt';
import { SUBJECT_DETECTION_PROMPT_VERSION } from '../../features/analysis/prompts/subject-detection.prompt';
import { TEXT_ANALYSIS_PROMPT_VERSION } from '../../features/analysis/prompts/text-analysis.prompt';
import { SCENE_ACTION_PROMPT_VERSION } from '../../features/analysis/prompts/scene-action.prompt';
import { FOCUS_SALIENCE_PROMPT_VERSION } from '../../features/analysis/prompts/focus-salience.prompt';
import { CONTINUITY_PROMPT_VERSION } from '../../features/analysis/prompts/continuity.prompt';

export class MockVisionAnalysisProvider implements IVisionAnalysisProvider {
  readonly providerId = 'mock-vision';
  readonly modelId = 'mock-model-v1';
  readonly promptVersion = COMPOSITION_PROMPT_VERSION;
  readonly subjectPromptVersion = SUBJECT_DETECTION_PROMPT_VERSION;
  readonly textPromptVersion = TEXT_ANALYSIS_PROMPT_VERSION;
  readonly sceneActionPromptVersion = SCENE_ACTION_PROMPT_VERSION;
  readonly focusPromptVersion = FOCUS_SALIENCE_PROMPT_VERSION;
  readonly continuityPromptVersion = CONTINUITY_PROMPT_VERSION;

  private mockResponseGenerator?: (payload: CompositionPromptPayload) => Promise<unknown> | unknown;
  private mockSubjectResponseGenerator?: (payload: SubjectDetectionPromptPayload) => Promise<unknown> | unknown;
  private mockTextResponseGenerator?: (payload: TextAnalysisPromptPayload) => Promise<unknown> | unknown;
  private mockSceneActionResponseGenerator?: (payload: SceneActionPromptPayload) => Promise<unknown> | unknown;
  private mockFocusResponseGenerator?: (payload: FocusPromptPayload) => Promise<unknown> | unknown;
  private mockContinuityResponseGenerator?: (payload: ContinuityPromptPayload) => Promise<unknown> | unknown;
  private shouldFailWith?: AnalysisError;

  constructor(
    customResponseGenerator?: (payload: CompositionPromptPayload) => Promise<unknown> | unknown,
    shouldFailWith?: AnalysisError
  ) {
    this.mockResponseGenerator = customResponseGenerator;
    this.shouldFailWith = shouldFailWith;
  }

  setMockResponse(generator: (payload: CompositionPromptPayload) => Promise<unknown> | unknown) {
    this.mockResponseGenerator = generator;
    this.shouldFailWith = undefined;
  }

  setMockSubjectResponse(generator: (payload: SubjectDetectionPromptPayload) => Promise<unknown> | unknown) {
    this.mockSubjectResponseGenerator = generator;
    this.shouldFailWith = undefined;
  }

  setMockTextResponse(generator: (payload: TextAnalysisPromptPayload) => Promise<unknown> | unknown) {
    this.mockTextResponseGenerator = generator;
    this.shouldFailWith = undefined;
  }

  setMockSceneActionResponse(generator: (payload: SceneActionPromptPayload) => Promise<unknown> | unknown) {
    this.mockSceneActionResponseGenerator = generator;
    this.shouldFailWith = undefined;
  }

  setMockFocusResponse(generator: (payload: FocusPromptPayload) => Promise<unknown> | unknown) {
    this.mockFocusResponseGenerator = generator;
    this.shouldFailWith = undefined;
  }

  setMockContinuityResponse(generator: (payload: ContinuityPromptPayload) => Promise<unknown> | unknown) {
    this.mockContinuityResponseGenerator = generator;
    this.shouldFailWith = undefined;
  }

  setFailure(error: AnalysisError) {
    this.shouldFailWith = error;
  }

  async analyzePanelComposition(
    payload: CompositionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    if (signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'composition',
        message: 'Analysis was cancelled',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let raw: unknown;
    if (this.mockResponseGenerator) {
      raw = await this.mockResponseGenerator(payload);
    } else {
      // Default valid composition response
      raw = {
        shot_scale: 'medium-wide',
        framing: 'left-weighted',
        foreground_importance: 0.85,
        middleground_importance: 0.4,
        background_importance: 0.2,
        visual_density: 'dense',
        dominant_orientation: 'horizontal',
        visual_hierarchy: ['Primary Subject Figure', 'Background High-Rise Skyline', 'Foreground Shadow Layer'],
        dominant_regions: [
          {
            label: 'primary_subject',
            box: { x: 0.15, y: 0.2, width: 0.45, height: 0.7 },
            prominence: 'primary',
            weight: 0.85,
          },
          {
            label: 'negative_space_upper_right',
            box: { x: 0.65, y: 0.05, width: 0.3, height: 0.35 },
            prominence: 'supporting',
            weight: 0.3,
          },
        ],
        negative_space: 'moderate',
        dominant_colors: ['#1A202C', '#E2E8F0', '#3182CE'],
        lighting_mood: 'High-contrast dramatic twilight key lighting with cool ambient shadows',
        tonal_range: 'high_contrast',
        summary: 'A dynamic, left-weighted medium-wide shot with heavy foreground presence and open negative space in the upper right.',
        confidence: 0.92,
      };
    }

    const provenance: AnalysisSource = {
      provider: this.providerId,
      model: this.modelId,
      model_version: '1.0.0',
      prompt_version: this.promptVersion,
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    return { raw, provenance };
  }

  async analyzePanelSubjects(
    payload: SubjectDetectionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    if (signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'subjects',
        message: 'Subject detection analysis was cancelled',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let raw: unknown;
    if (this.mockSubjectResponseGenerator) {
      raw = await this.mockSubjectResponseGenerator(payload);
    } else {
      // Default valid subject & character detection response
      raw = {
        subjects: [
          {
            type: 'character',
            label: 'Main Figure in Dark Coat',
            bounding_box: { x: 0.2, y: 0.15, width: 0.45, height: 0.75 },
            visibility: 'fully_visible',
            importance: 'primary',
            confidence: 0.95,
          },
          {
            type: 'weapon',
            label: 'Glowing Runed Broadsword',
            bounding_box: { x: 0.55, y: 0.3, width: 0.18, height: 0.55 },
            visibility: 'fully_visible',
            importance: 'secondary',
            confidence: 0.91,
          },
          {
            type: 'effect',
            label: 'Azure Electric Sparks',
            bounding_box: { x: 0.5, y: 0.25, width: 0.35, height: 0.4 },
            visibility: 'partially_visible',
            importance: 'secondary',
            confidence: 0.88,
          },
        ],
        characters: [
          {
            label: 'Determined Swordsman',
            bounding_box: { x: 0.2, y: 0.15, width: 0.45, height: 0.75 },
            face_region: { x: 0.32, y: 0.18, width: 0.18, height: 0.15 },
            visibility: 'full_body',
            pose: 'fighting',
            expression: 'determined',
            action: 'gripping weapon with both hands',
            screen_position: 'center',
            confidence: 0.94,
          },
        ],
      };
    }

    const provenance: AnalysisSource = {
      provider: this.providerId,
      model: this.modelId,
      model_version: '1.0.0',
      prompt_version: this.subjectPromptVersion,
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    return { raw, provenance };
  }

  async analyzePanelText(
    payload: TextAnalysisPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    if (signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'text',
        message: 'Text analysis was cancelled',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let raw: unknown;
    if (this.mockTextResponseGenerator) {
      raw = await this.mockTextResponseGenerator(payload);
    } else {
      // Default valid text detection response fixtures
      raw = {
        text_elements: [
          {
            type: 'narration',
            content: 'YEAR 2045. THE GATES FIRST OPENED OVER SEOUL.',
            bounding_box: { x: 0.08, y: 0.06, width: 0.84, height: 0.12 },
            reading_order: 0,
            speaker_reference: undefined,
            confidence: 0.96,
            ocr_confidence: 0.98,
          },
          {
            type: 'dialogue',
            content: 'Is this the legendary S-Rank dungeon boss?!',
            bounding_box: { x: 0.15, y: 0.22, width: 0.42, height: 0.14 },
            reading_order: 1,
            speaker_reference: 'char_001',
            confidence: 0.94,
            ocr_confidence: 0.95,
          },
          {
            type: 'sfx',
            content: 'KZZZZT!',
            bounding_box: { x: 0.58, y: 0.28, width: 0.32, height: 0.15 },
            reading_order: 2,
            speaker_reference: undefined,
            confidence: 0.91,
            ocr_confidence: 0.92,
          },
        ],
      };
    }

    const provenance: AnalysisSource = {
      provider: this.providerId,
      model: this.modelId,
      model_version: '1.0.0',
      prompt_version: this.textPromptVersion,
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    return { raw, provenance };
  }

  async analyzePanelSceneAndAction(
    payload: SceneActionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    if (signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'scene_and_action',
        message: 'Scene and action analysis was cancelled',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let raw: unknown;
    if (this.mockSceneActionResponseGenerator) {
      raw = await this.mockSceneActionResponseGenerator(payload);
    } else {
      // Default valid scene & action detection fixture
      raw = {
        scene: {
          location: 'Deep subterranean cavern with crystalline formations',
          environment: 'dungeon',
          indoor_outdoor: 'indoor',
          time_context: 'timeless',
          weather: 'none',
          lighting: 'dramatic bioluminescent glow with deep cast shadows',
          atmosphere: 'tense',
          confidence: 0.94,
        },
        actions: [
          {
            type: 'attacking',
            description: 'Swordsman executes a high-speed downward slash with broadsword',
            actor_subject_id: 'char_001',
            target_subject_id: 'char_002',
            intensity: 'high',
            direction: 'diagonal-down-right',
            temporal_context: 'ongoing',
            confidence: 0.92,
          },
          {
            type: 'defending',
            description: 'Opponent raises energy barrier in reaction to incoming slash',
            actor_subject_id: 'char_002',
            target_subject_id: 'char_001',
            intensity: 'moderate',
            direction: 'upward',
            temporal_context: 'impact',
            confidence: 0.89,
          },
        ],
      };
    }

    const provenance: AnalysisSource = {
      provider: this.providerId,
      model: this.modelId,
      model_version: '1.0.0',
      prompt_version: this.sceneActionPromptVersion,
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    return { raw, provenance };
  }

  async analyzePanelFocus(
    payload: FocusPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    if (signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'focus',
        message: 'Visual focus analysis was cancelled',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let raw: unknown;
    if (this.mockFocusResponseGenerator) {
      raw = await this.mockFocusResponseGenerator(payload);
    } else {
      // Default valid visual focus & salience fixture
      raw = {
        visual_focus: {
          primary_target: {
            type: 'character',
            subject_id: 'char_001',
            region: { x: 0.22, y: 0.16, width: 0.36, height: 0.62 },
            description: 'Protagonist delivering the primary strike at visual center with maximum contrast',
          },
          secondary_targets: [
            {
              type: 'character',
              subject_id: 'char_002',
              region: { x: 0.58, y: 0.32, width: 0.34, height: 0.54 },
              description: 'Opponent defending against strike in right third',
            },
            {
              type: 'action_area',
              subject_id: null,
              region: { x: 0.44, y: 0.28, width: 0.26, height: 0.30 },
              description: 'High-energy collision point between sword and barrier',
            },
          ],
          focus_region: { x: 0.20, y: 0.14, width: 0.72, height: 0.74 },
          importance: 0.95,
          confidence: 0.93,
          reason: 'Primary swordsman is centrally composed with leading dynamic speedlines and greatest visual contrast.',
        },
        camera_analysis: {
          recommended_target: { x: 0.22, y: 0.16, width: 0.55, height: 0.65 },
          safe_regions: [
            {
              region_id: 'cam_reg_primary',
              region: { x: 0.20, y: 0.14, width: 0.72, height: 0.74 },
              safe_margin: 0.05,
              target_type: 'character',
              importance: 0.95,
              confidence: 0.93,
            },
            {
              region_id: 'cam_reg_action',
              region: { x: 0.40, y: 0.25, width: 0.35, height: 0.38 },
              safe_margin: 0.04,
              target_type: 'full_action',
              importance: 0.88,
              confidence: 0.90,
            },
          ],
          shot_type: 'medium-close-action',
          zoom_potential: 'high',
          pan_potential: 'diagonal',
          suggested_motion: 'diagonal_pan_follow_strike',
          duration_seconds: 2.5,
          confidence: 0.92,
        },
      };
    }

    const provenance: AnalysisSource = {
      provider: this.providerId,
      model: this.modelId,
      model_version: '1.0.0',
      prompt_version: this.focusPromptVersion,
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    return { raw, provenance };
  }

  async analyzePanelContinuity(
    payload: ContinuityPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    if (signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'continuity',
        message: 'Visual continuity analysis was cancelled',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (this.shouldFailWith) {
      throw this.shouldFailWith;
    }

    let raw: unknown;
    if (this.mockContinuityResponseGenerator) {
      raw = await this.mockContinuityResponseGenerator(payload);
    } else {
      const prevCharId = payload.previousContext?.characters?.[0]?.character_id || 'char_001';
      const currCharId = payload.currentContext?.characters?.[0]?.character_id || 'char_001';

      raw = {
        transition_type: 'CONTINUOUS_ACTION',
        scene_continuity: {
          status: 'SCENE_CONTINUES',
          confidence: 0.94,
          evidence: ['Consistent architectural background and ambient dusk lighting tone'],
        },
        action_continuity: {
          status: 'ACTION_RESULT',
          confidence: 0.91,
          source_action_id: payload.previousContext?.actions?.[0]?.action_id || 'act_001',
          target_action_id: payload.currentContext?.actions?.[0]?.action_id || 'act_002',
          evidence: ['Follow-through impact motion directly resulting from sword swing'],
        },
        focus_continuity: {
          status: 'FOCUS_CONTINUES',
          confidence: 0.92,
          shift_description: 'Primary character retains center focus while action resolves to impact point',
        },
        relationships: [
          {
            relationship_id: `rel_${payload.currentPanelId}_01`,
            source_panel_id: payload.previousPanelId || payload.currentPanelId,
            target_panel_id: payload.currentPanelId,
            relationship_type: 'SAME_ENTITY',
            source_entity_ref: prevCharId,
            target_entity_ref: currCharId,
            entity_type: 'character',
            confidence: 0.96,
            evidence: ['Matching silver hair, dark jacket with high collar, and eye silhouette'],
            description: 'Protagonist continues action from preceding panel',
          },
        ],
        state_changes: [
          {
            change_type: 'character_posture',
            subject_ref: currCharId,
            description: 'Character transitioned from ready stance into completed striking recoil',
            confidence: 0.90,
          },
        ],
        summary: 'Seamless continuous action sequence tracking protagonist through strike execution and impact.',
        confidence: 0.93,
      };
    }

    const provenance: AnalysisSource = {
      provider: this.providerId,
      model: this.modelId,
      model_version: '1.0.0',
      prompt_version: this.continuityPromptVersion,
      source_type: 'ai',
      analyzed_at: new Date().toISOString(),
    };

    return { raw, provenance };
  }
}
