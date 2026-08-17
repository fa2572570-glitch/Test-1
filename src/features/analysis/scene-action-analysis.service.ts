/**
 * Part 2.6 — Panel Scene Context & Physical Action Analysis Service
 * 
 * High-level orchestration service for single-panel and lightweight batch
 * scene setting and physical action observation with project store integration,
 * IndexedDB persistence, and structured error handling.
 */

import { Panel, SceneContext, ActionObservation, AnalysisError } from '../../types';
import { SceneAndActionStageAnalyzer } from '../../engines/visual-analysis/scene-action';
import { IVisionAnalysisProvider } from '../../services/ai';
import { useProjectStore } from '../../stores/project.store';

export interface SceneActionAnalysisServiceOptions {
  provider?: IVisionAnalysisProvider;
  forceReanalysis?: boolean;
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  signal?: AbortSignal;
}

export interface SceneActionAnalysisResult {
  success: boolean;
  panelId: string;
  scene?: SceneContext;
  actions?: ActionObservation[];
  error?: AnalysisError;
}

/**
 * Analyzes scene environmental setting and physical actions for a single panel.
 */
export async function analyzePanelSceneAndAction(
  panelId: string,
  options?: SceneActionAnalysisServiceOptions
): Promise<SceneActionAnalysisResult> {
  const store = useProjectStore.getState();
  const currentProject = store.currentProject;

  if (!currentProject) {
    const err: AnalysisError = {
      code: 'NO_ACTIVE_PROJECT',
      stage: 'scene_and_action',
      message: 'Cannot run scene & action analysis without an active project',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panel = currentProject.panels.find((p) => p.id === panelId || p.panel_id === panelId);
  if (!panel) {
    const err: AnalysisError = {
      code: 'PANEL_NOT_FOUND',
      stage: 'scene_and_action',
      message: `Panel with id ${panelId} was not found in project`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  // Avoid redundant analysis if valid result already exists and reanalysis is not forced
  if (
    !options?.forceReanalysis &&
    panel.visual_analysis?.scene &&
    panel.visual_analysis?.stages?.scene === 'COMPLETED' &&
    panel.visual_analysis?.stages?.action === 'COMPLETED'
  ) {
    return {
      success: true,
      panelId,
      scene: panel.visual_analysis.scene,
      actions: panel.visual_analysis.action || [],
    };
  }

  // Set stage status to ANALYZING in project store
  await store.updatePanelVisualAnalysis(panelId, {
    stages: {
      ...panel.visual_analysis?.stages,
      scene: 'ANALYZING',
      action: 'ANALYZING',
    },
    error: undefined,
  });

  const analyzer = new SceneAndActionStageAnalyzer({ provider: options?.provider });

  try {
    const { scene, actions } = await analyzer.analyzeSceneAndAction(
      panel,
      panel.visual_analysis?.preprocessing,
      {
        readingDirection: options?.readingDirection,
        signal: options?.signal,
      }
    );

    // Compute average confidence from scene and actions
    const confidences: number[] = [];
    if (scene?.confidence) confidences.push(scene.confidence);
    actions.forEach((a) => {
      if (typeof a.confidence === 'number') confidences.push(a.confidence);
    });

    const avgConfidence =
      confidences.length > 0
        ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3))
        : undefined;

    // Save successful scene & action detection result
    await store.updatePanelVisualAnalysis(panelId, {
      scene,
      action: actions,
      confidence: avgConfidence ?? panel.visual_analysis?.confidence,
      stages: {
        ...panel.visual_analysis?.stages,
        scene: 'COMPLETED',
        action: 'COMPLETED',
      },
      error: undefined,
    });

    return {
      success: true,
      panelId,
      scene,
      actions,
    };
  } catch (err: any) {
    const structuredError: AnalysisError =
      err && typeof err === 'object' && err.code && err.stage
        ? (err as AnalysisError)
        : {
            code: 'ANALYSIS_EXECUTION_FAILED',
            stage: 'scene_and_action',
            message: err instanceof Error ? err.message : String(err),
            retryable: true,
            occurred_at: new Date().toISOString(),
          };

    // Store structured failure in project store
    await store.updatePanelVisualAnalysis(panelId, {
      stages: {
        ...panel.visual_analysis?.stages,
        scene: 'FAILED',
        action: 'FAILED',
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
 * Sequentially analyzes multiple panels for scene setting and physical actions.
 */
export async function analyzePanelsSceneAndActionBatch(
  panelIds: string[],
  options?: SceneActionAnalysisServiceOptions,
  onProgress?: (completed: number, total: number, currentPanelId: string) => void
): Promise<Map<string, SceneActionAnalysisResult>> {
  const results = new Map<string, SceneActionAnalysisResult>();
  const total = panelIds.length;

  for (let i = 0; i < total; i++) {
    const panelId = panelIds[i];
    if (options?.signal?.aborted) break;

    onProgress?.(i, total, panelId);
    const result = await analyzePanelSceneAndAction(panelId, options);
    results.set(panelId, result);
    onProgress?.(i + 1, total, panelId);
  }

  return results;
}
