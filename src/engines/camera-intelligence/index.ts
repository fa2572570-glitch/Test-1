/**
 * Engine Interface: Camera Intelligence & Trajectory Planner
 */
import { Panel, CameraAnalysisExtension } from '../../types';

export interface CameraIntelligenceEngine {
  planPanelCameraMotion(panel: Panel, aspectRatio: string): Promise<CameraAnalysisExtension>;
}
