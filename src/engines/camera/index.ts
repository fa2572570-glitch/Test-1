/**
 * Camera Motion Engine
 * Handles 2.5D camera trajectory synthesis, aspect ratio framing, and easing curves
 */
import { Panel, CameraAnalysisExtension } from '../../types';

export interface CameraEngine {
  calculatePanTrajectory(panel: Panel, targetAspectRatio: string): CameraAnalysisExtension;
}
