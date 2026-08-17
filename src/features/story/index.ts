/**
 * Feature: Story Structure & Scripting
 * Extension point for scene division, character rosters, and event timelines
 */
import { Scene, Character, StoryEvent, StoryMap } from '../../types';

export interface StoryStructureService {
  buildScenes(panelIds: string[]): Promise<Scene[]>;
  extractCharacters(projectSummary: string): Promise<Character[]>;
  generateStoryMap(scenes: Scene[], events: StoryEvent[]): Promise<StoryMap>;
}
