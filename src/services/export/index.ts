/**
 * Service: Export Service Interface
 */
import { Project } from '../../types';

export interface ExportService {
  exportProjectJson(project: Project): string;
}
