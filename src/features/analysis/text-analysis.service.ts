/**
 * Part 2.5 — Panel Dialogue, Text, Speech-Bubble & SFX Analysis Service
 * 
 * High-level orchestration service for single-panel and lightweight batch
 * text element detection and OCR extraction with project store integration,
 * IndexedDB persistence, and structured error handling.
 */

import { Panel, TextElement, AnalysisError } from '../../types';
import { TextAnalysisStageAnalyzer } from '../../engines/visual-analysis/text';
import { IVisionAnalysisProvider } from '../../services/ai';
import { useProjectStore } from '../../stores/project.store';

export interface TextAnalysisServiceOptions {
  provider?: IVisionAnalysisProvider;
  forceReanalysis?: boolean;
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  signal?: AbortSignal;
}

export interface TextAnalysisResult {
  success: boolean;
  panelId: string;
  text_elements?: TextElement[];
  error?: AnalysisError;
}

/**
 * Analyzes dialogue, speech-bubbles, thoughts, narration, and SFX for a single panel.
 */
export async function analyzePanelText(
  panelId: string,
  options?: TextAnalysisServiceOptions
): Promise<TextAnalysisResult> {
  const store = useProjectStore.getState();
  const currentProject = store.currentProject;

  if (!currentProject) {
    const err: AnalysisError = {
      code: 'NO_ACTIVE_PROJECT',
      stage: 'text',
      message: 'Cannot run text analysis without an active project',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panel = currentProject.panels.find((p) => p.id === panelId || p.panel_id === panelId);
  if (!panel) {
    const err: AnalysisError = {
      code: 'PANEL_NOT_FOUND',
      stage: 'text',
      message: `Panel with id ${panelId} was not found in project`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  // Avoid redundant analysis if valid result already exists and reanalysis is not forced
  if (
    !options?.forceReanalysis &&
    panel.visual_analysis?.text_elements &&
    panel.visual_analysis?.stages?.text === 'COMPLETED'
  ) {
    return {
      success: true,
      panelId,
      text_elements: panel.visual_analysis.text_elements,
    };
  }

  // Set stage status to ANALYZING in project store
  await store.updatePanelVisualAnalysis(panelId, {
    stages: {
      ...panel.visual_analysis?.stages,
      text: 'ANALYZING',
    },
    error: undefined,
  });

  const analyzer = new TextAnalysisStageAnalyzer({ provider: options?.provider });

  try {
    const text_elements = await analyzer.extractTextElements(
      panel,
      panel.visual_analysis?.preprocessing,
      {
        readingDirection: options?.readingDirection,
        signal: options?.signal,
      }
    );

    // Compute average confidence if available
    const confidences = text_elements
      .map((t) => t.confidence)
      .filter((c) => typeof c === 'number' && !isNaN(c));

    const avgConfidence =
      confidences.length > 0
        ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3))
        : undefined;

    // Save successful text detection result
    await store.updatePanelVisualAnalysis(panelId, {
      text_elements,
      confidence: avgConfidence ?? panel.visual_analysis?.confidence,
      stages: {
        ...panel.visual_analysis?.stages,
        text: 'COMPLETED',
      },
      error: undefined,
    });

    return {
      success: true,
      panelId,
      text_elements,
    };
  } catch (err: any) {
    const structuredError: AnalysisError =
      err && typeof err === 'object' && err.code && err.stage
        ? (err as AnalysisError)
        : {
            code: 'ANALYSIS_EXECUTION_FAILED',
            stage: 'text',
            message: err instanceof Error ? err.message : String(err),
            retryable: true,
            occurred_at: new Date().toISOString(),
          };

    // Store structured failure in project store
    await store.updatePanelVisualAnalysis(panelId, {
      stages: {
        ...panel.visual_analysis?.stages,
        text: 'FAILED',
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
 * Limited lightweight batch text detection analysis helper
 */
export async function analyzePanelsTextBatch(
  panelIds: string[],
  options?: TextAnalysisServiceOptions & {
    concurrency?: number;
    onProgress?: (completed: number, total: number, latestResult: TextAnalysisResult) => void;
  }
): Promise<TextAnalysisResult[]> {
  const concurrency = Math.max(1, Math.min(3, options?.concurrency || 2));
  const results: TextAnalysisResult[] = [];
  let completed = 0;
  const total = panelIds.length;

  const queue = [...panelIds];

  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      if (options?.signal?.aborted) {
        break;
      }
      const nextId = queue.shift();
      if (!nextId) break;

      const res = await analyzePanelText(nextId, options);
      results.push(res);
      completed++;
      if (options?.onProgress) {
        options.onProgress(completed, total, res);
      }
    }
  });

  await Promise.all(workers);
  return results;
}
