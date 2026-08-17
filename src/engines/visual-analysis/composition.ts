/**
 * Part 2.3 — Panel Composition Stage Engine Implementation
 * 
 * Implements ICompositionStageAnalyzer using the decoupled vision provider abstraction
 * and strict Zod schema validation without fabricating fake results.
 */

import {
  Panel,
  PreprocessingInfo,
  CompositionAnalysis,
  AnalysisError,
} from '../../types';
import {
  ICompositionStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import { getOrCreateProxy } from '../../features/analysis/image-preprocessing.service';
import {
  getVisionAnalysisProvider,
  IVisionAnalysisProvider,
  normalizeAndValidateAIComposition,
} from '../../services/ai';

export interface CompositionStageAnalyzerOptions {
  provider?: IVisionAnalysisProvider;
}

export class CompositionStageAnalyzer implements ICompositionStageAnalyzer {
  readonly stageName = 'composition' as const;
  private provider?: IVisionAnalysisProvider;

  constructor(options?: CompositionStageAnalyzerOptions) {
    this.provider = options?.provider;
  }

  private getActiveProvider(): IVisionAnalysisProvider {
    return this.provider || getVisionAnalysisProvider();
  }

  /**
   * Analyzes panel composition and visual structure from the analysis proxy.
   */
  async analyzeComposition(
    panel: Panel,
    preprocessing?: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<CompositionAnalysis> {
    if (context?.signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'composition',
        message: 'Composition analysis aborted by execution context',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!panel.image_id) {
      throw {
        code: 'MISSING_IMAGE_REFERENCE',
        stage: 'composition',
        message: `Panel ${panel.panel_id} does not have an associated image_id`,
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
        stage: 'composition',
        message: `Failed to load or generate analysis proxy for panel ${panel.panel_id}: ${err.message || err}`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!proxyResult || !proxyResult.blob || proxyResult.blob.size === 0) {
      throw {
        code: 'UNREADABLE_PROXY',
        stage: 'composition',
        message: `Analysis proxy for panel ${panel.panel_id} is empty or unreadable`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 2. Call Vision Provider
    const provider = this.getActiveProvider();
    const { raw, provenance } = await provider.analyzePanelComposition(
      {
        imageBlob: proxyResult.blob,
        mimeType: proxyResult.info.format,
        panelId: panel.panel_id,
        context: {
          order: panel.order,
          aspectRatio: proxyResult.info.analysis_width / proxyResult.info.analysis_height,
          readingDirection: context?.readingDirection,
        },
      },
      context?.signal
    );

    // 3. Normalize & Validate Canonical Model
    const validatedComposition = normalizeAndValidateAIComposition(raw, provenance);

    return validatedComposition;
  }
}
