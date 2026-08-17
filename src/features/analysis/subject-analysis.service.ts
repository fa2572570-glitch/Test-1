/**
 * Part 2.4 — Panel Character, Face & Subject Detection Analysis Service
 * 
 * High-level orchestration service for single-panel and lightweight batch
 * subject/character detection with project store integration, IndexedDB persistence,
 * and structured error handling.
 */

import { Panel, Subject, CharacterDetection, AnalysisError } from '../../types';
import { SubjectDetectionStageAnalyzer } from '../../engines/visual-analysis/subjects';
import { IVisionAnalysisProvider } from '../../services/ai';
import { useProjectStore } from '../../stores/project.store';

export interface SubjectAnalysisServiceOptions {
  provider?: IVisionAnalysisProvider;
  forceReanalysis?: boolean;
  readingDirection?: 'top-to-bottom' | 'right-to-left' | 'left-to-right';
  signal?: AbortSignal;
}

export interface SubjectAnalysisResult {
  success: boolean;
  panelId: string;
  subjects?: Subject[];
  characters?: CharacterDetection[];
  error?: AnalysisError;
}

/**
 * Analyzes subjects, characters, faces, postures, and spatial boxes for a single panel.
 */
export async function analyzePanelSubjects(
  panelId: string,
  options?: SubjectAnalysisServiceOptions
): Promise<SubjectAnalysisResult> {
  const store = useProjectStore.getState();
  const currentProject = store.currentProject;

  if (!currentProject) {
    const err: AnalysisError = {
      code: 'NO_ACTIVE_PROJECT',
      stage: 'subjects',
      message: 'Cannot run subject detection without an active project',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  const panel = currentProject.panels.find((p) => p.id === panelId || p.panel_id === panelId);
  if (!panel) {
    const err: AnalysisError = {
      code: 'PANEL_NOT_FOUND',
      stage: 'subjects',
      message: `Panel with id ${panelId} was not found in project`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    return { success: false, panelId, error: err };
  }

  // Avoid redundant analysis if valid result already exists and reanalysis is not forced
  if (
    !options?.forceReanalysis &&
    panel.visual_analysis?.subjects &&
    panel.visual_analysis?.stages?.subjects === 'COMPLETED'
  ) {
    return {
      success: true,
      panelId,
      subjects: panel.visual_analysis.subjects,
      characters: panel.visual_analysis.characters,
    };
  }

  // Set stage status to ANALYZING in project store
  await store.updatePanelVisualAnalysis(panelId, {
    stages: {
      ...panel.visual_analysis?.stages,
      subjects: 'ANALYZING',
      characters: 'ANALYZING',
    },
    error: undefined,
  });

  const analyzer = new SubjectDetectionStageAnalyzer({ provider: options?.provider });

  try {
    const { subjects, characters } = await analyzer.detectSubjects(
      panel,
      panel.visual_analysis?.preprocessing,
      {
        readingDirection: options?.readingDirection,
        signal: options?.signal,
      }
    );

    // Compute average confidence if available
    const allConfidences = [
      ...subjects.map((s) => s.confidence),
      ...characters.map((c) => c.confidence),
    ].filter((c) => typeof c === 'number' && !isNaN(c));

    const avgConfidence = allConfidences.length > 0
      ? Number((allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length).toFixed(3))
      : undefined;

    // Save successful subject detection result
    await store.updatePanelVisualAnalysis(panelId, {
      subjects,
      characters,
      confidence: avgConfidence ?? panel.visual_analysis?.confidence,
      stages: {
        ...panel.visual_analysis?.stages,
        subjects: 'COMPLETED',
        characters: 'COMPLETED',
      },
      error: undefined,
    });

    return {
      success: true,
      panelId,
      subjects,
      characters,
    };
  } catch (err: any) {
    const structuredError: AnalysisError =
      err && typeof err === 'object' && err.code && err.stage
        ? (err as AnalysisError)
        : {
            code: 'ANALYSIS_EXECUTION_FAILED',
            stage: 'subjects',
            message: err instanceof Error ? err.message : String(err),
            retryable: true,
            occurred_at: new Date().toISOString(),
          };

    // Store structured failure in project store
    await store.updatePanelVisualAnalysis(panelId, {
      stages: {
        ...panel.visual_analysis?.stages,
        subjects: 'FAILED',
        characters: 'FAILED',
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
 * Limited lightweight batch subject detection analysis helper
 */
export async function analyzePanelsSubjectsBatch(
  panelIds: string[],
  options?: SubjectAnalysisServiceOptions & {
    concurrency?: number;
    onProgress?: (completed: number, total: number, latestResult: SubjectAnalysisResult) => void;
  }
): Promise<SubjectAnalysisResult[]> {
  const results: SubjectAnalysisResult[] = [];
  const total = panelIds.length;
  let completed = 0;

  for (const pid of panelIds) {
    if (options?.signal?.aborted) {
      break;
    }
    const res = await analyzePanelSubjects(pid, options);
    results.push(res);
    completed++;
    if (options?.onProgress) {
      options.onProgress(completed, total, res);
    }
  }

  return results;
}
