/**
 * Part 2.3 — Panel Composition & Visual Structure Analysis Service
 * 
 * High-level orchestration service for single-panel and lightweight batch
 * composition analysis with project store integration, IndexedDB persistence,
 * and structured error handling.
 */

import { Panel, CompositionAnalysis, AnalysisError } from '../../types';
import { CompositionStageAnalyzer } from '../../engines/visual-analysis/composition';
import { IVisionAnalysisProvider } from '../../services/ai';
import { useProjectStore } from '../../stores/project.store';

export interface CompositionAnalysisServiceOptions {
  provider?: IVisionAnalysisProvider;
  forceReanalysis?: boolean;
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  signal?: AbortSignal;
}

export interface CompositionAnalysisResult {
  success: boolean;
  panelId: string;
  composition?: CompositionAnalysis;
  error?: AnalysisError;
}

/**
 * Analyzes visual composition for a single panel.
 */
export async function analyzePanelComposition(
  panelId: string,
  options?: CompositionAnalysisServiceOptions
): Promise<CompositionAnalysisResult> {
  const store = useProjectStore.getState();
  const currentProject = store.currentProject;

  if (!currentProject) {
    const err: AnalysisError = {
      code: 'NO_ACTIVE_PROJECT',
      stage: 'composition',
      message: 'Cannot run composition analysis without an active project',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panel = currentProject.panels.find((p) => p.id === panelId || p.panel_id === panelId);
  if (!panel) {
    const err: AnalysisError = {
      code: 'PANEL_NOT_FOUND',
      stage: 'composition',
      message: `Panel with id ${panelId} was not found in project`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  // Section 30: Avoid redundant analysis if valid result already exists and reanalysis is not forced
  if (
    !options?.forceReanalysis &&
    panel.visual_analysis?.composition &&
    panel.visual_analysis?.stages?.composition === 'COMPLETED'
  ) {
    return {
      success: true,
      panelId,
      composition: panel.visual_analysis.composition,
    };
  }

  // Set stage status to ANALYZING in project store
  await store.updatePanelVisualAnalysis(panelId, {
    stages: {
      ...panel.visual_analysis?.stages,
      composition: 'ANALYZING',
    },
    error: undefined,
  });

  const analyzer = new CompositionStageAnalyzer({ provider: options?.provider });

  try {
    const composition = await analyzer.analyzeComposition(
      panel,
      panel.visual_analysis?.preprocessing,
      {
        readingDirection: options?.readingDirection,
        signal: options?.signal,
      }
    );

    // Save successful composition result
    await store.updatePanelVisualAnalysis(panelId, {
      composition,
      confidence: composition.confidence ?? panel.visual_analysis?.confidence,
      stages: {
        ...panel.visual_analysis?.stages,
        composition: 'COMPLETED',
      },
      error: undefined,
    });

    return {
      success: true,
      panelId,
      composition,
    };
  } catch (err: any) {
    const structuredError: AnalysisError =
      err && typeof err === 'object' && err.code && err.stage
        ? (err as AnalysisError)
        : {
            code: 'ANALYSIS_EXECUTION_FAILED',
            stage: 'composition',
            message: err instanceof Error ? err.message : String(err),
            retryable: true,
            occurred_at: new Date().toISOString(),
          };

    // Store structured failure in project store
    await store.updatePanelVisualAnalysis(panelId, {
      stages: {
        ...panel.visual_analysis?.stages,
        composition: 'FAILED',
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
 * Limited lightweight batch composition analysis helper (Section 29)
 */
export async function analyzePanelsCompositionBatch(
  panelIds: string[],
  options?: CompositionAnalysisServiceOptions & {
    concurrency?: number;
    onProgress?: (completed: number, total: number, latestResult: CompositionAnalysisResult) => void;
  }
): Promise<CompositionAnalysisResult[]> {
  const results: CompositionAnalysisResult[] = [];
  const total = panelIds.length;
  let completed = 0;

  for (const pid of panelIds) {
    if (options?.signal?.aborted) {
      break;
    }
    const res = await analyzePanelComposition(pid, options);
    results.push(res);
    completed++;
    options?.onProgress?.(completed, total, res);
  }

  return results;
}
