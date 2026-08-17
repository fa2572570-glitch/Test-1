import { z } from 'zod';
import { BoundingBoxSchema, RegionSchema } from './coordinates.schema';
import { VisualAnalysisSchema } from './visual-analysis.schema';

export const ReadingDirectionSchema = z.enum(['top-to-bottom', 'right-to-left', 'left-to-right']);
export const CharacterRoleSchema = z.enum(['protagonist', 'antagonist', 'supporting', 'extra', 'unknown']);
export const EventSignificanceSchema = z.enum(['critical', 'major', 'minor']);
export const StoryPacingSchema = z.enum(['slow', 'moderate', 'fast', 'dynamic']);
export const AnalysisStageSchema = z.enum([
  'idle',
  'importing',
  'detecting_panels',
  'visual_analysis',
  'ocr',
  'story_analysis',
  'camera_analysis',
  'completed',
  'error',
]);

export const ProjectMetadataSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Project title cannot be empty'),
  series_name: z.string().optional(),
  chapter_number: z.number().int().nonnegative().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().datetime({ message: 'Invalid created_at ISO string' }),
  updated_at: z.string().datetime({ message: 'Invalid updated_at ISO string' }),
});

export const ProjectSettingsSchema = z.object({
  target_aspect_ratio: z.string().min(1, 'Target aspect ratio is required'),
  reading_direction: ReadingDirectionSchema,
  export_target_fps: z.number().int().min(1).max(120),
  auto_save_interval_ms: z.number().int().min(1000),
  preferred_resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});

/**
 * Image Identity Schema:
 * Preserves original_filename and internal image_id separately.
 */
export const SourceImageSchema = z.object({
  image_id: z.string().min(1, 'image_id is required'),
  original_filename: z.string().min(1, 'original_filename is required'),
  mime_type: z.string().min(1, 'mime_type is required'),
  width: z.number().int().positive('width must be positive integer'),
  height: z.number().int().positive('height must be positive integer'),
  file_size: z.number().int().nonnegative('file_size must be non-negative'),
  source_order: z.number().int().nonnegative('source_order must be non-negative'),
  created_at: z.string().datetime(),
});

export const VisualAnalysisExtensionSchema = z
  .object({
    version: z.string(),
    detected_elements: z.array(RegionSchema).optional(),
    dominant_colors: z.array(z.string()).optional(),
    lighting_mood: z.string().optional(),
    composition_type: z.string().optional(),
    shot_scale: z
      .enum(['close-up', 'medium', 'long-shot', 'extreme-long-shot', 'macro', 'overhead'])
      .optional(),
    raw_metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

export const OCRExtensionSchema = z
  .object({
    version: z.string(),
    bubbles: z
      .array(
        z.object({
          id: z.string(),
          text: z.string(),
          normalized_box: BoundingBoxSchema,
          bubble_type: z.enum(['dialogue', 'thought', 'narration', 'sfx', 'whisper', 'shout']).optional(),
          speaker_character_id: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
        })
      )
      .optional(),
    raw_text: z.string().optional(),
  })
  .optional();

export const CameraAnalysisExtensionSchema = z
  .object({
    version: z.string(),
    suggested_motion: z
      .enum(['pan_down', 'pan_up', 'zoom_in', 'zoom_out', 'static', 'dolly_zoom', 'tracking'])
      .optional(),
    focus_region: BoundingBoxSchema.optional(),
    duration_seconds: z.number().positive().optional(),
    transition_type: z.string().optional(),
  })
  .optional();

export const ManualCorrectionsExtensionSchema = z
  .object({
    boundary_override: BoundingBoxSchema.optional(),
    narration_override: z.string().optional(),
    camera_override: z.record(z.string(), z.unknown()).optional(),
    is_flagged: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .optional();

export const PanelSchema = z.object({
  id: z.string().min(1, 'Panel ID is required'),
  image_id: z.string().min(1, 'Panel must reference an image_id'),
  panel_index: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  initial_order: z.number().int().nonnegative().optional(),
  boundary: BoundingBoxSchema,
  confidence: z.number().min(0).max(1).optional(),
  character_ids: z.array(z.string()).optional(),
  visual_analysis: z.union([VisualAnalysisSchema, VisualAnalysisExtensionSchema]).optional(),
  ocr: OCRExtensionSchema,
  camera_analysis: CameraAnalysisExtensionSchema,
  manual_corrections: ManualCorrectionsExtensionSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CharacterSchema = z.object({
  id: z.string().min(1, 'Character ID is required'),
  name: z.string().min(1, 'Character name is required'),
  canonical_name: z.string().min(1, 'Canonical name is required'),
  aliases: z.array(z.string()),
  role: CharacterRoleSchema,
  visual_traits: z.array(z.string()).optional(),
  color_theme: z.string().optional(),
  description: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const SceneSchema = z.object({
  id: z.string().min(1, 'Scene ID is required'),
  title: z.string().min(1, 'Scene title is required'),
  scene_index: z.number().int().nonnegative(),
  panel_ids: z.array(z.string()),
  location: z.string().optional(),
  time_of_day: z.string().optional(),
  mood: z.string().optional(),
  summary: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const StoryEventSchema = z.object({
  id: z.string().min(1, 'Event ID is required'),
  title: z.string().min(1, 'Event title is required'),
  event_index: z.number().int().nonnegative(),
  scene_id: z.string().optional(),
  panel_ids: z.array(z.string()),
  summary: z.string().optional(),
  significance: EventSignificanceSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const StoryMapSchema = z.object({
  id: z.string().min(1, 'StoryMap ID is required'),
  summary: z.string().optional(),
  themes: z.array(z.string()).optional(),
  pacing: StoryPacingSchema.optional(),
  act_structure: z
    .array(
      z.object({
        act_number: z.number().int().positive(),
        title: z.string(),
        scene_ids: z.array(z.string()),
      })
    )
    .optional(),
  updated_at: z.string().datetime(),
});

export const AnalysisStatusSchema = z.object({
  stage: AnalysisStageSchema,
  progress: z.number().min(0).max(100),
  last_analyzed_at: z.string().datetime().optional(),
  error_message: z.string().optional(),
  completed_stages: z.array(z.string()),
});

/**
 * Root Canonical Project Schema (v1.0.0)
 */
export const ProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  schemaVersion: z.string().regex(/^1\.\d+\.\d+$/, 'Project must have a 1.x.x schema version'),
  metadata: ProjectMetadataSchema,
  settings: ProjectSettingsSchema,
  images: z.array(SourceImageSchema),
  panels: z.array(PanelSchema),
  characters: z.array(CharacterSchema),
  scenes: z.array(SceneSchema),
  events: z.array(StoryEventSchema),
  storyMap: StoryMapSchema,
  analysisStatus: AnalysisStatusSchema,
});
