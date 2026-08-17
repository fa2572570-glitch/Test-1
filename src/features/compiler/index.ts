/**
 * Feature: Production Storyboard Compiler
 * Extension point for compiling scenes, speech bubbles, and camera shots into master timeline
 */
import { Project } from '../../types';

export interface CompiledTimelineTrack {
  id: string;
  duration: number;
  keyframes: Array<{ time: number; transform: string }>;
}

export interface CompilerService {
  compileProjectTimeline(project: Project): CompiledTimelineTrack[];
}
