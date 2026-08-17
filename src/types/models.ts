import { BoundingBox, Region } from './coordinates';
import { VisualAnalysis } from './visual-analysis';

/**
 * Supported reading directions for manhwa / webtoons
 */
export type ReadingDirection = 'top-to-bottom' | 'right-to-left' | 'left-to-right';

/**
 * Character role in the story
 */
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'extra' | 'unknown';

/**
 * Significance level of a story event
 */
export type EventSignificance = 'critical' | 'major' | 'minor';

/**
 * Story pacing rhythm
 */
export type StoryPacing = 'slow' | 'moderate' | 'fast' | 'dynamic';

/**
 * Analysis pipeline stages
 */
export type AnalysisStage =
  | 'idle'
  | 'importing'
  | 'detecting_panels'
  | 'visual_analysis'
  | 'ocr'
  | 'story_analysis'
  | 'camera_analysis'
  | 'completed'
  | 'error';

/**
 * Metadata for a Project
 */
export interface ProjectMetadata {
  id: string;
  title: string;
  series_name?: string;
  chapter_number?: number;
  author?: string;
  description?: string;
  reading_direction?: ReadingDirection;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Configuration and preferences for a Project
 */
export interface ProjectSettings {
  target_aspect_ratio?: string;
  reading_direction?: ReadingDirection;
  export_target_fps?: number;
  auto_save_interval_ms?: number;
  auto_generate_proxies?: boolean;
  max_proxy_dimension?: number;
  theme?: string;
  preferred_resolution?: {
    width: number;
    height: number;
  };
}

/**
 * Critical Image Identity Rule:
 * The application must NEVER depend on renaming an imported image.
 * The original_filename is metadata and must never be overwritten by an internal panel ID.
 */
export interface SourceImage {
  /** Stable unique internal identifier (e.g. img_01J...) */
  image_id: string;
  /** Original filename as imported by the user (preserved verbatim) */
  original_filename: string;
  /** MIME type (e.g. image/webp, image/png, image/jpeg) */
  mime_type: string;
  /** Natural pixel width of the source image */
  width: number;
  /** Natural pixel height of the source image */
  height: number;
  /** File size in bytes */
  file_size: number;
  /** Alias for file_size */
  byte_size?: number;
  /** Source sequence index in the manhwa scroll */
  source_order: number;
  /** Timestamp when the image record was created */
  created_at: string;
}

/**
 * Extension point for future visual analysis engines
 */
export interface VisualAnalysisExtension {
  version: string;
  detected_elements?: Region[];
  dominant_colors?: string[];
  lighting_mood?: string;
  composition_type?: string;
  shot_scale?: 'close-up' | 'medium' | 'long-shot' | 'extreme-long-shot' | 'macro' | 'overhead';
  raw_metadata?: Record<string, unknown>;
}

/**
 * Extension point for future OCR / speech bubble extraction
 */
export interface OCRExtension {
  version: string;
  bubbles?: Array<{
    id: string;
    text: string;
    normalized_box: BoundingBox;
    bubble_type?: 'dialogue' | 'thought' | 'narration' | 'sfx' | 'whisper' | 'shout';
    speaker_character_id?: string;
    confidence?: number;
  }>;
  raw_text?: string;
}

/**
 * Extension point for future camera intelligence
 */
export interface CameraAnalysisExtension {
  version: string;
  suggested_motion?: 'pan_down' | 'pan_up' | 'zoom_in' | 'zoom_out' | 'static' | 'dolly_zoom' | 'tracking';
  focus_region?: BoundingBox;
  duration_seconds?: number;
  transition_type?: string;
}

/**
 * Extension point for manual user corrections / overrides
 */
export interface ManualCorrectionsExtension {
  boundary_override?: BoundingBox;
  narration_override?: string;
  camera_override?: Record<string, unknown>;
  is_flagged?: boolean;
  notes?: string;
}

/**
 * Panel representation within a manhwa source image
 */
export interface Panel {
  /** Stable unique internal identifier (e.g. pnl_01J...) */
  id: string;
  /** Stable alias identifier (matching Section 25) */
  panel_id?: string;
  /** Stable reference to the parent SourceImage */
  image_id: string;
  /** Zero-based panel index within the specific image */
  panel_index?: number;
  /** Global sequence order across the entire project scroll */
  order: number;
  /** Preserved initial sequence order upon import (0-based) for Reset to Import Order */
  initial_order?: number;
  /** Normalized boundary box within the SourceImage (0.0 to 1.0) */
  boundary?: BoundingBox;
  /** Optional confidence score from panel detector */
  confidence?: number;
  /** IDs of characters detected or present in this panel */
  character_ids?: string[];
  /** Canonical visual analysis data (Part 2.1) */
  visual_analysis?: VisualAnalysis;
  /** Optional future OCR data */
  ocr?: OCRExtension;
  /** Optional future camera motion data */
  camera_analysis?: CameraAnalysisExtension;
  /** Optional future manual user corrections */
  manual_corrections?: ManualCorrectionsExtension;
  /** Timestamp when panel was identified */
  created_at?: string;
  /** Timestamp when panel was last modified */
  updated_at?: string;
}

/**
 * Character entity in the story
 */
export interface Character {
  id: string;
  name: string;
  canonical_name: string;
  aliases: string[];
  role: CharacterRole;
  visual_traits?: string[];
  color_theme?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Scene grouping of consecutive panels
 */
export interface Scene {
  id: string;
  title: string;
  scene_index: number;
  panel_ids: string[];
  location?: string;
  time_of_day?: string;
  mood?: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Narrative event occurring within the manhwa
 */
export interface StoryEvent {
  id: string;
  title: string;
  event_index: number;
  scene_id?: string;
  panel_ids: string[];
  summary?: string;
  significance: EventSignificance;
  created_at: string;
  updated_at: string;
}

/**
 * Overall narrative and thematic structure
 */
export interface StoryMap {
  id: string;
  summary?: string;
  themes?: string[];
  pacing?: StoryPacing;
  act_structure?: Array<{
    act_number: number;
    title: string;
    scene_ids: string[];
  }>;
  updated_at: string;
}

/**
 * Status tracking for multi-step AI analysis pipeline
 */
export interface AnalysisStatus {
  stage: AnalysisStage;
  progress: number; // 0 to 100
  last_analyzed_at?: string;
  error_message?: string;
  completed_stages: string[];
}

/**
 * Canonical Project Model (Version 1.0.0)
 * 
 * Root container for all manhwa analysis data, structured story,
 * and camera workflow definitions.
 */
export interface Project {
  /** Stable unique identifier */
  id: string;
  /** Schema version for migration tracking (e.g. '1.0.0') */
  schemaVersion: string;
  /** Project metadata */
  metadata: ProjectMetadata;
  /** Project configuration settings */
  settings: ProjectSettings;
  /** Source images preserving original filenames and dimensions */
  images: SourceImage[];
  /** Detected and structured panels */
  panels: Panel[];
  /** Character roster */
  characters: Character[];
  /** Structured scenes */
  scenes: Scene[];
  /** Story event log */
  events: StoryEvent[];
  /** High-level narrative story map */
  storyMap: StoryMap;
  /** Current state of analysis pipeline */
  analysisStatus: AnalysisStatus;
}
