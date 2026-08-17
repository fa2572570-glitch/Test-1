/**
 * Normalized Coordinate System
 * 
 * All coordinate values are normalized numbers between 0.0 and 1.0,
 * representing fractional dimensions relative to the source image / container.
 */

export interface Point {
  /** Normalized X coordinate (0.0 to 1.0) */
  x: number;
  /** Normalized Y coordinate (0.0 to 1.0) */
  y: number;
}

export interface Size {
  /** Normalized width (0.0 to 1.0) */
  width: number;
  /** Normalized height (0.0 to 1.0) */
  height: number;
}

export interface BoundingBox {
  /** Normalized top-left X coordinate (0.0 to 1.0) */
  x: number;
  /** Normalized top-left Y coordinate (0.0 to 1.0) */
  y: number;
  /** Normalized width (0.0 to 1.0) */
  width: number;
  /** Normalized height (0.0 to 1.0) */
  height: number;
}

export interface Region {
  /** Stable identifier for this region */
  id: string;
  /** Optional descriptive label (e.g. 'character', 'speech_bubble', 'sfx', 'focal_point') */
  label?: string;
  /** Primary normalized bounding box */
  box: BoundingBox;
  /** Optional polygon vertices for non-rectangular regions (0.0 to 1.0) */
  normalizedPoints?: Point[];
}
