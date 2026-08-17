/**
 * Part 2.1 — Visual Analysis Engine Contracts & Modular Stage Interfaces
 * Defines clean extension points and lifecycle contracts for all future
 * analysis stages without executing real AI calls or fabricating mock data.
 */

import {
  Panel,
  VisualAnalysis,
  VisualAnalysisStatus,
  PreprocessingInfo,
  CompositionAnalysis,
  Subject,
  CharacterDetection,
  TextElement,
  SceneContext,
  ActionObservation,
  VisualFocus,
  CameraAnalysis,
  ContinuityAnalysis,
  AnalysisError,
} from '../../types';

/**
 * Execution context provided to analysis engines
 */
export interface VisualAnalysisExecutionContext {
  /** Optional project-level metadata (e.g. series genre, reading direction) */
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  /** Optional cancellation signal */
  signal?: AbortSignal;
  /** Optional stage whitelist to run partial analysis */
  targetStages?: Array<
    | 'preprocessing'
    | 'composition'
    | 'subjects'
    | 'characters'
    | 'text'
    | 'scene'
    | 'action'
    | 'focus'
    | 'camera'
    | 'continuity'
  >;
}

/**
 * Individual modular stage contracts (Sections 26 & 27)
 */

/**
 * Stage 2.2: Image Preprocessing & Analysis Proxy Contract
 */
export interface IPreprocessingStageAnalyzer {
  readonly stageName: 'preprocessing';
  processImageProxy(
    panel: Panel,
    imageBlob: Blob,
    context?: VisualAnalysisExecutionContext
  ): Promise<PreprocessingInfo>;
}

/**
 * Stage 2.3: Panel Composition & Framing Analysis Contract
 */
export interface ICompositionStageAnalyzer {
  readonly stageName: 'composition';
  analyzeComposition(
    panel: Panel,
    preprocessing: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<CompositionAnalysis>;
}

/**
 * Stage 2.4: Character, Face & Subject Detection Contract
 */
export interface ISubjectDetectionStageAnalyzer {
  readonly stageName: 'subjects';
  detectSubjects(
    panel: Panel,
    preprocessing: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<{
    subjects: Subject[];
    characters: CharacterDetection[];
  }>;
}

/**
 * Stage 2.5: Dialogue & Speech-Bubble OCR Contract
 */
export interface ITextAnalysisStageAnalyzer {
  readonly stageName: 'text';
  extractTextElements(
    panel: Panel,
    preprocessing: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<TextElement[]>;
}

/**
 * Stage 2.6: Scene, Environment & Action Analysis Contract
 */
export interface ISceneAndActionStageAnalyzer {
  readonly stageName: 'scene_and_action';
  analyzeSceneAndAction(
    panel: Panel,
    preprocessing: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<{
    scene?: SceneContext;
    actions: ActionObservation[];
  }>;
}

/**
 * Stage 2.7: Visual Focus & Camera-Relevant Analysis Contract
 */
export interface IFocusAndCameraStageAnalyzer {
  readonly stageName: 'focus_and_camera';
  analyzeFocusAndCamera(
    panel: Panel,
    preprocessing: PreprocessingInfo,
    subjects: Subject[],
    text: TextElement[],
    context?: VisualAnalysisExecutionContext
  ): Promise<{
    visualFocus: VisualFocus;
    cameraAnalysis: CameraAnalysis;
  }>;
}

/**
 * Stage 2.8: Visual Continuity & Cross-Panel Relationship Analysis Contract
 */
export interface IContinuityStageAnalyzer {
  readonly stageName: 'continuity';
  analyzeContinuity(
    panel: Panel,
    preprocessing: PreprocessingInfo,
    previousPanel?: Panel,
    nextPanel?: Panel,
    context?: VisualAnalysisExecutionContext
  ): Promise<ContinuityAnalysis>;
}

/**
 * Master Visual Analysis Engine Interface (Section 26)
 */
export interface IVisualAnalysisEngine {
  /**
   * Execute visual analysis for a single panel
   */
  analyzePanel(
    panel: Panel,
    imageBlob?: Blob,
    context?: VisualAnalysisExecutionContext
  ): Promise<VisualAnalysis>;

  /**
   * Execute visual analysis for a batch of panels
   */
  analyzeBatch(
    panels: Panel[],
    imageBlobs?: Map<string, Blob>,
    context?: VisualAnalysisExecutionContext
  ): Promise<Map<string, VisualAnalysis>>;

  /**
   * Retrieve current lifecycle status for a panel
   */
  getStatus(panelId: string): VisualAnalysisStatus;

  /**
   * Cancel an in-progress analysis for a specific panel
   */
  cancel(panelId: string): Promise<boolean>;
}

/**
 * Default Foundation Engine Stub (Part 2.1)
 * Strictly fulfills the engine contract by returning structured unanalyzed records
 * without making external AI calls or fabricating mock visual data.
 */
export class FoundationVisualAnalysisEngine implements IVisualAnalysisEngine {
  private panelStatuses = new Map<string, VisualAnalysisStatus>();

  async analyzePanel(
    panel: Panel,
    _imageBlob?: Blob,
    _context?: VisualAnalysisExecutionContext
  ): Promise<VisualAnalysis> {
    this.panelStatuses.set(panel.id, 'NOT_ANALYZED');
    return {
      analysis_version: '1.0.0',
      status: 'NOT_ANALYZED',
    };
  }

  async analyzeBatch(
    panels: Panel[],
    _imageBlobs?: Map<string, Blob>,
    _context?: VisualAnalysisExecutionContext
  ): Promise<Map<string, VisualAnalysis>> {
    const resultMap = new Map<string, VisualAnalysis>();
    for (const panel of panels) {
      resultMap.set(panel.id, {
        analysis_version: '1.0.0',
        status: 'NOT_ANALYZED',
      });
      this.panelStatuses.set(panel.id, 'NOT_ANALYZED');
    }
    return resultMap;
  }

  getStatus(panelId: string): VisualAnalysisStatus {
    return this.panelStatuses.get(panelId) || 'NOT_ANALYZED';
  }

  async cancel(panelId: string): Promise<boolean> {
    this.panelStatuses.set(panelId, 'NOT_ANALYZED');
    return true;
  }
}
