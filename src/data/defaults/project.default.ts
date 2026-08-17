import { Project, ProjectMetadata, ProjectSettings } from '../../types';
import { generateStableId } from '../../utils/id';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  target_aspect_ratio: '9:16',
  reading_direction: 'top-to-bottom',
  export_target_fps: 30,
  auto_save_interval_ms: 30000,
  preferred_resolution: {
    width: 1080,
    height: 1920,
  },
};

/**
 * Creates a clean, canonically structured Project adhering strictly to Schema 1.0.0.
 */
export function createDefaultProject(overrides?: {
  title?: string;
  metadata?: Partial<ProjectMetadata>;
  settings?: Partial<ProjectSettings>;
}): Project {
  const projectId = generateStableId('proj');
  const now = new Date().toISOString();

  const title = overrides?.title?.trim() || overrides?.metadata?.title?.trim() || 'Untitled Manhwa Project';

  const metadata: ProjectMetadata = {
    id: projectId,
    title,
    series_name: overrides?.metadata?.series_name || '',
    chapter_number: overrides?.metadata?.chapter_number,
    author: overrides?.metadata?.author || '',
    description: overrides?.metadata?.description || '',
    tags: overrides?.metadata?.tags || [],
    created_at: now,
    updated_at: now,
  };

  const settings: ProjectSettings = {
    ...DEFAULT_PROJECT_SETTINGS,
    ...overrides?.settings,
  };

  return {
    id: projectId,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    metadata,
    settings,
    images: [],
    panels: [],
    characters: [],
    scenes: [],
    events: [],
    storyMap: {
      id: generateStableId('stmap'),
      summary: '',
      themes: [],
      pacing: 'moderate',
      act_structure: [],
      updated_at: now,
    },
    analysisStatus: {
      stage: 'idle',
      progress: 0,
      completed_stages: [],
    },
  };
}
