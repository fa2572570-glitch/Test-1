import { Project } from '../../types';
import { V1_SCHEMA_VERSION, normalizeV1Project } from './v1';
import { CURRENT_SCHEMA_VERSION } from '../defaults/project.default';
import { validateProject, ProjectValidationResult } from '../schemas';

export * from './v1';

export interface MigrationResult {
  migrated: boolean;
  project: Project;
  originalVersion: string;
  currentVersion: string;
  logs: string[];
}

/**
 * Migration registry mapping version transitions
 */
const MIGRATION_REGISTRY: Record<string, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // Future transitions will be registered here (e.g. '1.0.0->1.1.0': migrateV1ToV1_1)
};

/**
 * Migrates any given project payload to the current schema version if required.
 */
export function migrateProject(rawProject: unknown): MigrationResult {
  if (!rawProject || typeof rawProject !== 'object') {
    throw new Error('Invalid project data supplied for migration.');
  }

  const record = { ...(rawProject as Record<string, unknown>) };
  const rawVersion = typeof record.schemaVersion === 'string' ? record.schemaVersion : 'unknown';
  const logs: string[] = [];

  let currentVersion = rawVersion;
  let currentData = record;

  if (rawVersion === 'unknown' || !rawVersion.startsWith('1.')) {
    logs.push(`Detected untagged or legacy schema. Initializing to v${V1_SCHEMA_VERSION}...`);
    currentData.schemaVersion = V1_SCHEMA_VERSION;
    currentVersion = V1_SCHEMA_VERSION;
  }

  // If already matches current schema version, run validation directly
  if (currentVersion === CURRENT_SCHEMA_VERSION) {
    const project = normalizeV1Project(currentData);
    return {
      migrated: rawVersion !== CURRENT_SCHEMA_VERSION,
      project,
      originalVersion: rawVersion,
      currentVersion: CURRENT_SCHEMA_VERSION,
      logs: logs.length ? logs : ['Project schema is up to date (v1.0.0).'],
    };
  }

  const project = normalizeV1Project(currentData);
  return {
    migrated: true,
    project,
    originalVersion: rawVersion,
    currentVersion: CURRENT_SCHEMA_VERSION,
    logs,
  };
}

/**
 * Checks if a project data structure requires schema migration
 */
export function checkNeedsMigration(rawProject: unknown): {
  needsMigration: boolean;
  currentVersion: string;
  targetVersion: string;
} {
  if (!rawProject || typeof rawProject !== 'object') {
    return {
      needsMigration: true,
      currentVersion: 'invalid',
      targetVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  const version = (rawProject as { schemaVersion?: string }).schemaVersion || 'unknown';
  return {
    needsMigration: version !== CURRENT_SCHEMA_VERSION,
    currentVersion: version,
    targetVersion: CURRENT_SCHEMA_VERSION,
  };
}
