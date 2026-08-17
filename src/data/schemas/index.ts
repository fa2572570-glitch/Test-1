import { ZodError } from 'zod';
import { ProjectSchema } from './project.schema';
import { Project } from '../../types';

export * from './coordinates.schema';
export * from './project.schema';
export * from './visual-analysis.schema';

export interface ValidationErrorDetail {
  path: string;
  message: string;
  code: string;
}

export interface ProjectValidationResult {
  valid: boolean;
  data?: Project;
  errors?: ValidationErrorDetail[];
  errorSummary?: string;
}

/**
 * Public validation entry point.
 * Validates any object against the canonical Project schema.
 * Returns a structured result with detailed path-based errors.
 */
export function validateProject(data: unknown): ProjectValidationResult {
  try {
    const parsed = ProjectSchema.parse(data) as Project;
    return {
      valid: true,
      data: parsed,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues || [];
      const errors: ValidationErrorDetail[] = issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      return {
        valid: false,
        errors,
        errorSummary: `${errors.length} validation issue(s) detected: ${errors.map((e) => `[${e.path || 'root'}]: ${e.message}`).join(', ')}`,
      };
    }
    return {
      valid: false,
      errors: [
        {
          path: 'root',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'custom',
        },
      ],
      errorSummary: 'Non-schema validation failure occurred.',
    };
  }
}
