/**
 * Compiler Engine
 * Formats multi-track render timeline instructions for external motion studios
 */
import { Project } from '../../types';

export interface ExportPackageManifest {
  manifestVersion: string;
  projectId: string;
  totalDurationFrames: number;
  tracks: Array<Record<string, unknown>>;
}

export interface CompilerEngine {
  buildManifest(project: Project): ExportPackageManifest;
}
