/**
 * Part 2.5 — Text, Dialogue & SFX AI Response Normalizer & Provider Definitions
 * 
 * Provides normalization, coordinate clamping, duplicate filtering, deterministic
 * reading-order sorting, OCR confidence handling, and strict Zod validation for text elements.
 */

import {
  TextElement,
  TextElementType,
  BoundingBox,
  AnalysisSource,
  AnalysisError,
} from '../../types';
import {
  AITextAnalysisResponseSchema,
  TextElementSchema,
} from '../../data/schemas/visual-analysis.schema';
import { normalizeBoundingBox, calculateIoU } from './subject-provider';

export interface TextAnalysisPromptPayload {
  imageBlob: Blob;
  mimeType: string;
  panelId: string;
  context?: {
    order?: number;
    aspectRatio?: number;
    readingDirection?: string;
  };
}

/**
 * Normalizes text element category into canonical TextElementType enum.
 */
export function normalizeTextElementType(input?: string): TextElementType {
  if (!input) return 'dialogue';
  const cleaned = input.toLowerCase().trim().replace(/[-_]/g, ' ');

  if (cleaned.includes('thought') || cleaned.includes('monologue') || cleaned.includes('internal')) {
    return 'thought';
  }
  if (cleaned.includes('narration') || cleaned.includes('caption') || cleaned.includes('narrator') || cleaned.includes('box')) {
    return 'narration';
  }
  if (cleaned.includes('sfx') || cleaned.includes('sound') || cleaned.includes('effect') || cleaned.includes('onomatopoeia') || cleaned.includes('action text')) {
    return 'sfx';
  }
  if (cleaned.includes('sign') || cleaned.includes('label') || cleaned.includes('board') || cleaned.includes('poster') || cleaned.includes('banner')) {
    return 'sign';
  }
  if (cleaned.includes('system') || cleaned.includes('ui') || cleaned.includes('status') || cleaned.includes('window') || cleaned.includes('screen') || cleaned.includes('hologram')) {
    return 'system_ui';
  }
  if (cleaned.includes('whisper') || cleaned.includes('murmur') || cleaned.includes('mumble')) {
    return 'whisper';
  }
  if (cleaned.includes('shout') || cleaned.includes('yell') || cleaned.includes('scream') || cleaned.includes('roar')) {
    return 'shout';
  }
  if (cleaned.includes('dialogue') || cleaned.includes('speech') || cleaned.includes('bubble') || cleaned.includes('talk')) {
    return 'dialogue';
  }
  if (cleaned.includes('unknown')) {
    return 'unknown';
  }

  return 'dialogue';
}

/**
 * Sorts text elements deterministically into canonical reading order:
 * In manhwa / webtoon panels, flow is primarily top-to-bottom.
 * If vertical centers are close within a row threshold (e.g. 10% height difference),
 * sort according to horizontal reading direction (standard left-to-right or right-to-left for manga).
 */
export function sortTextElementsReadingOrder(
  elements: TextElement[],
  readingDirection: string = 'top-to-bottom'
): TextElement[] {
  const isRTL = readingDirection === 'right-to-left';

  const sorted = [...elements].sort((a, b) => {
    // If explicit AI reading orders exist and are different, honor them
    if (
      typeof a.reading_order === 'number' &&
      typeof b.reading_order === 'number' &&
      a.reading_order !== b.reading_order
    ) {
      return a.reading_order - b.reading_order;
    }

    const aCenterY = a.bounding_box.y + a.bounding_box.height / 2;
    const bCenterY = b.bounding_box.y + b.bounding_box.height / 2;
    const aCenterX = a.bounding_box.x + a.bounding_box.width / 2;
    const bCenterX = b.bounding_box.x + b.bounding_box.width / 2;

    // Check if they are on roughly the same horizontal band (within 8% panel height)
    const verticalDelta = Math.abs(aCenterY - bCenterY);
    if (verticalDelta > 0.08) {
      return aCenterY - bCenterY;
    }

    // On same band: sort by X
    return isRTL ? bCenterX - aCenterX : aCenterX - bCenterX;
  });

  // Re-index reading_order sequentially 0, 1, 2, ...
  return sorted.map((el, idx) => ({
    ...el,
    reading_order: idx,
  }));
}

/**
 * Deduplicates overlapping text elements with IoU > 0.85, retaining the highest confidence one.
 */
export function deduplicateTextElements(elements: TextElement[]): TextElement[] {
  const result: TextElement[] = [];

  for (const el of elements) {
    const isDuplicate = result.some((existing) => {
      const iou = calculateIoU(existing.bounding_box, el.bounding_box);
      return iou > 0.85;
    });

    if (!isDuplicate) {
      result.push(el);
    } else {
      // Find matching existing and replace if new confidence is higher
      const matchIdx = result.findIndex(
        (existing) => calculateIoU(existing.bounding_box, el.bounding_box) > 0.85
      );
      if (matchIdx !== -1 && el.confidence > result[matchIdx].confidence) {
        result[matchIdx] = el;
      }
    }
  }

  return result;
}

/**
 * Normalizes raw AI text detection responses, sanitizes bounding boxes, validates schemas,
 * assigns deterministic reading order, and returns canonical TextElement[].
 */
export function normalizeAndValidateAITextAnalysis(
  rawResponse: unknown,
  provenance: AnalysisSource,
  readingDirection: string = 'top-to-bottom'
): TextElement[] {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return [];
  }

  // Handle case where rawResponse is array directly or wrapped in { text_elements: [...] }
  let rawElements: any[] = [];
  if (Array.isArray(rawResponse)) {
    rawElements = rawResponse;
  } else if ('text_elements' in rawResponse && Array.isArray((rawResponse as any).text_elements)) {
    rawElements = (rawResponse as any).text_elements;
  } else if ('texts' in rawResponse && Array.isArray((rawResponse as any).texts)) {
    rawElements = (rawResponse as any).texts;
  } else if ('bubbles' in rawResponse && Array.isArray((rawResponse as any).bubbles)) {
    rawElements = (rawResponse as any).bubbles;
  }

  // Parse against AITextAnalysisResponseSchema safely
  const parsedResponse = AITextAnalysisResponseSchema.safeParse({ text_elements: rawElements });
  const elementsToProcess = parsedResponse.success
    ? parsedResponse.data.text_elements || []
    : rawElements;

  const validElements: TextElement[] = [];

  elementsToProcess.forEach((raw, idx) => {
    const content = (raw.content || raw.text || '').trim();
    const type = normalizeTextElementType(raw.type);

    const bounding_box = normalizeBoundingBox(raw.bounding_box) || {
      x: 0.1,
      y: 0.1 + idx * 0.15,
      width: 0.35,
      height: 0.12,
    };

    let confidence = typeof raw.confidence === 'number' ? raw.confidence : 0.9;
    confidence = Math.max(0, Math.min(1, confidence));

    let ocr_confidence = typeof raw.ocr_confidence === 'number' ? raw.ocr_confidence : confidence;
    ocr_confidence = Math.max(0, Math.min(1, ocr_confidence));

    let speaker_reference =
      typeof raw.speaker_reference === 'string' && raw.speaker_reference.trim().length > 0
        ? raw.speaker_reference.trim()
        : undefined;

    // Reject fictional made-up character names or placeholders
    if (speaker_reference && (speaker_reference.toLowerCase() === 'unknown' || speaker_reference.toLowerCase() === 'none' || speaker_reference.toLowerCase() === 'null')) {
      speaker_reference = undefined;
    }

    const element: TextElement = {
      text_id: `txt_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      content,
      bounding_box,
      reading_order: typeof raw.reading_order === 'number' ? raw.reading_order : idx,
      speaker_reference,
      confidence,
      ocr_confidence,
      source: 'ai',
    };

    const validated = TextElementSchema.safeParse(element);
    if (validated.success) {
      validElements.push(validated.data as TextElement);
    } else {
      console.warn('Text element failed schema validation, skipping:', validated.error.format());
    }
  });

  // Deduplicate near-identical detections
  const deduped = deduplicateTextElements(validElements);

  // Deterministically sort reading order
  const ordered = sortTextElementsReadingOrder(deduped, readingDirection);

  return ordered;
}
