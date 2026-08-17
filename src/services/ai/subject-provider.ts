/**
 * Part 2.4 — Subject & Character AI Response Normalizer & Provider Definitions
 * 
 * Provides normalization, coordinate clamping, duplicate filtering, deterministic
 * sorting, and strict Zod validation for subject and character detections.
 */

import {
  Subject,
  CharacterDetection,
  SubjectType,
  SubjectVisibility,
  SubjectImportance,
  CharacterVisibility,
  CharacterScreenPosition,
  BoundingBox,
  AnalysisSource,
  AnalysisError,
} from '../../types';
import {
  AISubjectDetectionResponseSchema,
  SubjectSchema,
  CharacterDetectionSchema,
} from '../../data/schemas/visual-analysis.schema';

export interface SubjectDetectionPromptPayload {
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
 * Normalizes subject category into canonical SubjectType enum.
 */
export function normalizeSubjectType(input?: string): SubjectType {
  if (!input) return 'other';
  const cleaned = input.toLowerCase().trim().replace(/[-_]/g, ' ');
  
  if (
    cleaned === 'character' ||
    cleaned === 'human' ||
    cleaned === 'person' ||
    cleaned === 'man' ||
    cleaned === 'woman' ||
    cleaned === 'boy' ||
    cleaned === 'girl' ||
    cleaned === 'figure'
  ) {
    return 'character';
  }
  if (cleaned === 'face' || cleaned === 'head' || cleaned === 'portrait') {
    return 'face';
  }
  if (cleaned === 'creature' || cleaned === 'monster' || cleaned === 'animal' || cleaned === 'beast' || cleaned === 'demon') {
    return 'creature';
  }
  if (
    cleaned === 'weapon' ||
    cleaned === 'sword' ||
    cleaned === 'blade' ||
    cleaned === 'gun' ||
    cleaned === 'dagger' ||
    cleaned === 'spear' ||
    cleaned === 'bow' ||
    cleaned === 'shield'
  ) {
    return 'weapon';
  }
  if (cleaned === 'vehicle' || cleaned === 'car' || cleaned === 'carriage' || cleaned === 'wagon' || cleaned === 'ship' || cleaned === 'airplane') {
    return 'vehicle';
  }
  if (
    cleaned === 'effect' ||
    cleaned === 'vfx' ||
    cleaned === 'magic' ||
    cleaned === 'fire' ||
    cleaned === 'explosion' ||
    cleaned === 'smoke' ||
    cleaned === 'lightning' ||
    cleaned === 'energy' ||
    cleaned === 'aura' ||
    cleaned === 'impact'
  ) {
    return 'effect';
  }
  if (
    cleaned === 'environment' ||
    cleaned === 'scenery' ||
    cleaned === 'building' ||
    cleaned === 'door' ||
    cleaned === 'window' ||
    cleaned === 'throne' ||
    cleaned === 'landmark' ||
    cleaned === 'structure'
  ) {
    return 'environment';
  }
  if (cleaned === 'object' || cleaned === 'item' || cleaned === 'prop' || cleaned === 'artifact' || cleaned === 'phone' || cleaned === 'book') {
    return 'object';
  }
  return 'other';
}

/**
 * Normalizes subject visibility into canonical SubjectVisibility enum.
 */
export function normalizeSubjectVisibility(input?: string): SubjectVisibility | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim().replace(/[- ]/g, '_');
  switch (cleaned) {
    case 'fully_visible':
    case 'full':
    case 'visible':
      return 'fully_visible';
    case 'partially_visible':
    case 'partial':
      return 'partially_visible';
    case 'occluded':
    case 'blocked':
    case 'hidden':
      return 'occluded';
    case 'silhouette':
    case 'shadow':
      return 'silhouette';
    case 'cropped':
    case 'cut_off':
      return 'cropped';
    default:
      return 'partially_visible';
  }
}

/**
 * Normalizes subject importance into canonical SubjectImportance enum.
 */
export function normalizeSubjectImportance(input?: string): SubjectImportance | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim();
  switch (cleaned) {
    case 'primary':
    case 'main':
    case 'focal':
    case 'major':
      return 'primary';
    case 'secondary':
    case 'supporting':
    case 'medium':
      return 'secondary';
    case 'background':
    case 'minor':
      return 'background';
    case 'incidental':
    case 'small':
    case 'trivial':
      return 'incidental';
    default:
      return 'secondary';
  }
}

/**
 * Normalizes character visibility coverage into canonical CharacterVisibility enum.
 */
export function normalizeCharacterVisibility(input?: string): CharacterVisibility | undefined {
  if (!input) return undefined;
  const cleaned = input.toLowerCase().trim().replace(/[- ]/g, '_');
  switch (cleaned) {
    case 'full_body':
    case 'full':
    case 'entire':
      return 'full_body';
    case 'upper_body':
    case 'upper':
    case 'half_body':
    case 'torso':
      return 'upper_body';
    case 'bust':
    case 'chest_up':
    case 'shoulder':
      return 'bust';
    case 'face_only':
    case 'face':
    case 'head':
    case 'closeup':
      return 'face_only';
    case 'partial':
    case 'partially_visible':
    case 'cropped':
      return 'partial';
    case 'obscured':
    case 'occluded':
    case 'silhouette':
      return 'obscured';
    default:
      return 'partial';
  }
}

/**
 * Derives or normalizes screen position from string or bounding box center.
 */
export function normalizeCharacterScreenPosition(
  input?: string,
  box?: BoundingBox
): CharacterScreenPosition | undefined {
  if (input) {
    const cleaned = input.toLowerCase().trim().replace(/[- ]/g, '_');
    switch (cleaned) {
      case 'left':
      case 'upper_left':
      case 'lower_left':
      case 'middle_left':
        return 'left';
      case 'center':
      case 'upper_center':
      case 'middle_center':
      case 'lower_center':
      case 'middle':
        return 'center';
      case 'right':
      case 'upper_right':
      case 'lower_right':
      case 'middle_right':
        return 'right';
      case 'top':
      case 'upper':
        return 'top';
      case 'bottom':
      case 'lower':
        return 'bottom';
      case 'background':
      case 'bg':
      case 'distant':
        return 'background';
    }
  }

  // Derive from bounding box geometry if not explicitly classified
  if (box) {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    if (box.width < 0.2 && box.height < 0.2 && (centerY < 0.35 || centerY > 0.75)) {
      return 'background';
    }
    if (centerX < 0.35) {
      return 'left';
    }
    if (centerX > 0.65) {
      return 'right';
    }
    if (centerY < 0.3 && box.height < 0.4) {
      return 'top';
    }
    if (centerY > 0.7 && box.height < 0.4) {
      return 'bottom';
    }
    return 'center';
  }

  return undefined;
}

/**
 * Normalizes bounding box coordinates with clamping to [0.0, 1.0].
 * Returns null if bounding box is fundamentally malformed or non-numeric.
 */
export function normalizeBoundingBox(raw?: any): BoundingBox | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawX = Number(raw.x);
  const rawY = Number(raw.y);
  const rawW = Number(raw.width ?? raw.w);
  const rawH = Number(raw.height ?? raw.h);

  if (isNaN(rawX) || isNaN(rawY) || isNaN(rawW) || isNaN(rawH)) {
    return null;
  }

  // Clamp left and top
  const x = Math.max(0, Math.min(1, rawX));
  const y = Math.max(0, Math.min(1, rawY));

  // Clamp width and height ensuring inside boundaries
  const maxW = 1 - x;
  const maxH = 1 - y;
  const width = Math.max(0.001, Math.min(maxW, rawW));
  const height = Math.max(0.001, Math.min(maxH, rawH));

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    width: Number(width.toFixed(4)),
    height: Number(height.toFixed(4)),
  };
}

/**
 * Calculates Intersection over Union (IoU) between two bounding boxes.
 */
export function calculateIoU(a: BoundingBox, b: BoundingBox): number {
  const xA = Math.max(a.x, b.x);
  const yA = Math.max(a.y, b.y);
  const xB = Math.min(a.x + a.width, b.x + b.width);
  const yB = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const interArea = interW * interH;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Deterministically sorts subjects by importance, vertical position, horizontal position, and ID.
 */
export function sortSubjectsDeterministically(subjects: Subject[]): Subject[] {
  const importanceRank: Record<SubjectImportance, number> = {
    primary: 0,
    secondary: 1,
    background: 2,
    incidental: 3,
  };

  return [...subjects].sort((a, b) => {
    const rankA = a.importance ? importanceRank[a.importance] ?? 1 : 1;
    const rankB = b.importance ? importanceRank[b.importance] ?? 1 : 1;
    if (rankA !== rankB) return rankA - rankB;

    if (Math.abs(a.bounding_box.y - b.bounding_box.y) > 0.05) {
      return a.bounding_box.y - b.bounding_box.y;
    }
    if (Math.abs(a.bounding_box.x - b.bounding_box.x) > 0.05) {
      return a.bounding_box.x - b.bounding_box.x;
    }
    return a.subject_id.localeCompare(b.subject_id);
  });
}

/**
 * Deterministically sorts characters by bounding area (prominence), vertical position, and ID.
 */
export function sortCharactersDeterministically(characters: CharacterDetection[]): CharacterDetection[] {
  return [...characters].sort((a, b) => {
    const areaA = a.bounding_box.width * a.bounding_box.height;
    const areaB = b.bounding_box.width * b.bounding_box.height;
    if (Math.abs(areaA - areaB) > 0.05) {
      return areaB - areaA; // larger characters first
    }

    if (Math.abs(a.bounding_box.y - b.bounding_box.y) > 0.05) {
      return a.bounding_box.y - b.bounding_box.y;
    }
    if (Math.abs(a.bounding_box.x - b.bounding_box.x) > 0.05) {
      return a.bounding_box.x - b.bounding_box.x;
    }
    return a.detection_id.localeCompare(b.detection_id);
  });
}

/**
 * Parses, validates, and normalizes AI response into canonical Subject and CharacterDetection structures.
 */
export function normalizeAndValidateAISubjectDetection(
  raw: unknown,
  provenance: AnalysisSource,
  panelIdPrefix: string = 'panel'
): {
  subjects: Subject[];
  characters: CharacterDetection[];
} {
  if (!raw || typeof raw !== 'object') {
    const err: AnalysisError = {
      code: 'MALFORMED_AI_RESPONSE',
      stage: 'subjects',
      message: 'Subject detection AI response was not a valid object',
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    throw err;
  }

  // 1. Zod parse against raw AI schema
  const parsedResult = AISubjectDetectionResponseSchema.safeParse(raw);
  if (!parsedResult.success) {
    const err: AnalysisError = {
      code: 'SCHEMA_VALIDATION_FAILED',
      stage: 'subjects',
      message: `AI subject detection response failed schema validation: ${parsedResult.error.message}`,
      retryable: false,
      occurred_at: new Date().toISOString(),
    };
    throw err;
  }

  const data = parsedResult.data;
  const rawSubjects = data.subjects || [];
  const rawCharacters = data.characters || [];

  const validatedSubjects: Subject[] = [];
  const validatedCharacters: CharacterDetection[] = [];

  // 2. Process Raw Characters
  rawCharacters.forEach((rc, idx) => {
    const box = normalizeBoundingBox(rc.bounding_box);
    if (!box) return; // Skip if box is invalid

    let faceBox: BoundingBox | undefined = undefined;
    if (rc.face_region) {
      const parsedFace = normalizeBoundingBox(rc.face_region);
      if (parsedFace) {
        faceBox = parsedFace;
      }
    }

    const confidence = Math.max(0, Math.min(1, rc.confidence !== undefined ? Number(rc.confidence) : 0.85));
    const visibility = normalizeCharacterVisibility(rc.visibility);
    const screenPosition = normalizeCharacterScreenPosition(rc.screen_position, box);

    const characterDetection: CharacterDetection = {
      detection_id: `det_${panelIdPrefix}_c${idx + 1}`,
      label: rc.label?.trim() || `Character ${idx + 1}`,
      bounding_box: box,
      face_region: faceBox,
      visibility,
      pose: rc.pose?.trim() || undefined,
      expression: rc.expression?.trim() || undefined,
      action: rc.action?.trim() || undefined,
      screen_position: screenPosition,
      confidence: Number(confidence.toFixed(3)),
    };

    // Zod validate canonical CharacterDetection
    const charValidation = CharacterDetectionSchema.safeParse(characterDetection);
    if (charValidation.success) {
      // Check for duplicates with IoU > 0.85
      const duplicateIdx = validatedCharacters.findIndex(
        (c) => calculateIoU(c.bounding_box, characterDetection.bounding_box) > 0.85
      );
      if (duplicateIdx >= 0) {
        // Keep the one with higher confidence or face region
        if (
          characterDetection.face_region && !validatedCharacters[duplicateIdx].face_region ||
          characterDetection.confidence > validatedCharacters[duplicateIdx].confidence
        ) {
          validatedCharacters[duplicateIdx] = characterDetection;
        }
      } else {
        validatedCharacters.push(characterDetection);
      }
    }
  });

  // 3. Process Raw Subjects
  rawSubjects.forEach((rs, idx) => {
    const box = normalizeBoundingBox(rs.bounding_box);
    if (!box) return;

    const confidence = Math.max(0, Math.min(1, rs.confidence !== undefined ? Number(rs.confidence) : 0.85));
    const type = normalizeSubjectType(rs.type);
    const visibility = normalizeSubjectVisibility(rs.visibility);
    const importance = normalizeSubjectImportance(rs.importance);

    const subject: Subject = {
      subject_id: `sub_${panelIdPrefix}_s${idx + 1}`,
      type,
      label: rs.label?.trim() || `${type} ${idx + 1}`,
      bounding_box: box,
      visibility,
      importance: importance || (type === 'character' ? 'primary' : 'secondary'),
      confidence: Number(confidence.toFixed(3)),
      source: 'ai',
    };

    const subjValidation = SubjectSchema.safeParse(subject);
    if (subjValidation.success) {
      // Deduplicate subjects with IoU > 0.85 of same type
      const dupIdx = validatedSubjects.findIndex(
        (s) => s.type === subject.type && calculateIoU(s.bounding_box, subject.bounding_box) > 0.85
      );
      if (dupIdx >= 0) {
        if (subject.confidence > validatedSubjects[dupIdx].confidence) {
          validatedSubjects[dupIdx] = subject;
        }
      } else {
        validatedSubjects.push(subject);
      }
    }
  });

  // 4. If characters were detected but not present in subjects, sync character subjects
  validatedCharacters.forEach((vc, idx) => {
    const alreadyInSubjects = validatedSubjects.some(
      (s) => s.type === 'character' && calculateIoU(s.bounding_box, vc.bounding_box) > 0.6
    );
    if (!alreadyInSubjects) {
      const derivedSubject: Subject = {
        subject_id: `sub_${panelIdPrefix}_c${idx + 1}`,
        type: 'character',
        label: vc.label || `Character ${idx + 1}`,
        bounding_box: vc.bounding_box,
        visibility: vc.visibility === 'full_body' ? 'fully_visible' : 'partially_visible',
        importance: 'primary',
        confidence: vc.confidence,
        source: 'ai',
      };
      if (SubjectSchema.safeParse(derivedSubject).success) {
        validatedSubjects.push(derivedSubject);
      }
    }
  });

  // 5. Sort deterministically
  const sortedSubjects = sortSubjectsDeterministically(validatedSubjects);
  const sortedCharacters = sortCharactersDeterministically(validatedCharacters);

  return {
    subjects: sortedSubjects,
    characters: sortedCharacters,
  };
}
