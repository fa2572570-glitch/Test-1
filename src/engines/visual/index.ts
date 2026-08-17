/**
 * Visual Analysis Engine
 * Handles panel boundary detection, character segmentation, and visual composition
 */
import { Panel, Region } from '../../types';

export interface VisualEngine {
  segmentPanels(imageBitmap: ImageBitmap): Promise<Panel[]>;
  detectFocalPoints(panelBoundary: Region): Promise<Region[]>;
}
