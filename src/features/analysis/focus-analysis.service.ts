/**
 * Part 2.7 — Panel Visual Salience, Focus & Camera-Safe Region Analysis Service
 * 
 * High-level orchestration service for single-panel and lightweight batch
 * visual focus, salience hierarchy, and descriptive camera region analysis with
 * project store integration, IndexedDB persistence, and structured error handling.
 */

import { Panel, VisualFocus, CameraAnalysis, AnalysisError } from '../../types';
import { FocusAndCameraStageAnalyzer } from '../../engines/visual-analysis/focus-salience';
import { IVisionAnalysisProvider } from '../../services/ai';
import { useProjectStore } from '../../stores/project.store';

export interface FocusAnalysisServiceOptions {
  provider?: IVisionAnalysisProvider;
  forceReanalysis?: boolean;
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  signal?: AbortSignal;
}

export interface FocusAnalysisResult {
  success: boolean;
  panelId: string;
  visualFocus?: VisualFocus;
  cameraAnalysis?: CameraAnalysis;
  error?: AnalysisError;
}

/**
 * Analyzes visual salience, focal points, and descriptive camera-safe interest regions for a single panel.
 */
export async function analyzePanelFocus(
  panelId: string,
  options?: FocusAnalysisServiceOptions
): Promise<FocusAnalysisResult> {
  const store = useProjectStore.getState();
  const currentProject = store.currentProject;

  if (!currentProject) {
    const err: AnalysisError = {
      code: 'NO_ACTIVE_PROJECT',
      stage: 'focus',
      message: 'Cannot run visual focus analysis without an active project',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panel = currentProject.panels.find((p) => p.id === panelId || p.panel_id === panelId);
  if (!panel) {
    const err: AnalysisError = {
      code: 'PANEL_NOT_FOUND',
      stage: 'focus',
      message: `Panel with id ${panelId} was not found in project`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  // Avoid redundant analysis if valid result already exists and reanalysis is not forced
  if (
    !options?.forceReanalysis &&
    panel.visual_analysis?.visual_focus &&
    panel.visual_analysis?.stages?.focus === 'COMPLETED'
  ) {
    return {
      success: true,
      panelId,
      visualFocus: panel.visual_analysis.visual_focus,
      cameraAnalysis: panel.visual_analysis.camera,
    };
  }

  // Set stage status to ANALYZING in project store
  await store.updatePanelVisualAnalysis(panelId, {
    stages: {
      ...panel.visual_analysis?.stages,
      focus: 'ANALYZING',
      camera: 'ANALYZING',
    },
    error: undefined,
  });

  const analyzer = new FocusAndCameraStageAnalyzer({ provider: options?.provider });

  try {
    const { visualFocus, cameraAnalysis } = await analyzer.analyzeFocusAndCamera(
      panel,
      panel.visual_analysis?.preprocessing,
      panel.visual_analysis?.subjects,
      panel.visual_analysis?.text_elements,
      {
        readingDirection: options?.readingDirection,
        signal: options?.signal,
      }
    );

    // Compute stage confidence
    const confidence = visualFocus.confidence ?? 0.88;

    // Update panel analysis in Zustand project store and trigger IndexedDB persistence
    await store.updatePanelVisualAnalysis(panelId, {
      visual_focus: visualFocus,
      camera: cameraAnalysis,
      stages: {
        ...panel.visual_analysis?.stages,
        focus: 'COMPLETED',
        camera: 'COMPLETED',
      },
      confidence: panel.visual_analysis?.confidence
        ? Math.round(((panel.visual_analysis.confidence + confidence) / 2) * 100) / 100
        : confidence,
      error: undefined,
    });

    return {
      success: true,
      panelId,
      visualFocus,
      cameraAnalysis,
    };
  } catch (err: any) {
    const structuredError: AnalysisError =
      err && err.code && err.stage
        ? err
        : {
            code: 'FOCUS_ANALYSIS_FAILED',
            stage: 'focus',
            message: err.message || 'Visual focus analysis failed',
            retryable: true,
            occurred_at: new Date().toISOString(),
            details: err,
          };

    // Update stage status to FAILED in store with error metadata
    await store.updatePanelVisualAnalysis(panelId, {
      stages: {
        ...panel.visual_analysis?.stages,
        focus: 'FAILED',
        camera: 'FAILED',
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
 * Batch analysis utility to run visual focus & salience detection across multiple panels sequentially.
 */
export async function analyzePanelsFocusBatch(
  panelIds: string[],
  options?: FocusAnalysisServiceOptions,
  onProgress?: (completed: number, total: number, currentPanelId: string) => void
): Promise<FocusAnalysisResult[]> {
  const results: FocusAnalysisResult[] = [];
  const total = panelIds.length;

  for (let i = 0; i < total; i++) {
    const pId = panelIds[i];
    if (options?.signal?.aborted) {
      break;
    }

    if (onProgress) {
      onProgress(i, total, pId);
    }

    const res = await analyzePanelFocus(pId, options);
    results.push(res);
  }

  if (onProgress) {
    onProgress(total, total, panelIds[panelIds.length - 1] || '');
  }

  return results;
}
