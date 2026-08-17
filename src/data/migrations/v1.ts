import { Project } from '../../types';
import { validateProject } from '../schemas';

/**
 * Migration definition for Schema v1.0.0
 * Acts as the baseline schema reference.
 */
export const V1_SCHEMA_VERSION = '1.0.0';

export interface MigrationStep {
  fromVersion: string;
  toVersion: string;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * v1.0.0 baseline initializer / normalizer
 */
export function normalizeV1Project(raw: Record<string, unknown>): Project {
  // Ensure schemaVersion is set
  const normalized = {
    ...raw,
    schemaVersion: V1_SCHEMA_VERSION,
  };

  const validation = validateProject(normalized);
  if (!validation.valid || !validation.data) {
    throw new Error(`Failed to normalize project to v1.0.0: ${validation.errorSummary}`);
  }

  return validation.data;
}
