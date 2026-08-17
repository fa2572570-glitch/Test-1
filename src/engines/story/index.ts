/**
 * Story Intelligence Engine
 * Handles narrative flow parsing, character relationship tracking, and pacing analytics
 */
import { StoryEvent, StoryMap } from '../../types';

export interface StoryEngine {
  analyzePacing(events: StoryEvent[]): string;
  synthesizeStoryMap(events: StoryEvent[]): StoryMap;
}
