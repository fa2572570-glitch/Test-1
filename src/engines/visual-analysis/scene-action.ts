/**
 * Part 2.6 — Scene Context, Environment & Physical Action Stage Engine Implementation
 * 
 * Implements ISceneAndActionStageAnalyzer using decoupled vision provider abstraction,
 * zero-fabrication visual inference rules, and canonical SceneContext + ActionObservation models.
 */

import {
  Panel,
  PreprocessingInfo,
  SceneContext,
  ActionObservation,
  AnalysisError,
} from '../../types';
import {
  ISceneAndActionStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import { getOrCreateProxy } from '../../features/analysis/image-preprocessing.service';
import {
  getVisionAnalysisProvider,
  IVisionAnalysisProvider,
  normalizeAndValidateAISceneAndActionAnalysis,
} from '../../services/ai';

export interface SceneAndActionStageAnalyzerOptions {
  provider?: IVisionAnalysisProvider;
}

export class SceneAndActionStageAnalyzer implements ISceneAndActionStageAnalyzer {
  readonly stageName = 'scene_and_action' as const;
  private provider?: IVisionAnalysisProvider;

  constructor(options?: SceneAndActionStageAnalyzerOptions) {
    this.provider = options?.provider;
  }

  private getActiveProvider(): IVisionAnalysisProvider {
    return this.provider || getVisionAnalysisProvider();
  }

  /**
   * Analyzes environmental scene setting and detects visible physical actions in the panel.
   */
  async analyzeSceneAndAction(
    panel: Panel,
    preprocessing?: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<{
    scene?: SceneContext;
    actions: ActionObservation[];
  }> {
    if (context?.signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'scene_and_action',
        message: 'Scene and action analysis aborted by execution context',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!panel.image_id) {
      throw {
        code: 'MISSING_IMAGE_REFERENCE',
        stage: 'scene_and_action',
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
        stage: 'scene_and_action',
        message: `Failed to load or generate analysis proxy for panel ${panel.panel_id || panel.id}: ${err.message || err}`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!proxyResult || !proxyResult.blob || proxyResult.blob.size === 0) {
      throw {
        code: 'UNREADABLE_PROXY',
        stage: 'scene_and_action',
        message: `Analysis proxy for panel ${panel.panel_id || panel.id} is empty or unreadable`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 2. Gather context from previous stages (subjects, characters, text) if present
    const subjects = panel.visual_analysis?.subjects || [];
    const characters = panel.visual_analysis?.characters || [];
    const textElements = panel.visual_analysis?.text_elements || panel.visual_analysis?.text || [];

    const knownSubjectIds: string[] = [
      ...characters.map((c) => c.detection_id),
      ...subjects.map((s) => s.subject_id),
    ];

    // 3. Call Vision Provider
    const provider = this.getActiveProvider();
    const readingDirection = context?.readingDirection || 'top-to-bottom';

    const { raw, provenance } = await provider.analyzePanelSceneAndAction(
      {
        imageBlob: proxyResult.blob,
        mimeType: proxyResult.info.format,
        panelId: panel.panel_id || panel.id,
        context: {
          order: panel.order,
          aspectRatio: proxyResult.info.analysis_width / proxyResult.info.analysis_height,
          readingDirection,
          characters: characters.map((c) => ({ id: c.detection_id, label: c.label })),
          subjects: subjects.map((s) => ({ id: s.subject_id, label: s.label, type: s.type })),
          textElements: textElements.map((t) => ({ id: t.text_id, type: t.type, content: t.content })),
        },
      },
      context?.signal
    );

    // 4. Normalize and validate canonical models
    const validated = normalizeAndValidateAISceneAndActionAnalysis(
      raw,
      provenance,
      knownSubjectIds
    );

    return validated;
  }
}
