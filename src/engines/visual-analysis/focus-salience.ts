/**
 * Part 2.7 — Visual Salience, Focus & Story-Relevant Region Stage Engine Implementation
 * 
 * Implements IFocusAndCameraStageAnalyzer using decoupled vision provider abstraction,
 * zero-fabrication visual inference rules, and canonical VisualFocus + CameraAnalysis models.
 */

import {
  Panel,
  PreprocessingInfo,
  Subject,
  TextElement,
  VisualFocus,
  CameraAnalysis,
  AnalysisError,
} from '../../types';
import {
  IFocusAndCameraStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import { getOrCreateProxy } from '../../features/analysis/image-preprocessing.service';
import {
  getVisionAnalysisProvider,
  IVisionAnalysisProvider,
  normalizeAndValidateAIFocusAnalysis,
} from '../../services/ai';

export interface FocusAndCameraStageAnalyzerOptions {
  provider?: IVisionAnalysisProvider;
}

export class FocusAndCameraStageAnalyzer implements IFocusAndCameraStageAnalyzer {
  readonly stageName = 'focus_and_camera' as const;
  private provider?: IVisionAnalysisProvider;

  constructor(options?: FocusAndCameraStageAnalyzerOptions) {
    this.provider = options?.provider;
  }

  private getActiveProvider(): IVisionAnalysisProvider {
    return this.provider || getVisionAnalysisProvider();
  }

  /**
   * Analyzes visual salience, primary/secondary focus points, and descriptive camera-safe interest regions.
   */
  async analyzeFocusAndCamera(
    panel: Panel,
    preprocessing?: PreprocessingInfo,
    subjects?: Subject[],
    text?: TextElement[],
    context?: VisualAnalysisExecutionContext
  ): Promise<{
    visualFocus: VisualFocus;
    cameraAnalysis: CameraAnalysis;
  }> {
    if (context?.signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'focus',
        message: 'Visual focus analysis aborted by execution context',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!panel.image_id) {
      throw {
        code: 'MISSING_IMAGE_REFERENCE',
        stage: 'focus',
        message: `Panel ${panel.panel_id || panel.id} does not have an associated image_id`,
        retryable: false,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 1. Retrieve or generate the analysis proxy
    let proxyResult;
    try {
      proxyResult = await getOrCreateProxy(panel.image_id);
    } catch (err: any) {
      throw {
        code: 'MISSING_PROXY',
        stage: 'focus',
        message: `Failed to load or generate analysis proxy for panel ${panel.panel_id || panel.id}: ${err.message || err}`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!proxyResult || !proxyResult.blob || proxyResult.blob.size === 0) {
      throw {
        code: 'UNREADABLE_PROXY',
        stage: 'focus',
        message: `Analysis proxy blob for panel ${panel.panel_id || panel.id} is empty or unreadable`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    const provider = this.getActiveProvider();

    // 2. Synthesize known entity context from previous stages for prompt & reference validation
    const va = panel.visual_analysis;
    const existingCharacters = va?.characters || [];
    const existingSubjects = subjects || va?.subjects || [];
    const existingText = text || va?.text_elements || va?.text || [];
    const existingScene = va?.scene;
    const existingActions = va?.action || [];

    const characterIds = new Set<string>(existingCharacters.map(c => c.detection_id));
    const subjectIds = new Set<string>(existingSubjects.map(s => s.subject_id));
    const textIds = new Set<string>(existingText.map(t => t.text_id));
    const actionIds = new Set<string>(existingActions.map(a => a.action_id));

    const promptContext = {
      order: panel.order,
      aspectRatio:
        preprocessing?.source_width && preprocessing?.source_height
          ? preprocessing.source_width / preprocessing.source_height
          : undefined,
      characters: existingCharacters.map(c => ({
        id: c.detection_id,
        label: c.label,
        bounding_box: c.bounding_box,
      })),
      subjects: existingSubjects.map(s => ({
        id: s.subject_id,
        label: s.label,
        type: s.type,
        bounding_box: s.bounding_box,
      })),
      textElements: existingText.map(t => ({
        id: t.text_id,
        type: t.type,
        content: t.content,
        bounding_box: t.bounding_box,
      })),
      scene: existingScene,
      actions: existingActions,
      readingDirection: context?.readingDirection || 'top_to_bottom',
    };

    // 3. Delegate to Vision Provider
    let providerOutput;
    try {
      providerOutput = await provider.analyzePanelFocus(
        {
          imageBlob: proxyResult.blob,
          mimeType: proxyResult.mimeType || 'image/jpeg',
          panelId: panel.panel_id || panel.id,
          context: promptContext,
        },
        context?.signal
      );
    } catch (err: any) {
      if (err.code && err.stage) {
        throw err;
      }
      throw {
        code: 'PROVIDER_ERROR',
        stage: 'focus',
        message: err.message || 'Vision provider failed during visual focus analysis',
        retryable: true,
        occurred_at: new Date().toISOString(),
        details: err,
      } as AnalysisError;
    }

    // 4. Defensive Normalization & Zod Validation with Reference Checks
    const normalizedResult = normalizeAndValidateAIFocusAnalysis(
      providerOutput.raw,
      providerOutput.provenance,
      {
        characters: characterIds,
        subjects: subjectIds,
        texts: textIds,
        actions: actionIds,
      }
    );

    return normalizedResult;
  }
}
