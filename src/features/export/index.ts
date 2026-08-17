/**
 * Feature: Export Service & Downstream Target Formats
 */
import { Project } from '../../types';

export interface ProjectExportOptions {
  includeBinaryBlobs?: boolean;
  prettyPrint?: boolean;
  targetSchemaVersion?: string;
}

export interface ProjectExporter {
  exportJson(project: Project, options?: ProjectExportOptions): string;
}
