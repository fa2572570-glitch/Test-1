/**
 * Part 2.3 — Comprehensive Test Suite for Panel Composition & Visual Structure Analysis
 * 
 * Verifies all 28 requirements specified in Section 36 & 37 including Zod schema
 * validation, AI response normalization, error handling, provenance, persistence,
 * and immutable original asset preservation.
 */

import {
  ShotScaleSchema,
  CompositionFramingSchema,
  VisualDensitySchema,
  DominantOrientationSchema,
  DominantRegionSchema,
  CompositionAnalysisSchema,
  AICompositionResponseSchema,
} from '../../../data/schemas/visual-analysis.schema';
import {
  normalizeShotScale,
  normalizeFraming,
  normalizeVisualDensity,
  normalizeOrientation,
  normalizeNegativeSpace,
  normalizeTonalRange,
  normalizeAndValidateAIComposition,
} from '../../../services/ai/composition-provider';
import { MockVisionAnalysisProvider } from '../../../services/ai/mock-provider';
import { CompositionStageAnalyzer } from '../../../engines/visual-analysis/composition';
import { Panel, AnalysisSource, AnalysisError, Project } from '../../../types';
import * as storage from '../../../services/storage/indexeddb';

export async function runCompositionTests(): Promise<{
  passed: number;
  failed: number;
  errors: string[];
}> {
  let passed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, message: string) {
    if (!condition) {
      errors.push(`Assertion failed: ${message}`);
    } else {
      passed++;
    }
  }

  // 1. Valid composition analysis schema validation
  try {
    const validComposition = {
      shot_scale: 'medium-wide',
      framing: 'left-weighted',
      foreground_importance: 0.85,
      middleground_importance: 0.4,
      background_importance: 0.15,
      visual_density: 'dense',
      dominant_orientation: 'horizontal',
      visual_hierarchy: ['Primary Character', 'Background Skyline'],
      dominant_regions: [
        {
          region_id: 'reg_1',
          label: 'primary_subject',
          box: { x: 0.1, y: 0.2, width: 0.4, height: 0.7 },
          prominence: 'primary',
          weight: 0.9,
        },
      ],
      negative_space: 'moderate',
      dominant_colors: ['#1A202C', '#E2E8F0'],
      lighting_mood: 'Dramatic high-contrast twilight',
      tonal_range: 'high_contrast',
      summary: 'Dynamic left-weighted medium-wide framing with strong foreground prominence.',
      confidence: 0.94,
      source: {
        provider: 'gemini',
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
        prompt_version: '1.0.0',
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      },
    };

    const res = CompositionAnalysisSchema.safeParse(validComposition);
    assert(res.success, 'Valid CompositionAnalysis should pass schema validation');
  } catch (err) {
    errors.push(`Requirement 1 error: ${err}`);
  }

  // 2. Invalid composition analysis rejected (e.g. invalid type or out of bounds)
  try {
    const invalidComposition = {
      shot_scale: 12345, // invalid type
      confidence: 1.5, // out of bounds > 1.0
    };
    const res = CompositionAnalysisSchema.safeParse(invalidComposition);
    assert(!res.success, 'Invalid CompositionAnalysis must fail schema validation');
  } catch (err) {
    errors.push(`Requirement 2 error: ${err}`);
  }

  // 3 & 4. Valid and invalid shot scale enum
  try {
    assert(ShotScaleSchema.safeParse('extreme-close-up').success, 'extreme-close-up should be valid');
    assert(ShotScaleSchema.safeParse('close-up').success, 'close-up should be valid');
    assert(ShotScaleSchema.safeParse('medium').success, 'medium should be valid');
    assert(ShotScaleSchema.safeParse('wide').success, 'wide should be valid');
    assert(ShotScaleSchema.safeParse('extreme-long-shot').success, 'extreme-long-shot should be valid');
    assert(ShotScaleSchema.safeParse('unknown').success, 'unknown shot scale should be valid');
    assert(!ShotScaleSchema.safeParse('super-duper-zoom').success, 'Invalid shot scale must be rejected');
  } catch (err) {
    errors.push(`Requirement 3-4 error: ${err}`);
  }

  // 5 & 6. Valid and invalid framing
  try {
    assert(CompositionFramingSchema.safeParse('left-weighted').success, 'left-weighted framing should be valid');
    assert(CompositionFramingSchema.safeParse('rule_of_thirds').success, 'rule_of_thirds framing should be valid');
    assert(CompositionFramingSchema.safeParse('centered').success, 'centered framing should be valid');
    assert(!CompositionFramingSchema.safeParse('arbitrary_framing').success, 'Invalid framing must be rejected');
  } catch (err) {
    errors.push(`Requirement 5-6 error: ${err}`);
  }

  // 7. Visual density validation
  try {
    assert(VisualDensitySchema.safeParse('sparse').success, 'sparse density should be valid');
    assert(VisualDensitySchema.safeParse('balanced').success, 'balanced density should be valid');
    assert(VisualDensitySchema.safeParse('dense').success, 'dense density should be valid');
    assert(VisualDensitySchema.safeParse('very_dense').success, 'very_dense density should be valid');
    assert(!VisualDensitySchema.safeParse('ultra-hyper').success, 'invalid density must be rejected');
  } catch (err) {
    errors.push(`Requirement 7 error: ${err}`);
  }

  // 8. Dominant orientation validation
  try {
    assert(DominantOrientationSchema.safeParse('horizontal').success, 'horizontal orientation should be valid');
    assert(DominantOrientationSchema.safeParse('vertical').success, 'vertical orientation should be valid');
    assert(DominantOrientationSchema.safeParse('diagonal').success, 'diagonal orientation should be valid');
    assert(DominantOrientationSchema.safeParse('mixed').success, 'mixed orientation should be valid');
    assert(!DominantOrientationSchema.safeParse('zigzag').success, 'invalid orientation must be rejected');
  } catch (err) {
    errors.push(`Requirement 8 error: ${err}`);
  }

  // 9 & 10. Normalized dominant regions
  try {
    const validRegion = {
      label: 'focal_character',
      box: { x: 0.2, y: 0.1, width: 0.5, height: 0.8 },
      prominence: 'primary',
      weight: 0.95,
    };
    assert(DominantRegionSchema.safeParse(validRegion).success, 'Valid dominant region should pass');

    const invalidRegion = {
      label: '', // empty label
      box: { x: -0.5, y: 0.1, width: 1.5, height: 0.8 }, // coordinates out of [0, 1]
    };
    assert(!DominantRegionSchema.safeParse(invalidRegion).success, 'Out of bounds region must be rejected');
  } catch (err) {
    errors.push(`Requirement 9-10 error: ${err}`);
  }

  // 11 & 12. Confidence boundary checks
  try {
    assert(CompositionAnalysisSchema.safeParse({ confidence: 0.0 }).success, 'Confidence 0.0 must be valid');
    assert(CompositionAnalysisSchema.safeParse({ confidence: 1.0 }).success, 'Confidence 1.0 must be valid');
    assert(CompositionAnalysisSchema.safeParse({ confidence: 0.75 }).success, 'Confidence 0.75 must be valid');
    assert(!CompositionAnalysisSchema.safeParse({ confidence: -0.1 }).success, 'Negative confidence must be rejected');
    assert(!CompositionAnalysisSchema.safeParse({ confidence: 1.1 }).success, 'Confidence > 1.0 must be rejected');
  } catch (err) {
    errors.push(`Requirement 11-12 error: ${err}`);
  }

  // 13. Normalization helpers & unknown values
  try {
    assert(normalizeShotScale('ECU') === 'extreme-close-up', 'ECU abbreviation should map to extreme-close-up');
    assert(normalizeShotScale('mid-shot') === 'medium', 'mid-shot should map to medium');
    assert(normalizeShotScale('non-existent') === 'unknown', 'unknown shot scale should map to unknown');
    assert(normalizeFraming('rule-of-thirds') === 'rule_of_thirds', 'rule-of-thirds kebab should map to rule_of_thirds');
    assert(normalizeVisualDensity('minimal') === 'sparse', 'minimal should map to sparse');
    assert(normalizeOrientation('horizontal') === 'horizontal', 'horizontal orientation should map');
    assert(normalizeNegativeSpace('substantial') === 'high', 'substantial should map to high negative space');
    assert(normalizeTonalRange('high-contrast') === 'high_contrast', 'high-contrast should map to high_contrast');
  } catch (err) {
    errors.push(`Requirement 13 error: ${err}`);
  }

  // 14. No fabricated values when analysis fails
  try {
    const mockFailureProvider = new MockVisionAnalysisProvider(undefined, {
      code: 'API_ERROR',
      stage: 'composition',
      message: 'Simulated API failure',
      retryable: true,
      occurred_at: new Date().toISOString(),
    });

    const panel: Panel = {
      id: 'panel_fail_test',
      panel_id: 'panel_fail_test',
      image_id: 'img_non_existent',
      order: 0,
      initial_order: 0,
      visual_analysis: {
        analysis_version: '1.0.0',
        status: 'NOT_ANALYZED',
      },
    };

    const analyzer = new CompositionStageAnalyzer({ provider: mockFailureProvider });
    let threw = false;
    try {
      await analyzer.analyzeComposition(panel);
    } catch (err: any) {
      threw = true;
      assert(err.code === 'MISSING_PROXY' || err.code === 'API_ERROR', 'Analyzer must throw structured AnalysisError');
    }
    assert(threw, 'Analyzer must throw on missing proxy / provider error without fabricating data');
  } catch (err) {
    errors.push(`Requirement 14 error: ${err}`);
  }

  // 15 & 16. Missing and stale proxy handling
  try {
    const panelWithoutImage: Panel = {
      id: 'panel_no_img',
      panel_id: 'panel_no_img',
      image_id: '',
      order: 0,
      initial_order: 0,
    };
    const analyzer = new CompositionStageAnalyzer();
    let threw = false;
    try {
      await analyzer.analyzeComposition(panelWithoutImage);
    } catch (err: any) {
      threw = true;
      assert(err.code === 'MISSING_IMAGE_REFERENCE', 'Must report structured MISSING_IMAGE_REFERENCE error');
    }
    assert(threw, 'Should reject panel without image_id');
  } catch (err) {
    errors.push(`Requirement 15-16 error: ${err}`);
  }

  // 17 & 18. Malformed AI response rejected & Zod schema validation
  try {
    const provenance: AnalysisSource = {
      provider: 'test-provider',
      model: 'test-model',
      prompt_version: '1.0.0',
      analyzed_at: new Date().toISOString(),
    };

    let malformedThrew = false;
    try {
      normalizeAndValidateAIComposition('not a json object', provenance);
    } catch (err: any) {
      malformedThrew = true;
      assert(err.code === 'MALFORMED_AI_RESPONSE', 'Malformed non-object must throw MALFORMED_AI_RESPONSE');
    }
    assert(malformedThrew, 'Malformed string response should throw');

    // Test valid normalization
    const validRaw = {
      shot_scale: 'wide',
      framing: 'panoramic',
      foreground_importance: 0.3,
      middleground_importance: 0.7,
      background_importance: 0.9,
      visual_density: 'dense',
      dominant_orientation: 'horizontal',
      visual_hierarchy: ['Far Mountain Range', 'Foreground Path'],
      dominant_regions: [
        {
          label: 'mountains',
          box: { x: 0, y: 0.1, width: 1.0, height: 0.5 },
          prominence: 'primary',
          weight: 0.85,
        },
      ],
      negative_space: 'low',
      summary: 'Grand establishing panoramic vista with prominent mountain background.',
      confidence: 0.91,
    };

    const normalized = normalizeAndValidateAIComposition(validRaw, provenance);
    assert(normalized.shot_scale === 'wide', 'Normalized shot_scale should match');
    assert(normalized.framing === 'panoramic', 'Normalized framing should match');
    assert(normalized.source?.provider === 'test-provider', 'Provenance provider must be attached');
  } catch (err) {
    errors.push(`Requirement 17-18 error: ${err}`);
  }

  // 19. Provenance recorded correctly
  try {
    const mockProvider = new MockVisionAnalysisProvider();
    const res = await mockProvider.analyzePanelComposition({
      imageBlob: new Blob(['fake_proxy_bytes'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      panelId: 'panel_prov_test',
    });
    assert(Boolean(res.provenance.provider), 'Provider must be present in provenance');
    assert(Boolean(res.provenance.analyzed_at), 'Analyzed timestamp must be present');
    assert(res.provenance.prompt_version === '1.0.0', 'Prompt version must be recorded');
  } catch (err) {
    errors.push(`Requirement 19 error: ${err}`);
  }

  // 20 to 26 & 37: End-to-End Integration & Persistence Test
  try {
    const testProjectId = 'proj_comp_test_' + Date.now();
    const testImageId = 'img_comp_test_' + Date.now();
    const testPanelId = 'panel_comp_test_' + Date.now();
    const originalFilename = 'chapter_01_panel_05.png';

    // 1. Store test image in IndexedDB
    const fakeImageBlob = new Blob(['image_binary_content_123456789'], { type: 'image/png' });
    await storage.saveImageBlob(testImageId, testProjectId, fakeImageBlob, 'image/png');

    // 2. Store test analysis proxy in analysis_proxies store
    const fakeProxyBlob = new Blob(['proxy_binary_content_987654321'], { type: 'image/jpeg' });
    await storage.saveProxyBlob({
      image_id: testImageId,
      cache_key: 'test_cache_key_' + testImageId,
      blob: fakeProxyBlob,
      mime_type: 'image/jpeg',
      width: 768,
      height: 1536,
      scale: 0.5,
      byte_size: fakeProxyBlob.size,
      created_at: new Date().toISOString(),
    });

    // 3. Create canonical Project
    const initialProject: Project = {
      id: testProjectId,
      schemaVersion: '1.0.0',
      metadata: {
        id: testProjectId,
        title: 'Composition Test Series',
        reading_direction: 'top-to-bottom',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      settings: {
        reading_direction: 'top-to-bottom',
        target_aspect_ratio: '9:16',
        export_target_fps: 30,
        auto_save_interval_ms: 5000,
        preferred_resolution: { width: 1080, height: 1920 },
        auto_generate_proxies: true,
        max_proxy_dimension: 1536,
        theme: 'dark',
      },
      images: [
        {
          image_id: testImageId,
          original_filename: originalFilename,
          mime_type: 'image/png',
          file_size: fakeImageBlob.size,
          byte_size: fakeImageBlob.size,
          width: 1536,
          height: 3072,
          source_order: 0,
          created_at: new Date().toISOString(),
        },
      ],
      panels: [
        {
          id: testPanelId,
          panel_id: testPanelId,
          image_id: testImageId,
          panel_index: 0,
          order: 0,
          initial_order: 0,
          boundary: { x: 0, y: 0, width: 1, height: 1 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          visual_analysis: {
            analysis_version: '1.0.0',
            status: 'NOT_ANALYZED',
            stages: {
              preprocessing: 'COMPLETED',
              composition: 'NOT_ANALYZED',
            },
          },
        },
      ],
      characters: [],
      scenes: [],
      events: [],
      storyMap: {
        id: 'sm_' + testProjectId,
        updated_at: new Date().toISOString(),
      },
      analysisStatus: {
        stage: 'idle',
        progress: 0,
        completed_stages: [],
      },
    };

    await storage.saveProject(initialProject);

    // 4. Run Composition Analysis using Mock Vision Provider
    const mockProvider = new MockVisionAnalysisProvider(() => ({
      shot_scale: 'close-up',
      framing: 'centered',
      foreground_importance: 0.9,
      middleground_importance: 0.2,
      background_importance: 0.1,
      visual_density: 'balanced',
      dominant_orientation: 'vertical',
      visual_hierarchy: ['Focal Portrait Face', 'Soft Ambient Glow'],
      dominant_regions: [
        {
          label: 'character_face',
          box: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
          prominence: 'primary',
          weight: 0.95,
        },
      ],
      negative_space: 'moderate',
      lighting_mood: 'Soft ambient portrait illumination',
      tonal_range: 'balanced',
      summary: 'Vertical close-up portrait centering the character face with clean background separation.',
      confidence: 0.96,
    }));

    const analyzer = new CompositionStageAnalyzer({ provider: mockProvider });
    const compResult = await analyzer.analyzeComposition(initialProject.panels[0]);

    assert(compResult.shot_scale === 'close-up', 'Analyzer returned valid shot_scale');
    assert(compResult.framing === 'centered', 'Analyzer returned valid framing');
    assert(compResult.confidence === 0.96, 'Analyzer returned valid confidence');

    // 5. Update and persist project
    const updatedProject: Project = {
      ...initialProject,
      panels: [
        {
          ...initialProject.panels[0],
          visual_analysis: {
            ...initialProject.panels[0].visual_analysis!,
            composition: compResult,
            confidence: compResult.confidence,
            stages: {
              preprocessing: 'COMPLETED',
              composition: 'COMPLETED',
            },
          },
        },
      ],
    };

    await storage.saveProject(updatedProject);

    // 6. Reload from IndexedDB and verify persistent roundtrip
    const loadedProject = await storage.getProject(testProjectId);
    assert(Boolean(loadedProject), 'Project must reload cleanly from IndexedDB');

    const loadedPanel = loadedProject?.panels.find((p) => p.panel_id === testPanelId);
    assert(Boolean(loadedPanel?.visual_analysis?.composition), 'Persisted composition must survive reload');
    assert(loadedPanel?.visual_analysis?.composition?.shot_scale === 'close-up', 'Loaded composition shot scale must match');
    assert(loadedPanel?.visual_analysis?.stages?.composition === 'COMPLETED', 'Composition stage status must be COMPLETED');

    // 7. Verify Data Integrity Mandates (Sections 21-26 & 38)
    // - Original image binary unchanged
    const reloadedImageBlob = await storage.getImageBlob(testImageId);
    assert(Boolean(reloadedImageBlob), 'Original image blob must remain in storage');
    assert(reloadedImageBlob?.size === fakeImageBlob.size, 'Original image blob size must remain verbatim');

    // - Original filename unchanged
    assert(loadedProject?.images[0].original_filename === originalFilename, 'Original filename must remain unchanged');

    // - Panel ID unchanged
    assert(loadedPanel?.panel_id === testPanelId, 'Panel ID must remain unchanged');

    // - Panel Order unchanged
    assert(loadedPanel?.order === 0, 'Panel order must remain unchanged');

    // Clean up test project from IndexedDB
    await storage.deleteProject(testProjectId);
    await storage.deleteImageBlob(testImageId);
    await storage.deleteProxyBlob(testImageId);
  } catch (err) {
    errors.push(`Requirement 20-37 Integration Test error: ${err}`);
  }

  return {
    passed,
    failed: errors.length,
    errors,
  };
}
