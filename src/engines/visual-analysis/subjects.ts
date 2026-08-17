/**
 * Part 2.4 — Character, Face & Subject Stage Engine Implementation
 * 
 * Implements ISubjectDetectionStageAnalyzer using the decoupled vision provider abstraction,
 * strict normalized coordinates validation, and canonical Subject / CharacterDetection models.
 */

import {
  Panel,
  PreprocessingInfo,
  Subject,
  CharacterDetection,
  AnalysisError,
} from '../../types';
import {
  ISubjectDetectionStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import { getOrCreateProxy } from '../../features/analysis/image-preprocessing.service';
import {
  getVisionAnalysisProvider,
  IVisionAnalysisProvider,
  normalizeAndValidateAISubjectDetection,
} from '../../services/ai';

export interface SubjectDetectionStageAnalyzerOptions {
  provider?: IVisionAnalysisProvider;
}

export class SubjectDetectionStageAnalyzer implements ISubjectDetectionStageAnalyzer {
  readonly stageName = 'subjects' as const;
  private provider?: IVisionAnalysisProvider;

  constructor(options?: SubjectDetectionStageAnalyzerOptions) {
    this.provider = options?.provider;
  }

  private getActiveProvider(): IVisionAnalysisProvider {
    return this.provider || getVisionAnalysisProvider();
  }

  /**
   * Analyzes panel subjects, characters, faces, postures, and spatial boxes from the analysis proxy.
   */
  async detectSubjects(
    panel: Panel,
    preprocessing?: PreprocessingInfo,
    context?: VisualAnalysisExecutionContext
  ): Promise<{
    subjects: Subject[];
    characters: CharacterDetection[];
  }> {
    if (context?.signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'subjects',
        message: 'Subject detection analysis aborted by execution context',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!panel.image_id) {
      throw {
        code: 'MISSING_IMAGE_REFERENCE',
        stage: 'subjects',
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
        stage: 'subjects',
        message: `Failed to load or generate analysis proxy for panel ${panel.panel_id || panel.id}: ${err.message || err}`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    if (!proxyResult || !proxyResult.blob || proxyResult.blob.size === 0) {
      throw {
        code: 'UNREADABLE_PROXY',
        stage: 'subjects',
        message: `Analysis proxy for panel ${panel.panel_id || panel.id} is empty or unreadable`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 2. Call Vision Provider
    const provider = this.getActiveProvider();
    const { raw, provenance } = await provider.analyzePanelSubjects(
      {
        imageBlob: proxyResult.blob,
        mimeType: proxyResult.info.format,
        panelId: panel.panel_id || panel.id,
        context: {
          order: panel.order,
          aspectRatio: proxyResult.info.analysis_width / proxyResult.info.analysis_height,
          readingDirection: context?.readingDirection,
        },
      },
      context?.signal
    );

    // 3. Normalize & Validate Canonical Models
    const panelPrefix = panel.panel_id || panel.id || 'pnl';
    const validatedDetections = normalizeAndValidateAISubjectDetection(raw, provenance, panelPrefix);

    return validatedDetections;
  }
}
