/**
 * Part 1.5 — Pre-Analysis Validation & Readiness Gate Types
 * Canonical data structures for deep project readiness verification
 */

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type CheckCategory =
  | 'schema'
  | 'panel_identity'
  | 'source_image_identity'
  | 'filename_integrity'
  | 'binary_availability'
  | 'image_readability'
  | 'image_dimensions'
  | 'relationships'
  | 'sequence_integrity'
  | 'original_import_sequence'
  | 'duplicate_ids'
  | 'sequence_continuity'
  | 'unsupported_assets'
  | 'missing_assets'
  | 'corrupted_assets'
  | 'storage_consistency';

export type ReadinessState = 'READY' | 'READY_WITH_WARNINGS' | 'BLOCKED';

export interface ValidationCheck {
  check_id: string;
  category: CheckCategory;
  name: string;
  severity: ValidationSeverity;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string[];
  affected_panel_ids?: string[];
  affected_image_ids?: string[];
}

export interface ValidationSummary {
  total_panels: number;
  total_images: number;
  valid_assets: number;
  missing_assets: number;
  corrupted_assets: number;
  schema_errors: number;
  identity_errors: number;
  ordering_errors: number;
  storage_errors: number;
  total_errors: number;
  total_warnings: number;
  total_checks_run: number;
}

export interface ValidationReport {
  project_id: string;
  project_title: string;
  schema_version: string;
  readiness: ReadinessState;
  readiness_reason: string;
  summary: ValidationSummary;
  checks: ValidationCheck[];
  errors: ValidationCheck[];
  warnings: ValidationCheck[];
  generated_at: string;
}
