/**
 * Visual Analysis Engine & Modular Stage Contracts (Part 2.1, 2.2, 2.3, 2.4)
 */
export * from './contracts';
export * from './preprocessing';
export * from './composition';
export * from './subjects';
export * from './text';
export * from './scene-action';
export * from './focus-salience';
export * from './continuity';

// Legacy compatibility alias
export type { IVisualAnalysisEngine as VisualAnalysisEngine } from './contracts';

