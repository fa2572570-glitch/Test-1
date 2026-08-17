/**
 * Stable ID Generator
 * Generates collision-resistant, sortable, prefixed identifiers.
 */

export type IdPrefix = 'proj' | 'img' | 'pnl' | 'chr' | 'scn' | 'evt' | 'stmap' | 'reg' | 'bub';

export function generateStableId(prefix: IdPrefix = 'proj'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${randomPart}`;
}
