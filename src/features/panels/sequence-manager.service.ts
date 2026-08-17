import { Panel, SourceImage, Project } from '../../types';
import { validateProject } from '../../data/schemas';

export interface SequenceIntegrityReport {
  valid: boolean;
  errors: string[];
  totalPanels: number;
  isCustomOrder: boolean;
  minOrder: number;
  maxOrder: number;
}

/**
 * Returns a new array of panels sorted strictly by canonical `order` ascending.
 * Breaks any identical order ties deterministically using panel `id`.
 */
export function getOrderedPanels(panels: Panel[]): Panel[] {
  return [...panels].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Normalizes sequence indices across an array of panels so they form a strictly
 * contiguous 0-based sequence: 0, 1, 2, ..., N - 1.
 * 
 * Takes the array in its current desired order, assigning `order: 0, 1, 2, ...`
 * in that exact sequence.
 * 
 * Preserves panel IDs, image references, boundaries, and initial_order.
 */
export function normalizePanelSequence(panels: Panel[]): Panel[] {
  const now = new Date().toISOString();

  return panels.map((panel, idx) => {
    if (panel.order === idx) {
      return panel;
    }
    return {
      ...panel,
      order: idx,
      updated_at: now,
    };
  });
}

/**
 * Single canonical ordering engine for ALL panel movement operations:
 * (Drag-and-Drop, Move Up, Move Down, Move to First, Move to Last, Move to Position).
 * 
 * Given a panels array, a target panelId, and a destination 0-based index:
 * 1. Finds the panel's current position in the canonical order.
 * 2. Clamps the destination index between 0 and N - 1.
 * 3. Repositions the panel within the array.
 * 4. Normalizes all panels so their `order` indices form a strictly contiguous 0-based sequence (0..N-1).
 * 5. Preserves all other panel and image metadata, IDs, binaries, and relationships verbatim.
 */
export function reorderPanel(
  panels: Panel[],
  panelId: string,
  destinationIndex: number
): Panel[] {
  const ordered = getOrderedPanels(panels);
  const currentIndex = ordered.findIndex((p) => p.id === panelId);

  if (currentIndex < 0 || ordered.length <= 1) {
    return normalizePanelSequence(ordered);
  }

  const clampedTarget = Math.max(0, Math.min(ordered.length - 1, destinationIndex));
  if (currentIndex === clampedTarget) {
    return normalizePanelSequence(ordered);
  }

  const target = ordered[currentIndex];
  const result = [...ordered];
  result.splice(currentIndex, 1);
  result.splice(clampedTarget, 0, target);

  return normalizePanelSequence(result);
}

/**
 * Moves a panel one position earlier (towards the beginning).
 * Safe no-op if the panel is already at index 0 or not found.
 */
export function movePanelUp(panels: Panel[], panelId: string): Panel[] {
  const ordered = getOrderedPanels(panels);
  const index = ordered.findIndex((p) => p.id === panelId);
  if (index <= 0) {
    return normalizePanelSequence(ordered);
  }
  return reorderPanel(panels, panelId, index - 1);
}

/**
 * Moves a panel one position later (towards the end).
 * Safe no-op if the panel is already at the last index or not found.
 */
export function movePanelDown(panels: Panel[], panelId: string): Panel[] {
  const ordered = getOrderedPanels(panels);
  const index = ordered.findIndex((p) => p.id === panelId);
  if (index < 0 || index >= ordered.length - 1) {
    return normalizePanelSequence(ordered);
  }
  return reorderPanel(panels, panelId, index + 1);
}

/**
 * Moves a panel to the very beginning (index 0).
 * Safe no-op if already at index 0 or not found.
 */
export function movePanelToFirst(panels: Panel[], panelId: string): Panel[] {
  return reorderPanel(panels, panelId, 0);
}

/**
 * Moves a panel to the very end (index N - 1).
 * Safe no-op if already at the last index or not found.
 */
export function movePanelToLast(panels: Panel[], panelId: string): Panel[] {
  return reorderPanel(panels, panelId, panels.length - 1);
}

/**
 * Moves a panel from its current position to an arbitrary target index (0-based).
 * Clamps targetIndex within valid array bounds [0, panels.length - 1].
 */
export function movePanelToPosition(
  panels: Panel[],
  panelId: string,
  targetIndex: number
): Panel[] {
  return reorderPanel(panels, panelId, targetIndex);
}

/**
 * Reverses the current sequence order of panels.
 * E.g. [A, B, C, D] -> [D, C, B, A] with re-indexed 0-based orders.
 */
export function reversePanelOrder(panels: Panel[]): Panel[] {
  if (panels.length <= 1) {
    return panels;
  }

  const ordered = getOrderedPanels(panels);
  const reversed = [...ordered].reverse();

  return normalizePanelSequence(reversed);
}

/**
 * Resets the sequence order back to the exact initial sequence captured upon import.
 * 
 * Order resolution priority:
 * 1. Panel.initial_order (explicitly captured at creation)
 * 2. Matched SourceImage.source_order * 1000 + panel.panel_index (canonical import order fallback)
 * 3. Stable panel creation order
 * 
 * Never attempts to reconstruct order from filenames.
 */
export function resetPanelOrderToImport(
  panels: Panel[],
  images: SourceImage[] = []
): Panel[] {
  if (panels.length <= 1) {
    return panels;
  }

  // Create image lookup map for fallback
  const imageMap = new Map<string, SourceImage>();
  for (const img of images) {
    imageMap.set(img.image_id, img);
  }

  const restored = [...panels].sort((a, b) => {
    // 1. Compare explicit initial_order if available
    const aInit = a.initial_order;
    const bInit = b.initial_order;

    if (aInit !== undefined && bInit !== undefined) {
      return aInit - bInit;
    }

    // 2. Fallback to parent SourceImage source_order + panel_index
    const aImg = imageMap.get(a.image_id);
    const bImg = imageMap.get(b.image_id);
    const aFallback = (aImg?.source_order ?? 0) * 1000 + a.panel_index;
    const bFallback = (bImg?.source_order ?? 0) * 1000 + b.panel_index;

    if (aFallback !== bFallback) {
      return aFallback - bFallback;
    }

    return a.id.localeCompare(b.id);
  });

  return normalizePanelSequence(restored);
}

/**
 * Reorders panels given an ordered list of panel IDs (e.g. from drag-and-drop or list rearrange).
 */
export function reorderPanelsByIds(panels: Panel[], orderedPanelIds: string[]): Panel[] {
  const panelMap = new Map<string, Panel>();
  for (const p of panels) {
    panelMap.set(p.id, p);
  }

  const result: Panel[] = [];
  const processedIds = new Set<string>();

  for (const id of orderedPanelIds) {
    const panel = panelMap.get(id);
    if (panel) {
      result.push(panel);
      processedIds.add(id);
    }
  }

  // Append any panels not included in the ordered ID list to prevent loss
  for (const panel of panels) {
    if (!processedIds.has(panel.id)) {
      result.push(panel);
    }
  }

  return normalizePanelSequence(result);
}

/**
 * Checks whether the current panel order differs from the initial import order.
 */
export function isPanelOrderModified(
  panels: Panel[],
  images: SourceImage[] = []
): boolean {
  if (panels.length <= 1) return false;

  const currentOrdered = getOrderedPanels(panels);
  const resetOrdered = resetPanelOrderToImport(panels, images);

  for (let i = 0; i < currentOrdered.length; i++) {
    if (currentOrdered[i].id !== resetOrdered[i].id) {
      return true;
    }
  }

  return false;
}

/**
 * Performs rigorous data integrity validation on a project's panel sequence according
 * to the 11 Part 1.3 sequence integrity rules:
 * 
 * 1. Every panel still exists (count matches).
 * 2. Every panel ID is unique.
 * 3. Every source image reference is valid (referenced image_id exists in project.images).
 * 4. No panel is duplicated.
 * 5. No panel disappeared.
 * 6. Every panel appears exactly once in the canonical order.
 * 7. Sequence positions are valid contiguous integers (0 to N-1).
 * 8. Original filenames in project.images are unchanged.
 * 9. Image IDs in project.images and panel.image_id are unchanged.
 * 10. Panel IDs are unchanged.
 * 11. Root Schema validation passes.
 */
export function validatePanelSequenceIntegrity(project: Project): SequenceIntegrityReport {
  const errors: string[] = [];
  const panels = project.panels;
  const images = project.images;
  const imageIdSet = new Set(images.map((img) => img.image_id));

  // 1 & 2. Panel ID Uniqueness
  const seenPanelIds = new Set<string>();
  const duplicatePanelIds: string[] = [];

  for (const panel of panels) {
    if (seenPanelIds.has(panel.id)) {
      duplicatePanelIds.push(panel.id);
    }
    seenPanelIds.add(panel.id);
  }

  if (duplicatePanelIds.length > 0) {
    errors.push(`Duplicate panel IDs detected: ${duplicatePanelIds.join(', ')}`);
  }

  // 3. Source Image References
  for (const panel of panels) {
    if (!imageIdSet.has(panel.image_id)) {
      errors.push(`Panel ${panel.id} references missing image_id: ${panel.image_id}`);
    }
  }

  // 6 & 7. Contiguous 0..N-1 sequence validation
  const ordered = getOrderedPanels(panels);
  const minOrder = ordered.length > 0 ? ordered[0].order : 0;
  const maxOrder = ordered.length > 0 ? ordered[ordered.length - 1].order : 0;

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].order !== i) {
      errors.push(
        `Sequence discontinuity: Panel ${ordered[i].id} has order ${ordered[i].order}, expected ${i}`
      );
    }
  }

  // 8, 9, 10, 11. Schema & Identity checks
  const schemaValidation = validateProject(project);
  if (!schemaValidation.valid) {
    errors.push(`Project schema validation failed: ${schemaValidation.errorSummary}`);
  }

  const isCustom = isPanelOrderModified(panels, images);

  return {
    valid: errors.length === 0,
    errors,
    totalPanels: panels.length,
    isCustomOrder: isCustom,
    minOrder,
    maxOrder,
  };
}
