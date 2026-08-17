/**
 * Part 2.8 — Panel Visual Continuity & Cross-Panel Relationship Analysis Service
 * 
 * High-level orchestration service for single-panel and sequential batch
 * cross-panel character continuity, object persistence, action continuation,
 * scene transitions, focus shifts, and meaningful visual state changes.
 */

import { Panel, ContinuityAnalysis, AnalysisError } from '../../types';
import { ContinuityStageAnalyzer } from '../../engines/visual-analysis/continuity';
import { IVisionAnalysisProvider } from '../../services/ai';
import { useProjectStore } from '../../stores/project.store';

export interface ContinuityAnalysisServiceOptions {
  provider?: IVisionAnalysisProvider;
  forceReanalysis?: boolean;
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  signal?: AbortSignal;
}

export interface ContinuityAnalysisResult {
  success: boolean;
  panelId: string;
  continuity?: ContinuityAnalysis;
  error?: AnalysisError;
}

/**
 * Analyzes visual continuity and cross-panel relationships for a single panel
 * relative to its preceding (and optionally succeeding) panels.
 */
export async function analyzePanelContinuity(
  panelId: string,
  options?: ContinuityAnalysisServiceOptions
): Promise<ContinuityAnalysisResult> {
  const store = useProjectStore.getState();
  const currentProject = store.currentProject;

  if (!currentProject) {
    const err: AnalysisError = {
      code: 'NO_ACTIVE_PROJECT',
      stage: 'continuity',
      message: 'Cannot run visual continuity analysis without an active project',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panels = [...currentProject.panels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const panelIndex = panels.findIndex((p) => p.id === panelId || p.panel_id === panelId);

  if (panelIndex === -1) {
    const err: AnalysisError = {
      code: 'PANEL_NOT_FOUND',
      stage: 'continuity',
      message: `Panel with id ${panelId} was not found in project`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panel = panels[panelIndex];
  const previousPanel = panelIndex > 0 ? panels[panelIndex - 1] : undefined;
  const nextPanel = panelIndex < panels.length - 1 ? panels[panelIndex + 1] : undefined;

  // Avoid redundant analysis if valid result already exists and reanalysis is not forced
  if (
    !options?.forceReanalysis &&
    panel.visual_analysis?.continuity &&
    panel.visual_analysis?.stages?.continuity === 'COMPLETED'
  ) {
    return {
      success: true,
      panelId,
      continuity: panel.visual_analysis.continuity,
    };
  }

  // Set stage status to ANALYZING in project store
  await store.updatePanelVisualAnalysis(panelId, {
    stages: {
      ...panel.visual_analysis?.stages,
      continuity: 'ANALYZING',
    },
    error: undefined,
  });

  const analyzer = new ContinuityStageAnalyzer({ provider: options?.provider });

  try {
    const continuity = await analyzer.analyzeContinuity(
      panel,
      panel.visual_analysis?.preprocessing,
      previousPanel,
      nextPanel,
      {
        readingDirection: options?.readingDirection,
        signal: options?.signal,
      }
    );

    const confidence = continuity.confidence ?? 0.88;

    // Update panel analysis in Zustand project store and trigger IndexedDB persistence
    await store.updatePanelVisualAnalysis(panelId, {
      continuity,
      stages: {
        ...panel.visual_analysis?.stages,
        continuity: 'COMPLETED',
      },
      confidence: panel.visual_analysis?.confidence
        ? Math.round(((panel.visual_analysis.confidence + confidence) / 2) * 100) / 100
        : confidence,
      error: undefined,
    });

    return {
      success: true,
      panelId,
      continuity,
    };
  } catch (err: any) {
    const structuredError: AnalysisError =
      err && err.code && err.stage
        ? err
        : {
            code: 'CONTINUITY_ANALYSIS_FAILED',
            stage: 'continuity',
            message: err.message || 'Visual continuity analysis failed',
            retryable: true,
            occurred_at: new Date().toISOString(),
            details: err,
          };

    // Update stage status to FAILED in store with error metadata
    await store.updatePanelVisualAnalysis(panelId, {
      stages: {
        ...panel.visual_analysis?.stages,
        continuity: 'FAILED',
      },
      error: structuredError,
    });

    return {
      success: false,
      panelId,
      error: structuredError,
    };
  }
}

/**
 * Batch analysis utility to run visual continuity & relationship analysis across multiple panels sequentially.
 */
export async function analyzePanelsContinuityBatch(
  panelIds: string[],
  options?: ContinuityAnalysisServiceOptions,
  onProgress?: (completed: number, total: number, currentPanelId: string) => void
): Promise<ContinuityAnalysisResult[]> {
  const results: ContinuityAnalysisResult[] = [];
  const total = panelIds.length;

  for (let i = 0; i < total; i++) {
    const pId = panelIds[i];
    if (options?.signal?.aborted) {
      break;
    }

    if (onProgress) {
      onProgress(i, total, pId);
    }

    const res = await analyzePanelContinuity(pId, options);
    results.push(res);
  }

  if (onProgress && panelIds.length > 0) {
    onProgress(total, total, panelIds[panelIds.length - 1] || '');
  }

  return results;
}
