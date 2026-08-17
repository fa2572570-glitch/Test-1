/**
 * Part 2.5 — Dialogue, Speech-Bubble, Text & SFX Stage Engine Implementation
 * 
 * Implements ITextAnalysisStageAnalyzer using the decoupled vision provider abstraction,
 * zero-fabrication OCR normalization, reading order assignment, and canonical TextElement models.
 */

import {
  Panel,
  PreprocessingInfo,
  TextElement,
  AnalysisError,
} from '../../types';
import {
  ITextAnalysisStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import { getOrCreateProxy } from '../../features/analysis/image-preprocessing.service';
import {
  getVisionAnalysisProvider,
  IVisionAnalysisProvider,
  normalizeAndValidateAITextAnalysis,
} from '../../services/ai';

export interface TextAnalysisStageAnalyzerOptions {
  provider?: IVisionAnalysisProvider;
}

export class TextAnalysisStageAnalyzer implements ITextAnalysisStageAnalyzer {
  readonly stageName = 'text' as const;
  private provider?: IVisionAnalysisProvider;

  constructor(options?: TextAnalysisStageAnalyzerOptions) {
    this.provider = options?.provider;
  }

  private getActiveProvider(): IVisionAnalysisProvider {
    return this.provider || getVisionAnalysisProvider();
  }

  /**
   * Extracts visible speech bubbles, dialogue, narration, thoughts, sound effects (SFX),
   * and text regions from the analysis proxy.
   */
  async extractTextElements(
    panel: Panel,
    preprocessing?: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<TextElement[]> {
    if (context?.signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'text',
        message: 'Text analysis aborted by execution context',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!panel.image_id) {
      throw {
        code: 'MISSING_IMAGE_REFERENCE',
        stage: 'text',
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
        stage: 'text',
        message: `Failed to load or generate analysis proxy for panel ${panel.panel_id || panel.id}: ${err.message || err}`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!proxyResult || !proxyResult.blob || proxyResult.blob.size === 0) {
      throw {
        code: 'UNREADABLE_PROXY',
        stage: 'text',
        message: `Analysis proxy for panel ${panel.panel_id || panel.id} is empty or unreadable`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 2. Call Vision Provider
    const provider = this.getActiveProvider();
    const readingDirection = context?.readingDirection || 'top-to-bottom';

    const { raw, provenance } = await provider.analyzePanelText(
      {
        imageBlob: proxyResult.blob,
        mimeType: proxyResult.info.format,
        panelId: panel.panel_id || panel.id,
        context: {
          order: panel.order,
          aspectRatio: proxyResult.info.analysis_width / proxyResult.info.analysis_height,
          readingDirection,
        },
      },
      context?.signal
    );

    // 3. Normalize, Deduplicate, Order & Validate Canonical TextElement models
    const validatedTextElements = normalizeAndValidateAITextAnalysis(
      raw,
      provenance,
      readingDirection
    );

    return validatedTextElements;
  }
}
