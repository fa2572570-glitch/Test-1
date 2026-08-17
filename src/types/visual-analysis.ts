/**
 * Part 2.1 — Visual Analysis Data Model & Engine Foundation
 * Canonical data structures, lifecycle statuses, and extension points
 * for all future visual-analysis stages.
 */

import { BoundingBox, Region } from './coordinates';

/**
 * Structured analysis lifecycle status for a panel or sub-stage
 */
export type VisualAnalysisStatus =
  | 'NOT_ANALYZED'
  | 'QUEUED'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'STALE';

/**
 * Origin of analysis metadata or detection evidence
 */
export type AnalysisSourceType = 'ai' | 'ocr' | 'vision' | 'manual' | 'derived';

/**
 * Model describing how an analysis result was produced
 */
export interface AnalysisSource {
  /** Provider identifier (e.g. 'gemini', 'openai', 'local', 'manual') */
  provider: string;
  /** Model family/name (e.g. 'gemini-1.5-flash', 'gemini-1.5-pro') */
  model?: string;
  /** Specific model checkpoint/version */
  model_version?: string;
  /** Version of prompt template used */
  prompt_version?: string;
  /** High-level classification of the origin */
  source_type?: AnalysisSourceType;
  /** ISO timestamp when the analysis was executed */
  analyzed_at: string;
}

/**
 * Preprocessing and proxy image metadata describing how the analyzed proxy
 * relates to the original source image (Part 2.2)
 */
export interface PreprocessingInfo {
  /** Original natural pixel width */
  source_width: number;
  /** Original natural pixel height */
  source_height: number;
  /** Pixel width sent to the analysis engine */
  analysis_width: number;
  /** Pixel height sent to the analysis engine */
  analysis_height: number;
  /** Scaling factor applied (analysis / source) */
  scale: number;
  /** Image format used for proxy (e.g. 'image/webp', 'image/jpeg', 'image/png') */
  format: string;
  /** Version identifier of the preprocessing pipeline */
  preprocessing_version?: string;
  /** Maximum analysis bounding dimension configured */
  max_dimension?: number;
  /** Compression quality setting applied (0.0 to 1.0) */
  quality?: number;
  /** Original file byte size */
  source_byte_size?: number;
  /** Derived proxy file byte size */
  proxy_byte_size?: number;
  /** Deterministic cache key derived from content hash and settings */
  cache_key?: string;
  /** Wall clock time taken to generate proxy in milliseconds */
  generation_duration_ms?: number;
  /** ISO timestamp when proxy was created */
  generated_at: string;
}

/**
 * Preprocessing configuration options
 */
export interface PreprocessingConfig {
  /** Maximum analysis dimension for the longer image side (default: 1536) */
  maxDimension?: number;
  /** Target MIME format for proxy (default: 'image/jpeg') */
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Compression quality for JPEG/WEBP (0.0 to 1.0, default: 0.85) */
  quality?: number;
  /** Whether to preserve transparency by falling back to PNG if source has alpha */
  preserveTransparency?: boolean;
}

/**
 * Composition framing classification (Part 2.3)
 */
export type ShotScale =
  | 'extreme-close-up'
  | 'close-up'
  | 'medium-close-up'
  | 'medium'
  | 'medium-wide'
  | 'wide'
  | 'long-shot'
  | 'extreme-long-shot'
  | 'macro'
  | 'overhead'
  | 'full'
  | 'unknown';

export type CompositionFraming =
  | 'wide'
  | 'tight'
  | 'dynamic'
  | 'panoramic'
  | 'isolated'
  | 'rule_of_thirds'
  | 'centered'
  | 'left-weighted'
  | 'right-weighted'
  | 'top-weighted'
  | 'bottom-weighted'
  | 'symmetrical'
  | 'asymmetrical'
  | 'diagonal'
  | 'layered'
  | 'unknown';

export type VisualDensity = 'sparse' | 'balanced' | 'dense' | 'cluttered' | 'very_dense';

export type DominantOrientation = 'vertical' | 'horizontal' | 'diagonal' | 'radial' | 'centered' | 'mixed';

export type NegativeSpaceLevel = 'none' | 'low' | 'moderate' | 'high';

export type TonalRange = 'bright' | 'dark' | 'high_contrast' | 'low_contrast' | 'balanced' | 'monochrome';

/**
 * Dominant spatial visual region within panel composition (Part 2.3)
 */
export interface DominantRegion {
  /** Optional stable identifier */
  region_id?: string;
  /** Human-readable structural label (e.g. 'primary_subject', 'focal_point', 'background_layer') */
  label: string;
  /** Normalized bounding box within the panel (0.0 to 1.0) */
  box: BoundingBox;
  /** Visual prominence ranking */
  prominence?: 'primary' | 'secondary' | 'supporting';
  /** Relative weight or visual significance (0.0 to 1.0) */
  weight?: number;
}

/**
 * Visual composition and spatial framing structure (Part 2.3)
 */
export interface CompositionAnalysis {
  /** Scale / framing classification */
  shot_scale?: ShotScale;
  /** Compositional layout framing archetype */
  framing?: CompositionFraming;
  /** Normalized importance of foreground elements (0.0 to 1.0) */
  foreground_importance?: number;
  /** Normalized importance of middle-ground elements (0.0 to 1.0) */
  middleground_importance?: number;
  /** Normalized importance of background elements (0.0 to 1.0) */
  background_importance?: number;
  /** Visual density of content in the panel */
  visual_density?: VisualDensity;
  /** Dominant visual line or flow orientation */
  dominant_orientation?: DominantOrientation;
  /** Ordered list of visual elements by hierarchy importance */
  visual_hierarchy?: string[];
  /** Spatial regions where important visual information is concentrated */
  dominant_regions?: DominantRegion[];
  /** Presence and distribution of visually empty negative space */
  negative_space?: NegativeSpaceLevel;
  /** Prominent color hex codes detected */
  dominant_colors?: string[];
  /** Overall lighting atmosphere description */
  lighting_mood?: string;
  /** Broad tonal characteristics */
  tonal_range?: TonalRange;
  /** Concise natural-language summary of composition */
  summary?: string;
  /** Overall confidence score (0.0 to 1.0) */
  confidence?: number;
  /** Provenance describing how composition analysis was produced */
  source?: AnalysisSource;
}

/**
 * Classification of detected visual subjects
 */
export type SubjectType =
  | 'character'
  | 'face'
  | 'creature'
  | 'object'
  | 'weapon'
  | 'vehicle'
  | 'environment'
  | 'effect'
  | 'other';

export type SubjectVisibility =
  | 'fully_visible'
  | 'partially_visible'
  | 'occluded'
  | 'silhouette'
  | 'cropped';

export type SubjectImportance = 'primary' | 'secondary' | 'background' | 'incidental';

/**
 * Detected visual subject in a panel (Foundation for Part 2.4)
 */
export interface Subject {
  /** Stable unique identifier for this subject occurrence */
  subject_id: string;
  /** Category of subject */
  type: SubjectType;
  /** Human-readable label or description */
  label: string;
  /** Normalized bounding box within the panel (0.0 to 1.0) */
  bounding_box: BoundingBox;
  /** Degree of visibility */
  visibility?: SubjectVisibility;
  /** Relative prominence within the panel composition */
  importance?: SubjectImportance;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Origin source of detection */
  source?: AnalysisSourceType;
}

export type CharacterVisibility =
  | 'full_body'
  | 'upper_body'
  | 'bust'
  | 'face_only'
  | 'partial'
  | 'obscured';

export type CharacterScreenPosition =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'bottom'
  | 'background';

/**
 * Specific character detection and posture metadata (Foundation for Part 2.4)
 */
export interface CharacterDetection {
  /** Unique detection identifier */
  detection_id: string;
  /** Optional link to canonical Character entity ID in project roster */
  character_id?: string;
  /** Optional temporary label before entity association */
  label?: string;
  /** Full character body bounding box (normalized 0.0 to 1.0) */
  bounding_box: BoundingBox;
  /** Optional face sub-region (normalized 0.0 to 1.0) */
  face_region?: BoundingBox;
  /** Framing coverage of the character */
  visibility?: CharacterVisibility;
  /** Detected pose / body posture description */
  pose?: string;
  /** Detected facial expression */
  expression?: string;
  /** Specific action or gesture performed */
  action?: string;
  /** Screen quadrant / horizontal placement */
  screen_position?: CharacterScreenPosition;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Cross-panel continuity tag or reference */
  continuity_reference?: string;
}

/**
 * Classification of visible text and dialogue bubbles
 */
export type TextElementType =
  | 'dialogue'
  | 'narration'
  | 'thought'
  | 'sfx'
  | 'sign'
  | 'system_ui'
  | 'whisper'
  | 'shout'
  | 'unknown';

/**
 * Extracted text or speech bubble occurrence (Foundation for Part 2.5)
 */
export interface TextElement {
  /** Stable unique identifier for this text element */
  text_id: string;
  /** Classification of the text bubble or sound effect */
  type: TextElementType;
  /** Extracted text string content */
  content: string;
  /** Normalized bounding box of the bubble or text area */
  bounding_box: BoundingBox;
  /** Reading order index within the panel (0-based) */
  reading_order?: number;
  /** Speaker character ID or attribution reference */
  speaker_reference?: string;
  /** OCR / detection confidence score (0.0 to 1.0) */
  confidence: number;
  /** OCR transcription confidence score (0.0 to 1.0) */
  ocr_confidence?: number;
  /** Source of text extraction */
  source?: AnalysisSourceType;
}

/**
 * Scene location and environmental context (Foundation for Part 2.6)
 */
export interface SceneContext {
  /** Primary location description */
  location?: string;
  /** Environment type (e.g. 'dungeon', 'forest', 'city', 'throne_room') */
  environment?: string;
  /** Indoor vs Outdoor classification */
  indoor_outdoor?: 'indoor' | 'outdoor' | 'unclear' | 'abstract';
  /** Time of day context */
  time_context?: 'day' | 'night' | 'sunset' | 'dawn' | 'dusk' | 'timeless';
  /** Weather conditions */
  weather?: string;
  /** Lighting qualities */
  lighting?: string;
  /** Overall atmosphere / emotional mood */
  atmosphere?: string;
  /** Confidence score (0.0 to 1.0) */
  confidence?: number;
}

export type ActionIntensity = 'subtle' | 'moderate' | 'high' | 'explosive';

/**
 * Action or event observation occurring in the panel (Foundation for Part 2.6)
 */
export interface ActionObservation {
  /** Unique action identifier */
  action_id: string;
  /** Type of action (e.g. 'combat', 'movement', 'dialogue', 'magic', 'reaction', 'static') */
  type: string;
  /** Descriptive summary of the physical action */
  description?: string;
  /** Reference to subject ID performing the action */
  actor_subject_id?: string;
  /** Reference to subject ID receiving the action */
  target_subject_id?: string;
  /** Action energy / intensity */
  intensity?: ActionIntensity;
  /** Directional vector description */
  direction?: string;
  /** Narrative temporal context (e.g. 'immediate', 'ongoing', 'aftermath') */
  temporal_context?: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
}

export type FocusTargetType =
  | 'character'
  | 'face'
  | 'object'
  | 'action_area'
  | 'text'
  | 'environment';

export interface VisualFocusTarget {
  /** Category of focus target */
  type: FocusTargetType;
  /** Optional linked subject or character ID */
  subject_id?: string;
  /** Normalized bounding box region for this target */
  region?: BoundingBox;
  /** Narrative reason why this is a focal element */
  description?: string;
}

/**
 * Primary visual focal point and hierarchy (Foundation for Part 2.7)
 */
export interface VisualFocus {
  /** Primary focal point target */
  primary_target?: VisualFocusTarget;
  /** Secondary focal points */
  secondary_targets?: VisualFocusTarget[];
  /** Overall primary visual focus bounding box (normalized 0.0 to 1.0) */
  focus_region: BoundingBox;
  /** Normalized importance score (0.0 to 1.0) */
  importance?: number;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Rationale for focus selection */
  reason?: string;
}

export type CameraTargetType =
  | 'character'
  | 'focal_point'
  | 'full_action'
  | 'establishing'
  | 'text_safe';

/**
 * Camera-relevant region and safe margins (Foundation for Part 2.7)
 */
export interface CameraRegion {
  /** Unique region identifier */
  region_id: string;
  /** Normalized bounding box of camera interest */
  region: BoundingBox;
  /** Recommended safe margin padding (0.0 to 1.0) */
  safe_margin?: number;
  /** Target classification */
  target_type: CameraTargetType;
  /** Importance weighting (0.0 to 1.0) */
  importance: number;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
}

/**
 * Camera motion potential and framing recommendations (Foundation for Part 2.7)
 */
export interface CameraAnalysis {
  /** Recommended primary camera target region */
  recommended_target?: BoundingBox;
  /** Camera safe regions avoiding text clipping */
  safe_regions?: CameraRegion[];
  /** Recommended shot type (e.g. 'close-up', 'medium-shot', 'panning-shot') */
  shot_type?: string;
  /** Zoom headroom / viability */
  zoom_potential?: 'low' | 'medium' | 'high';
  /** Pan motion viability */
  pan_potential?: 'static' | 'vertical_down' | 'vertical_up' | 'horizontal' | 'diagonal';
  /** Suggested motion vector direction */
  suggested_motion?: string;
  /** Recommended duration in seconds */
  duration_seconds?: number;
  /** Camera framing constraints or notes */
  constraints?: string[];
  /** Confidence score (0.0 to 1.0) */
  confidence?: number;
}

/**
 * Canonical relationship types across panels (Part 2.8)
 */
export type CrossPanelRelationshipType =
  | 'SAME_ENTITY'
  | 'POSSIBLE_SAME_ENTITY'
  | 'DIFFERENT_ENTITY'
  | 'CONTINUES'
  | 'APPEARS'
  | 'DISAPPEARS'
  | 'ACTION_CONTINUES'
  | 'ACTION_RESULT'
  | 'ACTION_TRANSITION'
  | 'NEW_ACTION'
  | 'NO_CONTINUITY'
  | 'SCENE_CONTINUES'
  | 'SCENE_CHANGES'
  | 'OBJECT_CONTINUES'
  | 'SAME_OBJECT'
  | 'OBJECT_DISAPPEARS'
  | 'OBJECT_APPEARS'
  | 'AMBIGUOUS_OBJECT'
  | 'TEXT_CONTINUES'
  | 'TEXT_DISAPPEARS'
  | 'NEW_TEXT_APPEARS'
  | 'SFX_CONTINUES'
  | 'VISUAL_STATE_CHANGES'
  | 'FOCUS_CONTINUES'
  | 'FOCUS_SHIFT'
  | 'POSITION_CHANGED'
  | 'POSITION_STABLE'
  | 'CONTINUOUS_SCENE'
  | 'CONTINUOUS_ACTION'
  | 'NEW_SHOT_SAME_SCENE'
  | 'UNKNOWN';

export type EntityContinuityType =
  | 'SAME_ENTITY'
  | 'POSSIBLE_SAME_ENTITY'
  | 'DIFFERENT_ENTITY'
  | 'AMBIGUOUS'
  | 'UNKNOWN';

export type ObjectContinuityType =
  | 'SAME_OBJECT'
  | 'OBJECT_DISAPPEARS'
  | 'OBJECT_APPEARS'
  | 'AMBIGUOUS_OBJECT'
  | 'UNKNOWN';

export type ActionContinuityType =
  | 'ACTION_CONTINUES'
  | 'ACTION_RESULT'
  | 'ACTION_TRANSITION'
  | 'NEW_ACTION'
  | 'NO_CONTINUITY'
  | 'UNKNOWN';

export type SceneContinuityType =
  | 'SCENE_CONTINUES'
  | 'SCENE_CHANGES'
  | 'UNKNOWN';

export type FocusContinuityType =
  | 'FOCUS_CONTINUES'
  | 'FOCUS_SHIFT'
  | 'UNKNOWN';

export type SpatialContinuityType =
  | 'POSITION_STABLE'
  | 'POSITION_CHANGED'
  | 'UNKNOWN';

export type TextContinuityType =
  | 'TEXT_CONTINUES'
  | 'TEXT_DISAPPEARS'
  | 'NEW_TEXT_APPEARS'
  | 'SFX_CONTINUES'
  | 'UNKNOWN';

export type PanelTransitionType =
  | 'CONTINUOUS_SCENE'
  | 'CONTINUOUS_ACTION'
  | 'NEW_SHOT_SAME_SCENE'
  | 'SCENE_CHANGE'
  | 'UNKNOWN';

/**
 * Inferred cross-panel relationship between entities or panels (Part 2.8)
 */
export interface CrossPanelRelationship {
  /** Unique relationship identifier */
  relationship_id: string;
  /** ID of the source (preceding) panel */
  source_panel_id: string;
  /** ID of the target (succeeding or current) panel */
  target_panel_id: string;
  /** Semantic relationship classification */
  relationship_type: CrossPanelRelationshipType;
  /** Optional reference to source entity (e.g. char_001, sub_002, act_001) */
  source_entity_ref?: string | null;
  /** Optional reference to target entity (e.g. char_004, sub_005, act_002) */
  target_entity_ref?: string | null;
  /** Classification of referenced entity type */
  entity_type?: 'character' | 'subject' | 'object' | 'action' | 'text' | 'focus' | 'scene' | 'panel';
  /** Confidence score between 0.0 and 1.0 */
  confidence: number;
  /** Specific observable evidence justifying this relationship */
  evidence?: string[];
  /** Optional concise descriptive note */
  description?: string;
}

/**
 * Observable visual state changes between panels (Part 2.8)
 */
export interface VisualStateChange {
  /** Type of visual change */
  change_type:
    | 'character_posture'
    | 'expression'
    | 'object_state'
    | 'appearance'
    | 'disappearance'
    | 'obscuration'
    | 'lighting'
    | 'action_state'
    | 'focus_shift'
    | 'environment'
    | 'other';
  /** Optional entity or character reference */
  subject_ref?: string | null;
  /** Observable visual description of change */
  description: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
}

/**
 * Structured cross-panel continuity and relationship model (Part 2.8)
 */
export interface ContinuityAnalysis {
  /** Preceding panel ID compared against */
  previous_panel_id?: string | null;
  /** Succeeding panel ID compared against (if context window used) */
  next_panel_id?: string | null;
  /** Overall panel transition classification */
  transition_type?: PanelTransitionType;
  /** Scene/environment continuity evaluation */
  scene_continuity?: {
    status: SceneContinuityType;
    confidence: number;
    evidence?: string[];
  };
  /** Action continuity and causal relationship evaluation */
  action_continuity?: {
    status: ActionContinuityType;
    confidence: number;
    source_action_id?: string | null;
    target_action_id?: string | null;
    evidence?: string[];
  };
  /** Focus continuity and salience shift evaluation */
  focus_continuity?: {
    status: FocusContinuityType;
    confidence: number;
    shift_description?: string;
  };
  /** Specific entity/object/text cross-panel relationships */
  relationships: CrossPanelRelationship[];
  /** Meaningful visual-state changes detected */
  state_changes?: VisualStateChange[];
  /** Concise summary of continuity observations */
  summary?: string;
  /** Overall confidence score (0.0 to 1.0) */
  confidence?: number;
  /** Provenance describing how continuity analysis was produced */
  source?: AnalysisSource;
}

/**
 * Structured analysis error details
 */
export interface AnalysisError {
  /** Standardized error code */
  code: string;
  /** Pipeline stage during which error occurred */
  stage: string;
  /** Clean, user-readable error explanation without internal leakage */
  message: string;
  /** Whether the error is transient and can be retried */
  retryable: boolean;
  /** ISO timestamp when error was recorded */
  occurred_at: string;
  /** Optional structured debugging details */
  details?: unknown;
}

/**
 * Manual user corrections / overrides extension point (Foundation for Part 2.9)
 */
export interface VisualAnalysisCorrections {
  /** User-overridden focus region */
  focus_region_override?: BoundingBox;
  /** User-overridden shot scale */
  shot_scale_override?: ShotScale;
  /** User-overridden scene location */
  scene_location_override?: string;
  /** User flag indicating manual review is requested */
  is_flagged?: boolean;
  /** User inspection notes */
  manual_notes?: string;
  /** ISO timestamp of last manual correction */
  corrected_at?: string;
}

/**
 * Granular stage completion tracking for incremental analysis
 */
export interface StageAnalysisStatus {
  preprocessing: VisualAnalysisStatus;
  composition: VisualAnalysisStatus;
  subjects: VisualAnalysisStatus;
  characters: VisualAnalysisStatus;
  text: VisualAnalysisStatus;
  scene: VisualAnalysisStatus;
  action: VisualAnalysisStatus;
  focus: VisualAnalysisStatus;
  camera: VisualAnalysisStatus;
  continuity?: VisualAnalysisStatus;
}

/**
 * Canonical Root Visual Analysis Model (Part 2.1)
 * Attached to each Panel to store rich, structured visual intelligence.
 */
export interface VisualAnalysis {
  /** Visual analysis contract version (e.g. '1.0.0') */
  analysis_version: string;
  /** Overall lifecycle status of panel visual analysis */
  status: VisualAnalysisStatus;
  /** Granular status of individual analysis stages */
  stages?: Partial<StageAnalysisStatus>;
  /** Provenance describing how analysis was produced */
  source?: AnalysisSource;
  /** Preprocessing image proxy metadata */
  preprocessing?: PreprocessingInfo;
  /** Visual composition and framing */
  composition?: CompositionAnalysis;
  /** Detected subjects and objects */
  subjects?: Subject[];
  /** Detected characters and postures */
  characters?: CharacterDetection[];
  /** Extracted text and dialogue (canonical text elements) */
  text?: TextElement[];
  /** Extracted text and dialogue alias for convenience */
  text_elements?: TextElement[];
  /** Scene and environmental context */
  scene?: SceneContext;
  /** Action and motion events */
  action?: ActionObservation[];
  /** Primary visual focus and camera region */
  visual_focus?: VisualFocus;
  /** Camera intelligence and safe region recommendations */
  camera?: CameraAnalysis;
  /** Visual continuity & cross-panel relationship analysis (Part 2.8) */
  continuity?: ContinuityAnalysis;
  /** Overall confidence score (0.0 to 1.0) */
  confidence?: number;
  /** Last recorded error if analysis failed */
  error?: AnalysisError;
  /** Manual corrections override layer */
  manual_corrections?: VisualAnalysisCorrections;
  /** Extensible custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Factory creating an unanalyzed default VisualAnalysis structure
 */
export function createDefaultVisualAnalysis(
  status: VisualAnalysisStatus = 'NOT_ANALYZED'
): VisualAnalysis {
  return {
    analysis_version: '1.0.0',
    status,
    confidence: undefined,
  };
}
