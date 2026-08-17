import { z } from 'zod';
import { BoundingBoxSchema, NormalizedNumberSchema } from './coordinates.schema';

/**
 * Normalized confidence validation between 0.0 and 1.0
 */
export const ConfidenceNumberSchema = z
  .number({ message: 'Confidence must be a valid number' })
  .min(0, { message: 'Confidence cannot be less than 0.0' })
  .max(1, { message: 'Confidence cannot be greater than 1.0' });

/**
 * Visual analysis lifecycle status enum schema
 */
export const VisualAnalysisStatusSchema = z.enum([
  'NOT_ANALYZED',
  'QUEUED',
  'ANALYZING',
  'COMPLETED',
  'FAILED',
  'STALE',
]);

/**
 * Analysis provenance and origin source schema
 */
export const AnalysisSourceTypeSchema = z.enum(['ai', 'ocr', 'vision', 'manual', 'derived']);

export const AnalysisSourceSchema = z.object({
  provider: z.string().min(1, 'Provider identifier is required'),
  model: z.string().optional(),
  model_version: z.string().optional(),
  prompt_version: z.string().optional(),
  source_type: AnalysisSourceTypeSchema.optional(),
  analyzed_at: z.string().datetime({ message: 'Invalid analyzed_at ISO datetime' }),
});

/**
 * Image preprocessing and proxy metadata schema (Part 2.2)
 */
export const PreprocessingInfoSchema = z.object({
  source_width: z.number().int().positive('source_width must be a positive integer'),
  source_height: z.number().int().positive('source_height must be a positive integer'),
  analysis_width: z.number().int().positive('analysis_width must be a positive integer'),
  analysis_height: z.number().int().positive('analysis_height must be a positive integer'),
  scale: z.number().positive('scale must be a positive number'),
  format: z.string().min(1, 'format is required'),
  preprocessing_version: z.string().optional(),
  max_dimension: z.number().int().positive().optional(),
  quality: z.number().min(0).max(1).optional(),
  source_byte_size: z.number().int().nonnegative().optional(),
  proxy_byte_size: z.number().int().nonnegative().optional(),
  cache_key: z.string().optional(),
  generation_duration_ms: z.number().nonnegative().optional(),
  generated_at: z.string().datetime({ message: 'Invalid generated_at ISO datetime' }),
});

/**
 * Composition analysis schema (Part 2.3)
 */
export const ShotScaleSchema = z.enum([
  'extreme-close-up',
  'close-up',
  'medium-close-up',
  'medium',
  'medium-wide',
  'wide',
  'long-shot',
  'extreme-long-shot',
  'macro',
  'overhead',
  'full',
  'unknown',
]);

export const CompositionFramingSchema = z.enum([
  'wide',
  'tight',
  'dynamic',
  'panoramic',
  'isolated',
  'rule_of_thirds',
  'centered',
  'left-weighted',
  'right-weighted',
  'top-weighted',
  'bottom-weighted',
  'symmetrical',
  'asymmetrical',
  'diagonal',
  'layered',
  'unknown',
]);

export const VisualDensitySchema = z.enum([
  'sparse',
  'balanced',
  'dense',
  'cluttered',
  'very_dense',
]);

export const DominantOrientationSchema = z.enum([
  'vertical',
  'horizontal',
  'diagonal',
  'radial',
  'centered',
  'mixed',
]);

export const NegativeSpaceLevelSchema = z.enum(['none', 'low', 'moderate', 'high']);

export const TonalRangeSchema = z.enum([
  'bright',
  'dark',
  'high_contrast',
  'low_contrast',
  'balanced',
  'monochrome',
]);

export const DominantRegionSchema = z.object({
  region_id: z.string().optional(),
  label: z.string().min(1, 'label is required'),
  box: BoundingBoxSchema,
  prominence: z.enum(['primary', 'secondary', 'supporting']).optional(),
  weight: ConfidenceNumberSchema.optional(),
});

export const CompositionAnalysisSchema = z.object({
  shot_scale: ShotScaleSchema.optional(),
  framing: CompositionFramingSchema.optional(),
  foreground_importance: ConfidenceNumberSchema.optional(),
  middleground_importance: ConfidenceNumberSchema.optional(),
  background_importance: ConfidenceNumberSchema.optional(),
  visual_density: VisualDensitySchema.optional(),
  dominant_orientation: DominantOrientationSchema.optional(),
  visual_hierarchy: z.array(z.string()).optional(),
  dominant_regions: z.array(DominantRegionSchema).optional(),
  negative_space: NegativeSpaceLevelSchema.optional(),
  dominant_colors: z.array(z.string()).optional(),
  lighting_mood: z.string().optional(),
  tonal_range: TonalRangeSchema.optional(),
  summary: z.string().max(500, 'Summary must be at most 500 characters').optional(),
  confidence: ConfidenceNumberSchema.optional(),
  source: AnalysisSourceSchema.optional(),
});

/**
 * Raw schema for AI response parsing & normalization
 */
export const AICompositionResponseSchema = z.object({
  shot_scale: z.string().optional(),
  framing: z.string().optional(),
  foreground_importance: z.number().min(0).max(1).optional(),
  middleground_importance: z.number().min(0).max(1).optional(),
  background_importance: z.number().min(0).max(1).optional(),
  visual_density: z.string().optional(),
  dominant_orientation: z.string().optional(),
  visual_hierarchy: z.array(z.string()).optional(),
  dominant_regions: z
    .array(
      z.object({
        label: z.string(),
        box: z.object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          width: z.number().min(0).max(1),
          height: z.number().min(0).max(1),
        }),
        prominence: z.enum(['primary', 'secondary', 'supporting']).optional(),
        weight: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
  negative_space: z.string().optional(),
  dominant_colors: z.array(z.string()).optional(),
  lighting_mood: z.string().optional(),
  tonal_range: z.string().optional(),
  summary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Subject detection schema (Foundation for Part 2.4)
 */
export const SubjectTypeSchema = z.enum([
  'character',
  'face',
  'creature',
  'object',
  'weapon',
  'vehicle',
  'environment',
  'effect',
  'other',
]);

export const SubjectVisibilitySchema = z.enum([
  'fully_visible',
  'partially_visible',
  'occluded',
  'silhouette',
  'cropped',
]);

export const SubjectImportanceSchema = z.enum([
  'primary',
  'secondary',
  'background',
  'incidental',
]);

export const SubjectSchema = z.object({
  subject_id: z.string().min(1, 'subject_id is required'),
  type: SubjectTypeSchema,
  label: z.string().min(1, 'label is required'),
  bounding_box: BoundingBoxSchema,
  visibility: SubjectVisibilitySchema.optional(),
  importance: SubjectImportanceSchema.optional(),
  confidence: ConfidenceNumberSchema,
  source: AnalysisSourceTypeSchema.optional(),
});

/**
 * Character detection schema (Foundation for Part 2.4)
 */
export const CharacterVisibilitySchema = z.enum([
  'full_body',
  'upper_body',
  'bust',
  'face_only',
  'partial',
  'obscured',
]);

export const CharacterScreenPositionSchema = z.enum([
  'left',
  'center',
  'right',
  'top',
  'bottom',
  'background',
]);

export const CharacterDetectionSchema = z.object({
  detection_id: z.string().min(1, 'detection_id is required'),
  character_id: z.string().optional(),
  label: z.string().optional(),
  bounding_box: BoundingBoxSchema,
  face_region: BoundingBoxSchema.optional(),
  visibility: CharacterVisibilitySchema.optional(),
  pose: z.string().optional(),
  expression: z.string().optional(),
  action: z.string().optional(),
  screen_position: CharacterScreenPositionSchema.optional(),
  confidence: ConfidenceNumberSchema,
  continuity_reference: z.string().optional(),
});

/**
 * Raw schema for AI subject & character detection response parsing & normalization
 */
export const AISubjectDetectionResponseSchema = z.object({
  subjects: z
    .array(
      z.object({
        type: z.string().optional(),
        label: z.string().optional(),
        bounding_box: z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            width: z.number().min(0).max(1),
            height: z.number().min(0).max(1),
          })
          .optional(),
        visibility: z.string().optional(),
        importance: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
  characters: z
    .array(
      z.object({
        label: z.string().optional(),
        bounding_box: z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            width: z.number().min(0).max(1),
            height: z.number().min(0).max(1),
          })
          .optional(),
        face_region: z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            width: z.number().min(0).max(1),
            height: z.number().min(0).max(1),
          })
          .optional(),
        visibility: z.string().optional(),
        pose: z.string().optional(),
        expression: z.string().optional(),
        action: z.string().optional(),
        screen_position: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
});

/**
 * Text and dialogue element schema (Foundation for Part 2.5)
 */
export const TextElementTypeSchema = z.enum([
  'dialogue',
  'narration',
  'thought',
  'sfx',
  'sign',
  'system_ui',
  'whisper',
  'shout',
  'unknown',
]);

export const TextElementSchema = z.object({
  text_id: z.string().min(1, 'text_id is required'),
  type: TextElementTypeSchema,
  content: z.string(),
  bounding_box: BoundingBoxSchema,
  reading_order: z.number().int().nonnegative().optional(),
  speaker_reference: z.string().optional(),
  confidence: ConfidenceNumberSchema,
  ocr_confidence: ConfidenceNumberSchema.optional(),
  source: AnalysisSourceTypeSchema.optional(),
});

/**
 * Raw schema for AI text & speech-bubble detection response parsing & normalization
 */
export const AITextAnalysisResponseSchema = z.object({
  text_elements: z
    .array(
      z.object({
        type: z.string().optional(),
        content: z.string().optional(),
        text: z.string().optional(), // In case AI returns 'text' instead of 'content'
        bounding_box: z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            width: z.number().min(0).max(1),
            height: z.number().min(0).max(1),
          })
          .optional(),
        reading_order: z.number().optional(),
        speaker_reference: z.string().optional().nullable(),
        confidence: z.number().min(0).max(1).optional(),
        ocr_confidence: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
});

/**
 * Scene context schema (Foundation for Part 2.6)
 */
export const SceneContextSchema = z.object({
  location: z.string().optional(),
  environment: z.string().optional(),
  indoor_outdoor: z.enum(['indoor', 'outdoor', 'unclear', 'abstract']).optional(),
  time_context: z.enum(['day', 'night', 'sunset', 'dawn', 'dusk', 'timeless']).optional(),
  weather: z.string().optional(),
  lighting: z.string().optional(),
  atmosphere: z.string().optional(),
  confidence: ConfidenceNumberSchema.optional(),
});

/**
 * Action observation schema (Foundation for Part 2.6)
 */
export const ActionIntensitySchema = z.enum(['subtle', 'moderate', 'high', 'explosive']);

export const ActionObservationSchema = z.object({
  action_id: z.string().min(1, 'action_id is required'),
  type: z.string().min(1, 'Action type is required'),
  description: z.string().optional(),
  actor_subject_id: z.string().optional(),
  target_subject_id: z.string().optional(),
  intensity: ActionIntensitySchema.optional(),
  direction: z.string().optional(),
  temporal_context: z.string().optional(),
  confidence: ConfidenceNumberSchema,
});

/**
 * Raw schema for AI scene & action detection response parsing & normalization
 */
export const AISceneAndActionAnalysisResponseSchema = z.object({
  scene: z
    .object({
      location: z.string().optional(),
      environment: z.string().optional(),
      environment_type: z.string().optional(),
      setting: z.string().optional(),
      indoor_outdoor: z.string().optional(),
      time_context: z.string().optional(),
      time_of_day: z.string().optional(),
      weather: z.string().optional(),
      lighting: z.string().optional(),
      atmosphere: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
  scene_context: z
    .object({
      location: z.string().optional(),
      environment: z.string().optional(),
      environment_type: z.string().optional(),
      setting: z.string().optional(),
      indoor_outdoor: z.string().optional(),
      time_context: z.string().optional(),
      time_of_day: z.string().optional(),
      weather: z.string().optional(),
      lighting: z.string().optional(),
      atmosphere: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
  actions: z
    .array(
      z.object({
        action_id: z.string().optional(),
        type: z.string().optional(),
        action_type: z.string().optional(),
        action: z.string().optional(),
        description: z.string().optional(),
        actor_subject_id: z.string().optional().nullable(),
        actor_ref: z.string().optional().nullable(),
        actor: z.string().optional().nullable(),
        target_subject_id: z.string().optional().nullable(),
        target_ref: z.string().optional().nullable(),
        target: z.string().optional().nullable(),
        intensity: z.string().optional(),
        direction: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
        temporal_context: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .optional(),
  action: z.array(z.any()).optional(),
});

/**
 * Visual focus schema (Foundation for Part 2.7)
 */
export const FocusTargetTypeSchema = z.enum([
  'character',
  'face',
  'object',
  'action_area',
  'text',
  'environment',
]);

export const VisualFocusTargetSchema = z.object({
  type: FocusTargetTypeSchema,
  subject_id: z.string().optional(),
  region: BoundingBoxSchema.optional(),
  description: z.string().optional(),
});

export const VisualFocusSchema = z.object({
  primary_target: VisualFocusTargetSchema.optional(),
  secondary_targets: z.array(VisualFocusTargetSchema).optional(),
  focus_region: BoundingBoxSchema,
  importance: ConfidenceNumberSchema.optional(),
  confidence: ConfidenceNumberSchema,
  reason: z.string().optional(),
});

/**
 * Camera region and analysis foundation schema (Foundation for Part 2.7)
 */
export const CameraTargetTypeSchema = z.enum([
  'character',
  'focal_point',
  'full_action',
  'establishing',
  'text_safe',
]);

export const CameraRegionSchema = z.object({
  region_id: z.string().min(1, 'region_id is required'),
  region: BoundingBoxSchema,
  safe_margin: ConfidenceNumberSchema.optional(),
  target_type: CameraTargetTypeSchema,
  importance: ConfidenceNumberSchema,
  confidence: ConfidenceNumberSchema,
});

export const CameraAnalysisSchema = z.object({
  recommended_target: BoundingBoxSchema.optional(),
  safe_regions: z.array(CameraRegionSchema).optional(),
  shot_type: z.string().optional(),
  zoom_potential: z.enum(['low', 'medium', 'high']).optional(),
  pan_potential: z.enum(['static', 'vertical_down', 'vertical_up', 'horizontal', 'diagonal']).optional(),
  suggested_motion: z.string().optional(),
  duration_seconds: z.number().positive().optional(),
  constraints: z.array(z.string()).optional(),
  confidence: ConfidenceNumberSchema.optional(),
});

/**
 * Raw schema for AI Visual Focus & Salience response parsing and validation
 */
export const AIVisualFocusResponseSchema = z.object({
  visual_focus: z
    .object({
      primary_target: z
        .object({
          type: z.string().optional(),
          target_type: z.string().optional(),
          subject_id: z.string().optional().nullable(),
          target_ref: z.string().optional().nullable(),
          character_ref: z.string().optional().nullable(),
          region: BoundingBoxSchema.optional(),
          bounding_box: BoundingBoxSchema.optional(),
          description: z.string().optional(),
          reason: z.string().optional(),
        })
        .optional(),
      primary: z
        .object({
          type: z.string().optional(),
          target_type: z.string().optional(),
          subject_id: z.string().optional().nullable(),
          target_ref: z.string().optional().nullable(),
          character_ref: z.string().optional().nullable(),
          region: BoundingBoxSchema.optional(),
          bounding_box: BoundingBoxSchema.optional(),
          description: z.string().optional(),
          reason: z.string().optional(),
        })
        .optional(),
      secondary_targets: z
        .array(
          z.object({
            type: z.string().optional(),
            target_type: z.string().optional(),
            subject_id: z.string().optional().nullable(),
            target_ref: z.string().optional().nullable(),
            character_ref: z.string().optional().nullable(),
            region: BoundingBoxSchema.optional(),
            bounding_box: BoundingBoxSchema.optional(),
            description: z.string().optional(),
            importance: z.union([z.number(), z.string()]).optional(),
            salience: z.number().optional(),
          })
        )
        .optional(),
      secondary: z
        .array(
          z.object({
            type: z.string().optional(),
            target_type: z.string().optional(),
            subject_id: z.string().optional().nullable(),
            target_ref: z.string().optional().nullable(),
            character_ref: z.string().optional().nullable(),
            region: BoundingBoxSchema.optional(),
            bounding_box: BoundingBoxSchema.optional(),
            description: z.string().optional(),
            importance: z.union([z.number(), z.string()]).optional(),
            salience: z.number().optional(),
          })
        )
        .optional(),
      focus_region: BoundingBoxSchema.optional(),
      region: BoundingBoxSchema.optional(),
      importance: z.union([z.number(), z.string()]).optional(),
      salience: z.number().optional(),
      confidence: z.number().min(0).max(1).optional(),
      reason: z.string().optional(),
    })
    .optional(),
  camera_analysis: z
    .object({
      recommended_target: BoundingBoxSchema.optional(),
      safe_regions: z
        .array(
          z.object({
            region_id: z.string().optional(),
            region: BoundingBoxSchema.optional(),
            bounding_box: BoundingBoxSchema.optional(),
            safe_margin: z.number().optional(),
            target_type: z.string().optional(),
            importance: z.union([z.number(), z.string()]).optional(),
            confidence: z.number().optional(),
          })
        )
        .optional(),
      shot_type: z.string().optional(),
      zoom_potential: z.string().optional(),
      pan_potential: z.string().optional(),
      suggested_motion: z.string().optional(),
      duration_seconds: z.number().optional(),
      constraints: z.array(z.string()).optional(),
      confidence: z.number().optional(),
    })
    .optional(),
});

/**
 * Continuity schemas (Part 2.8)
 */
export const CrossPanelRelationshipTypeSchema = z.enum([
  'SAME_ENTITY',
  'POSSIBLE_SAME_ENTITY',
  'DIFFERENT_ENTITY',
  'CONTINUES',
  'APPEARS',
  'DISAPPEARS',
  'ACTION_CONTINUES',
  'ACTION_RESULT',
  'ACTION_TRANSITION',
  'NEW_ACTION',
  'NO_CONTINUITY',
  'SCENE_CONTINUES',
  'SCENE_CHANGES',
  'OBJECT_CONTINUES',
  'SAME_OBJECT',
  'OBJECT_DISAPPEARS',
  'OBJECT_APPEARS',
  'AMBIGUOUS_OBJECT',
  'TEXT_CONTINUES',
  'TEXT_DISAPPEARS',
  'NEW_TEXT_APPEARS',
  'SFX_CONTINUES',
  'VISUAL_STATE_CHANGES',
  'FOCUS_CONTINUES',
  'FOCUS_SHIFT',
  'POSITION_CHANGED',
  'POSITION_STABLE',
  'CONTINUOUS_SCENE',
  'CONTINUOUS_ACTION',
  'NEW_SHOT_SAME_SCENE',
  'UNKNOWN',
]);

export const EntityContinuityTypeSchema = z.enum([
  'SAME_ENTITY',
  'POSSIBLE_SAME_ENTITY',
  'DIFFERENT_ENTITY',
  'AMBIGUOUS',
  'UNKNOWN',
]);

export const ObjectContinuityTypeSchema = z.enum([
  'SAME_OBJECT',
  'OBJECT_DISAPPEARS',
  'OBJECT_APPEARS',
  'AMBIGUOUS_OBJECT',
  'UNKNOWN',
]);

export const ActionContinuityTypeSchema = z.enum([
  'ACTION_CONTINUES',
  'ACTION_RESULT',
  'ACTION_TRANSITION',
  'NEW_ACTION',
  'NO_CONTINUITY',
  'UNKNOWN',
]);

export const SceneContinuityTypeSchema = z.enum([
  'SCENE_CONTINUES',
  'SCENE_CHANGES',
  'UNKNOWN',
]);

export const FocusContinuityTypeSchema = z.enum([
  'FOCUS_CONTINUES',
  'FOCUS_SHIFT',
  'UNKNOWN',
]);

export const SpatialContinuityTypeSchema = z.enum([
  'POSITION_STABLE',
  'POSITION_CHANGED',
  'UNKNOWN',
]);

export const TextContinuityTypeSchema = z.enum([
  'TEXT_CONTINUES',
  'TEXT_DISAPPEARS',
  'NEW_TEXT_APPEARS',
  'SFX_CONTINUES',
  'UNKNOWN',
]);

export const PanelTransitionTypeSchema = z.enum([
  'CONTINUOUS_SCENE',
  'CONTINUOUS_ACTION',
  'NEW_SHOT_SAME_SCENE',
  'SCENE_CHANGE',
  'UNKNOWN',
]);

export const CrossPanelRelationshipSchema = z.object({
  relationship_id: z.string().min(1, 'relationship_id is required'),
  source_panel_id: z.string().min(1, 'source_panel_id is required'),
  target_panel_id: z.string().min(1, 'target_panel_id is required'),
  relationship_type: CrossPanelRelationshipTypeSchema,
  source_entity_ref: z.string().nullable().optional(),
  target_entity_ref: z.string().nullable().optional(),
  entity_type: z
    .enum(['character', 'subject', 'object', 'action', 'text', 'focus', 'scene', 'panel'])
    .optional(),
  confidence: ConfidenceNumberSchema,
  evidence: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const VisualStateChangeSchema = z.object({
  change_type: z.enum([
    'character_posture',
    'expression',
    'object_state',
    'appearance',
    'disappearance',
    'obscuration',
    'lighting',
    'action_state',
    'focus_shift',
    'environment',
    'other',
  ]),
  subject_ref: z.string().nullable().optional(),
  description: z.string().min(1, 'description is required'),
  confidence: ConfidenceNumberSchema,
});

export const TransitionTypeSchema = PanelTransitionTypeSchema;

export const ContinuityAnalysisSchema = z.object({
  previous_panel_id: z.string().nullable().optional(),
  next_panel_id: z.string().nullable().optional(),
  transition_type: PanelTransitionTypeSchema.optional(),
  scene_continuity: z
    .object({
      status: SceneContinuityTypeSchema,
      confidence: ConfidenceNumberSchema,
      evidence: z.array(z.string()).optional(),
    })
    .optional(),
  action_continuity: z
    .object({
      status: ActionContinuityTypeSchema,
      confidence: ConfidenceNumberSchema,
      source_action_id: z.string().nullable().optional(),
      target_action_id: z.string().nullable().optional(),
      evidence: z.array(z.string()).optional(),
    })
    .optional(),
  focus_continuity: z
    .object({
      status: FocusContinuityTypeSchema,
      confidence: ConfidenceNumberSchema,
      shift_description: z.string().optional(),
    })
    .optional(),
  relationships: z.array(CrossPanelRelationshipSchema),
  state_changes: z.array(VisualStateChangeSchema).optional(),
  summary: z.string().optional(),
  confidence: ConfidenceNumberSchema.optional(),
  source: AnalysisSourceSchema.optional(),
});

/**
 * Defensive AI response parsing schema for Cross-Panel Continuity
 */
export const AICrossPanelContinuityResponseSchema = z.object({
  transition_type: z.string().optional(),
  panel_transition: z.string().optional(),
  scene_continuity: z
    .object({
      status: z.string().optional(),
      continuity: z.string().optional(),
      confidence: z.union([z.number(), z.string()]).optional(),
      evidence: z.union([z.array(z.string()), z.string()]).optional(),
    })
    .optional(),
  action_continuity: z
    .object({
      status: z.string().optional(),
      continuity: z.string().optional(),
      confidence: z.union([z.number(), z.string()]).optional(),
      source_action_id: z.string().nullable().optional(),
      target_action_id: z.string().nullable().optional(),
      evidence: z.union([z.array(z.string()), z.string()]).optional(),
    })
    .optional(),
  focus_continuity: z
    .object({
      status: z.string().optional(),
      continuity: z.string().optional(),
      confidence: z.union([z.number(), z.string()]).optional(),
      shift_description: z.string().optional(),
      reason: z.string().optional(),
    })
    .optional(),
  relationships: z
    .array(
      z.object({
        relationship_id: z.string().optional(),
        id: z.string().optional(),
        source_panel_id: z.string().optional(),
        target_panel_id: z.string().optional(),
        relationship_type: z.string().optional(),
        relationship: z.string().optional(),
        type: z.string().optional(),
        source_entity_ref: z.string().nullable().optional(),
        source_ref: z.string().nullable().optional(),
        source_id: z.string().nullable().optional(),
        target_entity_ref: z.string().nullable().optional(),
        target_ref: z.string().nullable().optional(),
        target_id: z.string().nullable().optional(),
        entity_type: z.string().optional(),
        confidence: z.union([z.number(), z.string()]).optional(),
        evidence: z.union([z.array(z.string()), z.string()]).optional(),
        description: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .optional(),
  panel_relationships: z
    .array(
      z.object({
        relationship_id: z.string().optional(),
        id: z.string().optional(),
        source_panel_id: z.string().optional(),
        target_panel_id: z.string().optional(),
        relationship_type: z.string().optional(),
        relationship: z.string().optional(),
        type: z.string().optional(),
        source_entity_ref: z.string().nullable().optional(),
        source_ref: z.string().nullable().optional(),
        source_id: z.string().nullable().optional(),
        target_entity_ref: z.string().nullable().optional(),
        target_ref: z.string().nullable().optional(),
        target_id: z.string().nullable().optional(),
        entity_type: z.string().optional(),
        confidence: z.union([z.number(), z.string()]).optional(),
        evidence: z.union([z.array(z.string()), z.string()]).optional(),
        description: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .optional(),
  state_changes: z
    .array(
      z.object({
        change_type: z.string().optional(),
        type: z.string().optional(),
        subject_ref: z.string().nullable().optional(),
        entity_ref: z.string().nullable().optional(),
        description: z.string().optional(),
        change: z.string().optional(),
        confidence: z.union([z.number(), z.string()]).optional(),
      })
    )
    .optional(),
  visual_state_changes: z
    .array(
      z.object({
        change_type: z.string().optional(),
        type: z.string().optional(),
        subject_ref: z.string().nullable().optional(),
        entity_ref: z.string().nullable().optional(),
        description: z.string().optional(),
        change: z.string().optional(),
        confidence: z.union([z.number(), z.string()]).optional(),
      })
    )
    .optional(),
  summary: z.string().optional(),
  confidence: z.union([z.number(), z.string()]).optional(),
});

export const AIContinuityResponseSchema = AICrossPanelContinuityResponseSchema;

/**
 * Structured analysis error schema
 */
export const AnalysisErrorSchema = z.object({
  code: z.string().min(1, 'Error code is required'),
  stage: z.string().min(1, 'Error stage is required'),
  message: z.string().min(1, 'Error message is required'),
  retryable: z.boolean(),
  occurred_at: z.string().datetime({ message: 'Invalid occurred_at ISO datetime' }),
});

/**
 * Manual user corrections schema (Foundation for Part 2.9)
 */
export const VisualAnalysisCorrectionsSchema = z.object({
  focus_region_override: BoundingBoxSchema.optional(),
  shot_scale_override: ShotScaleSchema.optional(),
  scene_location_override: z.string().optional(),
  is_flagged: z.boolean().optional(),
  manual_notes: z.string().optional(),
  corrected_at: z.string().datetime().optional(),
});

/**
 * Granular stage completion tracking schema
 */
export const StageAnalysisStatusSchema = z.object({
  preprocessing: VisualAnalysisStatusSchema.optional(),
  composition: VisualAnalysisStatusSchema.optional(),
  subjects: VisualAnalysisStatusSchema.optional(),
  characters: VisualAnalysisStatusSchema.optional(),
  text: VisualAnalysisStatusSchema.optional(),
  scene: VisualAnalysisStatusSchema.optional(),
  action: VisualAnalysisStatusSchema.optional(),
  focus: VisualAnalysisStatusSchema.optional(),
  camera: VisualAnalysisStatusSchema.optional(),
  continuity: VisualAnalysisStatusSchema.optional(),
});

/**
 * Canonical Root Visual Analysis Schema (Part 2.1)
 */
export const VisualAnalysisSchema = z.object({
  analysis_version: z.string().min(1, 'analysis_version is required'),
  status: VisualAnalysisStatusSchema,
  stages: StageAnalysisStatusSchema.optional(),
  source: AnalysisSourceSchema.optional(),
  preprocessing: PreprocessingInfoSchema.optional(),
  composition: CompositionAnalysisSchema.optional(),
  subjects: z.array(SubjectSchema).optional(),
  characters: z.array(CharacterDetectionSchema).optional(),
  text: z.array(TextElementSchema).optional(),
  scene: SceneContextSchema.optional(),
  action: z.array(ActionObservationSchema).optional(),
  visual_focus: VisualFocusSchema.optional(),
  camera: CameraAnalysisSchema.optional(),
  continuity: ContinuityAnalysisSchema.optional(),
  confidence: ConfidenceNumberSchema.optional(),
  error: AnalysisErrorSchema.optional(),
  manual_corrections: VisualAnalysisCorrectionsSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
