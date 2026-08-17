/**
 * Feature: Camera Intelligence & Motion Directing
 * Extension point for dynamic viewport framing and cinematic transitions
 */
import { Panel, CameraAnalysisExtension } from '../../types';

export interface CameraDirectorService {
  computeCameraMotion(panel: Panel, aspectRatio: string): Promise<CameraAnalysisExtension>;
}
