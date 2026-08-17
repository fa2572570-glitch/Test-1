/**
 * Part 2.3 — Gemini Vision Analysis Provider
 * 
 * Communicates with the server-side `/api/analysis/composition` endpoint,
 * keeping API keys strictly on the server-side while providing structured
 * analysis data and error propagation to the client.
 */

import {
  IVisionAnalysisProvider,
  CompositionPromptPayload,
} from './composition-provider';
import { SubjectDetectionPromptPayload } from './subject-provider';
import { TextAnalysisPromptPayload } from './text-provider';
import { SceneActionPromptPayload } from './scene-action-provider';
import { FocusPromptPayload } from './focus-provider';
import { ContinuityPromptPayload } from './continuity-provider';
import { AnalysisSource, AnalysisError } from '../../types';
import { COMPOSITION_PROMPT_VERSION } from '../../features/analysis/prompts/composition.prompt';
import { SUBJECT_DETECTION_PROMPT_VERSION } from '../../features/analysis/prompts/subject-detection.prompt';
import { TEXT_ANALYSIS_PROMPT_VERSION } from '../../features/analysis/prompts/text-analysis.prompt';
import { SCENE_ACTION_PROMPT_VERSION } from '../../features/analysis/prompts/scene-action.prompt';
import { FOCUS_SALIENCE_PROMPT_VERSION } from '../../features/analysis/prompts/focus-salience.prompt';
import { CONTINUITY_PROMPT_VERSION } from '../../features/analysis/prompts/continuity.prompt';

export class GeminiVisionProvider implements IVisionAnalysisProvider {
  readonly providerId = 'gemini';
  readonly modelId = 'gemini-3.7-flash';
  readonly promptVersion = COMPOSITION_PROMPT_VERSION;
  readonly subjectPromptVersion = SUBJECT_DETECTION_PROMPT_VERSION;
  readonly textPromptVersion = TEXT_ANALYSIS_PROMPT_VERSION;
  readonly sceneActionPromptVersion = SCENE_ACTION_PROMPT_VERSION;
  readonly focusPromptVersion = FOCUS_SALIENCE_PROMPT_VERSION;
  readonly continuityPromptVersion = CONTINUITY_PROMPT_VERSION;

  async analyzePanelComposition(
    payload: CompositionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    // 1. Convert blob to Base64 for transit
    const arrayBuffer = await payload.imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const requestBody = {
      panelId: payload.panelId,
      mimeType: payload.mimeType || 'image/jpeg',
      imageBase64: base64Data,
      promptVersion: this.promptVersion,
      context: payload.context,
    };

    try {
      const response = await fetch('/api/analysis/composition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        const structuredError: AnalysisError = {
          code: errorData.code || (response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR'),
          stage: 'composition',
          message: errorData.message || `Vision provider error (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          details: errorData.details,
          occurred_at: new Date().toISOString(),
        };
        throw structuredError;
      }

      const resultJson = await response.json();

      const provenance: AnalysisSource = {
        provider: this.providerId,
        model: resultJson.model || this.modelId,
        model_version: resultJson.model_version || '2026-03',
        prompt_version: this.promptVersion,
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      };

      return {
        raw: resultJson.composition || resultJson,
        provenance,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw {
          code: 'ANALYSIS_CANCELLED',
          stage: 'composition',
          message: 'Composition analysis was cancelled by user',
          retryable: true,
          occurred_at: new Date().toISOString(),
        } as AnalysisError;
      }

      if (err.code && err.stage) {
        throw err;
      }

      throw {
        code: 'NETWORK_ERROR',
        stage: 'composition',
        message: err.message || 'Failed to communicate with composition analysis backend',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }
  }

  async analyzePanelSubjects(
    payload: SubjectDetectionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    // 1. Convert blob to Base64 for transit
    const arrayBuffer = await payload.imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const requestBody = {
      panelId: payload.panelId,
      mimeType: payload.mimeType || 'image/jpeg',
      imageBase64: base64Data,
      promptVersion: this.subjectPromptVersion,
      context: payload.context,
    };

    try {
      const response = await fetch('/api/analysis/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        const structuredError: AnalysisError = {
          code: errorData.code || (response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR'),
          stage: 'subjects',
          message: errorData.message || `Subject detection provider error (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          details: errorData.details,
          occurred_at: new Date().toISOString(),
        };
        throw structuredError;
      }

      const resultJson = await response.json();

      const provenance: AnalysisSource = {
        provider: this.providerId,
        model: resultJson.model || this.modelId,
        model_version: resultJson.model_version || '2026-03',
        prompt_version: this.subjectPromptVersion,
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      };

      return {
        raw: resultJson.detections || resultJson,
        provenance,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw {
          code: 'ANALYSIS_CANCELLED',
          stage: 'subjects',
          message: 'Subject detection analysis was cancelled by user',
          retryable: true,
          occurred_at: new Date().toISOString(),
        } as AnalysisError;
      }

      if (err.code && err.stage) {
        throw err;
      }

      throw {
        code: 'NETWORK_ERROR',
        stage: 'subjects',
        message: err.message || 'Failed to communicate with subject detection backend',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }
  }

  async analyzePanelText(
    payload: TextAnalysisPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    // 1. Convert blob to Base64 for transit
    const arrayBuffer = await payload.imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const requestBody = {
      panelId: payload.panelId,
      mimeType: payload.mimeType || 'image/jpeg',
      imageBase64: base64Data,
      promptVersion: this.textPromptVersion,
      context: payload.context,
    };

    try {
      const response = await fetch('/api/analysis/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        const structuredError: AnalysisError = {
          code: errorData.code || (response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR'),
          stage: 'text',
          message: errorData.message || `Text analysis provider error (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          details: errorData.details,
          occurred_at: new Date().toISOString(),
        };
        throw structuredError;
      }

      const resultJson = await response.json();

      const provenance: AnalysisSource = {
        provider: this.providerId,
        model: resultJson.model || this.modelId,
        model_version: resultJson.model_version || '2026-03',
        prompt_version: this.textPromptVersion,
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      };

      return {
        raw: resultJson.text_elements || resultJson,
        provenance,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw {
          code: 'ANALYSIS_CANCELLED',
          stage: 'text',
          message: 'Text analysis was cancelled by user',
          retryable: true,
          occurred_at: new Date().toISOString(),
        } as AnalysisError;
      }

      if (err.code && err.stage) {
        throw err;
      }

      throw {
        code: 'NETWORK_ERROR',
        stage: 'text',
        message: err.message || 'Failed to communicate with text analysis backend',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }
  }

  async analyzePanelSceneAndAction(
    payload: SceneActionPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    // 1. Convert blob to Base64 for transit
    const arrayBuffer = await payload.imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const requestBody = {
      panelId: payload.panelId,
      mimeType: payload.mimeType || 'image/jpeg',
      imageBase64: base64Data,
      promptVersion: this.sceneActionPromptVersion,
      context: payload.context,
    };

    try {
      const response = await fetch('/api/analysis/scene-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        const structuredError: AnalysisError = {
          code: errorData.code || (response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR'),
          stage: 'scene_and_action',
          message: errorData.message || `Scene & Action provider error (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          details: errorData.details,
          occurred_at: new Date().toISOString(),
        };
        throw structuredError;
      }

      const resultJson = await response.json();

      const provenance: AnalysisSource = {
        provider: this.providerId,
        model: resultJson.model || this.modelId,
        model_version: resultJson.model_version || '2026-03',
        prompt_version: this.sceneActionPromptVersion,
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      };

      return {
        raw: resultJson.analysis || resultJson,
        provenance,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw {
          code: 'ANALYSIS_CANCELLED',
          stage: 'scene_and_action',
          message: 'Scene & Action analysis was cancelled by user',
          retryable: true,
          occurred_at: new Date().toISOString(),
        } as AnalysisError;
      }

      if (err.code && err.stage) {
        throw err;
      }

      throw {
        code: 'NETWORK_ERROR',
        stage: 'scene_and_action',
        message: err.message || 'Failed to communicate with scene & action analysis backend',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }
  }

  async analyzePanelFocus(
    payload: FocusPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    // 1. Convert blob to Base64 for transit
    const arrayBuffer = await payload.imageBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const requestBody = {
      panelId: payload.panelId,
      mimeType: payload.mimeType || 'image/jpeg',
      imageBase64: base64Data,
      promptVersion: this.focusPromptVersion,
      context: payload.context,
    };

    try {
      const response = await fetch('/api/analysis/focus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        const structuredError: AnalysisError = {
          code: errorData.code || (response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR'),
          stage: 'focus',
          message: errorData.message || `Visual focus provider error (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          details: errorData.details,
          occurred_at: new Date().toISOString(),
        };
        throw structuredError;
      }

      const resultJson = await response.json();

      const provenance: AnalysisSource = {
        provider: this.providerId,
        model: resultJson.model || this.modelId,
        model_version: resultJson.model_version || '2026-03',
        prompt_version: this.focusPromptVersion,
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      };

      return {
        raw: resultJson.analysis || resultJson,
        provenance,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw {
          code: 'ANALYSIS_CANCELLED',
          stage: 'focus',
          message: 'Visual focus analysis was cancelled by user',
          retryable: true,
          occurred_at: new Date().toISOString(),
        } as AnalysisError;
      }

      if (err.code && err.stage) {
        throw err;
      }

      throw {
        code: 'NETWORK_ERROR',
        stage: 'focus',
        message: err.message || 'Failed to communicate with visual focus analysis backend',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }
  }

  async analyzePanelContinuity(
    payload: ContinuityPromptPayload,
    signal?: AbortSignal
  ): Promise<{
    raw: unknown;
    provenance: AnalysisSource;
  }> {
    // 1. Convert current image blob to Base64
    const currentBuffer = await payload.currentImageBlob.arrayBuffer();
    const currentBytes = new Uint8Array(currentBuffer);
    let currentBinary = '';
    for (let i = 0; i < currentBytes.byteLength; i++) {
      currentBinary += String.fromCharCode(currentBytes[i]);
    }
    const currentImageBase64 = btoa(currentBinary);

    // 2. Convert previous image blob to Base64 if present
    let previousImageBase64: string | undefined = undefined;
    if (payload.previousImageBlob) {
      const prevBuffer = await payload.previousImageBlob.arrayBuffer();
      const prevBytes = new Uint8Array(prevBuffer);
      let prevBinary = '';
      for (let i = 0; i < prevBytes.byteLength; i++) {
        prevBinary += String.fromCharCode(prevBytes[i]);
      }
      previousImageBase64 = btoa(prevBinary);
    }

    // 3. Convert next image blob to Base64 if present
    let nextImageBase64: string | undefined = undefined;
    if (payload.nextImageBlob) {
      const nextBuffer = await payload.nextImageBlob.arrayBuffer();
      const nextBytes = new Uint8Array(nextBuffer);
      let nextBinary = '';
      for (let i = 0; i < nextBytes.byteLength; i++) {
        nextBinary += String.fromCharCode(nextBytes[i]);
      }
      nextImageBase64 = btoa(nextBinary);
    }

    const requestBody = {
      currentPanelId: payload.currentPanelId,
      previousPanelId: payload.previousPanelId,
      nextPanelId: payload.nextPanelId,
      currentImageBase64,
      previousImageBase64,
      nextImageBase64,
      currentContext: payload.currentContext,
      previousContext: payload.previousContext,
      nextContext: payload.nextContext,
      promptVersion: this.continuityPromptVersion,
    };

    try {
      const response = await fetch('/api/analysis/continuity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
        }

        const structuredError: AnalysisError = {
          code: errorData.code || (response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR'),
          stage: 'continuity',
          message: errorData.message || `Visual continuity provider error (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          details: errorData.details,
          occurred_at: new Date().toISOString(),
        };
        throw structuredError;
      }

      const resultJson = await response.json();

      const provenance: AnalysisSource = {
        provider: this.providerId,
        model: resultJson.model || this.modelId,
        model_version: resultJson.model_version || '2026-03',
        prompt_version: this.continuityPromptVersion,
        source_type: 'ai',
        analyzed_at: new Date().toISOString(),
      };

      return {
        raw: resultJson.analysis || resultJson,
        provenance,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw {
          code: 'ANALYSIS_CANCELLED',
          stage: 'continuity',
          message: 'Visual continuity analysis was cancelled by user',
          retryable: true,
          occurred_at: new Date().toISOString(),
        } as AnalysisError;
      }

      if (err.code && err.stage) {
        throw err;
      }

      throw {
        code: 'NETWORK_ERROR',
        stage: 'continuity',
        message: err.message || 'Failed to communicate with visual continuity analysis backend',
        retryable: true,
        occurred_at: new Date().toISOString(),
      } as AnalysisError;
    }
  }
}
