/**
 * Part 2.8 — Visual Continuity & Cross-Panel Relationship Stage Engine Implementation
 * 
 * Implements IContinuityStageAnalyzer using decoupled vision provider abstraction,
 * strict zero-fabrication rules, evidence-based visual matching, and canonical ContinuityAnalysis models.
 */

import {
  Panel,
  PreprocessingInfo,
  ContinuityAnalysis,
  AnalysisError,
} from '../../types';
import {
  IContinuityStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import { getOrCreateProxy } from '../../features/analysis/image-preprocessing.service';
import {
  getVisionAnalysisProvider,
  IVisionAnalysisProvider,
  normalizeAndValidateAIContinuityAnalysis,
  PanelContextSummary,
} from '../../services/ai';

export interface ContinuityStageAnalyzerOptions {
  provider?: IVisionAnalysisProvider;
}

export class ContinuityStageAnalyzer implements IContinuityStageAnalyzer {
  readonly stageName = 'continuity' as const;
  private provider?: IVisionAnalysisProvider;

  constructor(options?: ContinuityStageAnalyzerOptions) {
    this.provider = options?.provider;
  }

  private getActiveProvider(): IVisionAnalysisProvider {
    return this.provider || getVisionAnalysisProvider();
  }

  /**
   * Analyzes cross-panel character continuity, object persistence, action continuation,
   * scene transitions, focus shifts, and meaningful visual state changes.
   */
  async analyzeContinuity(
    panel: Panel,
    preprocessing?: PreprocessingInfo,
    previousPanel?: Panel,
    nextPanel?: Panel,
    context?: VisualAnalysisExecutionContext
  ): Promise<ContinuityAnalysis> {
    if (context?.signal?.aborted) {
      throw {
        code: 'ANALYSIS_CANCELLED',
        stage: 'continuity',
        message: 'Visual continuity analysis aborted by execution context',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    const currentPanelId = panel.panel_id || panel.id;
    if (!panel.image_id) {
      throw {
        code: 'MISSING_IMAGE_REFERENCE',
        stage: 'continuity',
        message: `Panel ${currentPanelId} does not have an associated image_id`,
        retryable: false,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 1. Retrieve current panel analysis proxy
    let currentProxyResult;
    try {
      currentProxyResult = await getOrCreateProxy(panel.image_id);
    } catch (err: any) {
      throw {
        code: 'MISSING_PROXY',
        stage: 'continuity',
        message: `Failed to load or generate analysis proxy for current panel ${currentPanelId}: ${err.message || err}`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    const currentBlob = currentProxyResult?.proxyBlob || (currentProxyResult as any)?.blob;
    if (!currentProxyResult || !currentBlob || currentBlob.size === 0) {
      throw {
        code: 'UNREADABLE_PROXY',
        stage: 'continuity',
        message: `Analysis proxy blob for current panel ${currentPanelId} is empty or unreadable`,
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }

    // 2. Retrieve previous panel analysis proxy if available
    let previousProxyResult: { blob: Blob; mimeType: string } | undefined = undefined;
    if (previousPanel && previousPanel.image_id) {
      try {
        const prevRes = await getOrCreateProxy(previousPanel.image_id);
        const prevBlob = prevRes?.proxyBlob || (prevRes as any)?.blob;
        if (prevBlob) {
          previousProxyResult = {
            blob: prevBlob,
            mimeType: prevRes?.info?.format || 'image/jpeg',
          };
        }
      } catch (err) {
        console.warn(`Could not load proxy for previous panel ${previousPanel.panel_id || previousPanel.id}:`, err);
      }
    }

    // 3. Retrieve next panel analysis proxy if available
    let nextProxyResult: { blob: Blob; mimeType: string } | undefined = undefined;
    if (nextPanel && nextPanel.image_id) {
      try {
        const nextRes = await getOrCreateProxy(nextPanel.image_id);
        const nextBlob = nextRes?.proxyBlob || (nextRes as any)?.blob;
        if (nextBlob) {
          nextProxyResult = {
            blob: nextBlob,
            mimeType: nextRes?.info?.format || 'image/jpeg',
          };
        }
      } catch (err) {
        console.warn(`Could not load proxy for next panel ${nextPanel.panel_id || nextPanel.id}:`, err);
      }
    }

    // 4. Build context summaries and valid entity sets for reference validation
    const currVa = panel.visual_analysis;
    const currentContext: PanelContextSummary = {
      panelId: currentPanelId,
      order: panel.order,
      aspectRatio:
        preprocessing?.source_width && preprocessing?.source_height
          ? preprocessing.source_width / preprocessing.source_height
          : undefined,
      characters: currVa?.characters || [],
      subjects: currVa?.subjects || [],
      textElements: currVa?.text_elements || currVa?.text || [],
      scene: currVa?.scene,
      actions: currVa?.action || [],
      visualFocus: currVa?.visual_focus,
    };

    let previousContext: PanelContextSummary | undefined = undefined;
    const validSourceEntityIds = new Set<string>();

    if (previousPanel) {
      const prevVa = previousPanel.visual_analysis;
      const prevId = previousPanel.panel_id || previousPanel.id;
      previousContext = {
        panelId: prevId,
        order: previousPanel.order,
        characters: prevVa?.characters || [],
        subjects: prevVa?.subjects || [],
        textElements: prevVa?.text_elements || prevVa?.text || [],
        scene: prevVa?.scene,
        actions: prevVa?.action || [],
        visualFocus: prevVa?.visual_focus,
      };

      prevVa?.characters?.forEach(c => validSourceEntityIds.add(c.detection_id));
      prevVa?.subjects?.forEach(s => validSourceEntityIds.add(s.subject_id));
      (prevVa?.text_elements || prevVa?.text)?.forEach(t => validSourceEntityIds.add(t.text_id));
      prevVa?.action?.forEach(a => validSourceEntityIds.add(a.action_id));
    }

    let nextContext: PanelContextSummary | undefined = undefined;
    if (nextPanel) {
      const nextVa = nextPanel.visual_analysis;
      const nextId = nextPanel.panel_id || nextPanel.id;
      nextContext = {
        panelId: nextId,
        order: nextPanel.order,
        characters: nextVa?.characters || [],
        subjects: nextVa?.subjects || [],
        textElements: nextVa?.text_elements || nextVa?.text || [],
        scene: nextVa?.scene,
        actions: nextVa?.action || [],
        visualFocus: nextVa?.visual_focus,
      };
    }

    const validTargetEntityIds = new Set<string>();
    currVa?.characters?.forEach(c => validTargetEntityIds.add(c.detection_id));
    currVa?.subjects?.forEach(s => validTargetEntityIds.add(s.subject_id));
    (currVa?.text_elements || currVa?.text)?.forEach(t => validTargetEntityIds.add(t.text_id));
    currVa?.action?.forEach(a => validTargetEntityIds.add(a.action_id));

    const provider = this.getActiveProvider();

    // 5. Delegate to Vision Analysis Provider
    let providerOutput;
    try {
      providerOutput = await provider.analyzePanelContinuity(
        {
          currentImageBlob: currentBlob,
          previousImageBlob: previousProxyResult?.blob,
          nextImageBlob: nextProxyResult?.blob,
          currentPanelId,
          previousPanelId: previousPanel ? (previousPanel.panel_id || previousPanel.id) : undefined,
          nextPanelId: nextPanel ? (nextPanel.panel_id || nextPanel.id) : undefined,
          currentContext,
          previousContext,
          nextContext,
        },
        context?.signal
      );
    } catch (err: any) {
      if (err.code && err.stage) {
        throw err;
      }
      throw {
        code: 'PROVIDER_ERROR',
        stage: 'continuity',
        message: err.message || 'Vision provider failed during visual continuity analysis',
        retryable: true,
        occurred_at: new Date().toISOString(),
        details: err,
      } as AnalysisError;
    }

    // 6. Defensive Normalization & Zod Validation with Reference Checks
    const normalizedResult = normalizeAndValidateAIContinuityAnalysis(
      providerOutput.raw,
      providerOutput.provenance,
      {
        currentPanelId,
        previousPanelId: previousPanel ? (previousPanel.panel_id || previousPanel.id) : undefined,
        nextPanelId: nextPanel ? (nextPanel.panel_id || nextPanel.id) : undefined,
        validSourceEntityIds,
        validTargetEntityIds,
      }
    );

    return normalizedResult;
  }
}
