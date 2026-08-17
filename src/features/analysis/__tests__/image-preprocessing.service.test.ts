/**
 * Unit Test Suite for Part 2.2 — Image Preprocessing & Analysis Proxy Pipeline
 */

import {
  calculateTargetDimensions,
  generateProxyCacheKey,
  proxyPixelsToNormalized,
  normalizedToProxyPixels,
  normalizedToSourcePixels,
  PREPROCESSING_VERSION,
} from '../image-preprocessing.service';
import { PreprocessingInfoSchema } from '../../../data/schemas/visual-analysis.schema';

export function runPreprocessingTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      errors.push(`Assertion failed: ${message}`);
    } else {
      passed++;
    }
  }

  // 1. calculateTargetDimensions Tests
  try {
    // Within bounds: No upscaling (Scale = 1.0)
    const fit = calculateTargetDimensions(800, 1200, 1536);
    assert(fit.analysisWidth === 800, 'Dimensions within bounds should keep source width');
    assert(fit.analysisHeight === 1200, 'Dimensions within bounds should keep source height');
    assert(fit.scale === 1.0, 'Scale must be 1.0 when within bounds');

    // Height-dominant panel downscaling
    const portrait = calculateTargetDimensions(2000, 4000, 1536);
    assert(portrait.analysisHeight === 1536, 'Portrait panel should limit max height to 1536');
    assert(portrait.analysisWidth === 768, 'Portrait panel width should scale down proportionally to 768');
    assert(Math.abs(portrait.scale - 1536 / 4000) < 0.001, 'Portrait scale should equal target / source');

    // Width-dominant panel downscaling
    const landscape = calculateTargetDimensions(3000, 1500, 1536);
    assert(landscape.analysisWidth === 1536, 'Landscape panel should limit max width to 1536');
    assert(landscape.analysisHeight === 768, 'Landscape panel height should scale down proportionally to 768');
    assert(Math.abs(landscape.scale - 1536 / 3000) < 0.001, 'Landscape scale should equal target / source');

    // Reject non-positive dimensions
    let threw = false;
    try {
      calculateTargetDimensions(0, 1000);
    } catch {
      threw = true;
    }
    assert(threw, 'Should throw for non-positive dimensions');
  } catch (err) {
    errors.push(`calculateTargetDimensions unexpected error: ${err}`);
  }

  // 2. generateProxyCacheKey Tests
  try {
    const key1 = generateProxyCacheKey('img_123', 'hash_abc', PREPROCESSING_VERSION, {
      maxDimension: 1536,
      quality: 0.85,
      format: 'image/jpeg',
    });
    const key2 = generateProxyCacheKey('img_123', 'hash_abc', PREPROCESSING_VERSION, {
      maxDimension: 1536,
      quality: 0.85,
      format: 'image/jpeg',
    });
    assert(key1 === key2, 'Deterministic cache keys should be identical for identical inputs');
    assert(key1.includes('img_123') && key1.includes('hash_abc'), 'Cache key should encode ID and hash');

    const keySmall = generateProxyCacheKey('img_123', 'hash_abc', PREPROCESSING_VERSION, {
      maxDimension: 1024,
    });
    assert(key1 !== keySmall, 'Cache keys must diverge when dimension config changes');
  } catch (err) {
    errors.push(`generateProxyCacheKey error: ${err}`);
  }

  // 3. Coordinate Mapping Tests
  try {
    const proxyW = 768;
    const proxyH = 1536;
    const sourceW = 2000;
    const sourceH = 4000;

    const norm = proxyPixelsToNormalized(384, 768, proxyW, proxyH);
    assert(Math.abs(norm.x - 0.5) < 0.001 && Math.abs(norm.y - 0.5) < 0.001, 'Normalized coordinates should be 0.5');

    const clamped = proxyPixelsToNormalized(-50, 2000, proxyW, proxyH);
    assert(clamped.x === 0 && clamped.y === 1, 'Normalized coordinates should clamp within [0, 1]');

    const proxyPx = normalizedToProxyPixels(0.5, 0.25, proxyW, proxyH);
    assert(proxyPx.x === 384 && proxyPx.y === 384, 'Normalized to proxy pixels should map correctly');

    const sourcePx = normalizedToSourcePixels(0.5, 0.5, sourceW, sourceH);
    assert(sourcePx.x === 1000 && sourcePx.y === 2000, 'Normalized to source pixels should match full-res asset');
  } catch (err) {
    errors.push(`Coordinate mapping error: ${err}`);
  }

  // 4. Schema Validation Tests
  try {
    const sample = {
      source_width: 2000,
      source_height: 4000,
      analysis_width: 768,
      analysis_height: 1536,
      scale: 0.384,
      format: 'image/jpeg',
      preprocessing_version: '1.0.0',
      max_dimension: 1536,
      quality: 0.85,
      source_byte_size: 4500000,
      proxy_byte_size: 210000,
      cache_key: 'proxy_test_123',
      generation_duration_ms: 45,
      generated_at: new Date().toISOString(),
    };

    const validResult = PreprocessingInfoSchema.safeParse(sample);
    assert(validResult.success, 'Conforming PreprocessingInfo object should pass schema validation');

    const invalid = {
      source_width: -100,
      source_height: 4000,
      analysis_width: 768,
      analysis_height: 1536,
      scale: 0.384,
      format: 'image/jpeg',
      generated_at: new Date().toISOString(),
    };
    const invalidResult = PreprocessingInfoSchema.safeParse(invalid);
    assert(!invalidResult.success, 'Invalid negative dimension must fail schema validation');
  } catch (err) {
    errors.push(`Schema validation error: ${err}`);
  }

  return {
    passed,
    failed: errors.length,
    errors,
  };
}
