/**
 * Validation Engine
 * Deep graph integrity analyzer checking for schema compliance, panel identities,
 * storage consistency, binary availability, and canonical 0-based sequence integrity.
 */
import { Project } from '../../types';
import { ProjectValidationResult, validateProject } from '../../data/schemas';
import { validateProjectForAnalysis } from '../../features/validation/project-validation.service';
import { ValidationReport } from '../../features/validation/types';

export * from '../../features/validation/types';
export * from '../../features/validation/project-validation.service';

export interface IntegrityReport {
  isHealthy: boolean;
  orphanedPanelsCount: number;
  missingImagesCount: number;
  invalidBoundsCount: number;
  details: string[];
}

export interface ValidationEngine {
  runDeepIntegrityCheck(project: Project): IntegrityReport;
  validateAgainstSchema(project: unknown): ProjectValidationResult;
  validatePreAnalysisReadiness(project: Project): Promise<ValidationReport>;
}

export const validationEngine: ValidationEngine = {
  runDeepIntegrityCheck(project: Project): IntegrityReport {
    const imageIds = new Set(project.images.map((i) => i.image_id));
    let orphanedPanelsCount = 0;
    let missingImagesCount = 0;
    let invalidBoundsCount = 0;
    const details: string[] = [];

    for (const p of project.panels) {
      if (!imageIds.has(p.image_id)) {
        orphanedPanelsCount++;
        details.push(`Panel ${p.id} references missing image ${p.image_id}`);
      }
      if (
        p.boundary.x < 0 ||
        p.boundary.y < 0 ||
        p.boundary.width <= 0 ||
        p.boundary.height <= 0 ||
        p.boundary.x + p.boundary.width > 1.0001 ||
        p.boundary.y + p.boundary.height > 1.0001
      ) {
        invalidBoundsCount++;
        details.push(`Panel ${p.id} has out-of-bounds coordinates`);
      }
    }

    const linkedImageIds = new Set(project.panels.map((p) => p.image_id));
    for (const img of project.images) {
      if (!linkedImageIds.has(img.image_id)) {
        missingImagesCount++;
      }
    }

    const isHealthy = orphanedPanelsCount === 0 && invalidBoundsCount === 0;

    return {
      isHealthy,
      orphanedPanelsCount,
      missingImagesCount,
      invalidBoundsCount,
      details,
    };
  },

  validateAgainstSchema(project: unknown): ProjectValidationResult {
    return validateProject(project);
  },

  async validatePreAnalysisReadiness(project: Project): Promise<ValidationReport> {
    return validateProjectForAnalysis(project);
  },
};
