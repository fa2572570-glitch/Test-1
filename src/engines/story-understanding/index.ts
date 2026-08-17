/**
 * Engine Interface: Story & Narrative Understanding Engine
 */
import { StoryEvent, Scene, StoryMap, Panel } from '../../types';

export interface StoryUnderstandingEngine {
  structureScenes(panels: Panel[]): Promise<Scene[]>;
  extractEvents(scenes: Scene[], panels: Panel[]): Promise<StoryEvent[]>;
}
