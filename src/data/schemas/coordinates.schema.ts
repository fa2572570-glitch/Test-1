import { z } from 'zod';

/**
 * Normalized number validation between 0.0 and 1.0
 */
export const NormalizedNumberSchema = z
  .number({ message: 'Coordinate must be a valid number' })
  .min(0, { message: 'Normalized coordinate cannot be less than 0.0' })
  .max(1, { message: 'Normalized coordinate cannot be greater than 1.0' });

/**
 * 2D Normalized Point Schema
 */
export const PointSchema = z.object({
  x: NormalizedNumberSchema,
  y: NormalizedNumberSchema,
});

/**
 * 2D Normalized Size Schema
 */
export const SizeSchema = z.object({
  width: NormalizedNumberSchema,
  height: NormalizedNumberSchema,
});

/**
 * Normalized Bounding Box Schema
 * Ensures the box fits within the normalized 0..1 plane.
 */
export const BoundingBoxSchema = z
  .object({
    x: NormalizedNumberSchema,
    y: NormalizedNumberSchema,
    width: NormalizedNumberSchema,
    height: NormalizedNumberSchema,
  })
  .refine((box) => box.x + box.width <= 1.0001, {
    message: 'Bounding box exceeds right boundary (x + width > 1.0)',
    path: ['width'],
  })
  .refine((box) => box.y + box.height <= 1.0001, {
    message: 'Bounding box exceeds bottom boundary (y + height > 1.0)',
    path: ['height'],
  });

/**
 * Normalized Region Schema
 */
export const RegionSchema = z.object({
  id: z.string().min(1, 'Region ID is required'),
  label: z.string().optional(),
  box: BoundingBoxSchema,
  normalizedPoints: z.array(PointSchema).optional(),
});
