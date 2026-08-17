/**
 * Part 2.2 — Image Preprocessing Stage Engine Implementation
 * 
 * Implements IPreprocessingStageAnalyzer using the local preprocessing pipeline
 * without performing any AI inference or altering original image assets.
 */

import { Panel, PreprocessingInfo } from '../../types';
import {
  IPreprocessingStageAnalyzer,
  VisualAnalysisExecutionContext,
} from './contracts';
import {
  createProxyFromBlob,
  generateProxyCacheKey,
  computeImageHash,
  PREPROCESSING_VERSION,
} from '../../features/analysis/image-preprocessing.service';
import * as storage from '../../services/storage/indexeddb';

export class ImagePreprocessingStageAnalyzer implements IPreprocessingStageAnalyzer {
  readonly stageName = 'preprocessing' as const;

  /**
   * Processes a panel's image blob and generates/stores the analysis proxy.
   */
  async processImageProxy(
    panel: Panel,
    imageBlob: Blob,
    context?: VisualAnalysisExecutionContext
  ): Promise<PreprocessingInfo> {
    if (context?.signal?.aborted) {
      throw new Error('Preprocessing aborted by execution context');
    }

    const contentHash = await computeImageHash(imageBlob);
    const cacheKey = generateProxyCacheKey(panel.image_id, contentHash, PREPROCESSING_VERSION);

    // Check existing stored proxy
    const existingProxy = await storage.getProxyBlob(panel.image_id);
    if (existingProxy && existingProxy.cache_key === cacheKey) {
      return {
        source_width: Math.round(existingProxy.width / existingProxy.scale),
        source_height: Math.round(existingProxy.height / existingProxy.scale),
        analysis_width: existingProxy.width,
        analysis_height: existingProxy.height,
        scale: existingProxy.scale,
        format: existingProxy.mime_type,
        preprocessing_version: PREPROCESSING_VERSION,
        source_byte_size: imageBlob.size,
        proxy_byte_size: existingProxy.byte_size || existingProxy.blob.size,
        cache_key: cacheKey,
        generated_at: existingProxy.created_at,
      };
    }

    // Generate fresh proxy
    const { blob: proxyBlob, info } = await createProxyFromBlob(imageBlob);
    info.cache_key = cacheKey;

    // Persist proxy in separate analysis_proxies store
    await storage.saveProxyBlob({
      image_id: panel.image_id,
      cache_key: cacheKey,
      blob: proxyBlob,
      mime_type: info.format,
      width: info.analysis_width,
      height: info.analysis_height,
      scale: info.scale,
      byte_size: proxyBlob.size,
      created_at: info.generated_at,
    });

    return info;
  }
}
