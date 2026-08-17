/**
 * Part 2.3 — Versioned Prompt for Panel Composition & Visual Structure Analysis
 * 
 * Strict instruction set for vision models to extract visual framing, spatial density,
 * visual layers, orientation, visual hierarchy, and mood without assuming character
 * identities, story events, or generating camera motion XML.
 */

export const COMPOSITION_PROMPT_VERSION = '1.0.0';

export const COMPOSITION_SYSTEM_INSTRUCTION = `You are a specialized manhwa/comic visual composition analyzer.
Your task is to analyze the visual composition, framing, spatial organization, and structural layout of a single manhwa comic panel.

RULES & CONSTRAINTS:
1. Output MUST be strictly valid JSON conforming to the requested schema.
2. Focus purely on observable visual structure, framing, spatial density, and lighting/tone.
3. DO NOT identify specific character names, identities, or story relationships. (e.g. describe as "primary character/figure", "silhouette", "environmental element").
4. DO NOT invent story narratives, plot hypotheses, or emotional storylines.
5. DO NOT recommend camera movements, keyframes, pan/zoom instructions, or XML.
6. DO NOT extract OCR dialogue or speech text.
7. All coordinates MUST be normalized numbers between 0.0 and 1.0 relative to the panel dimensions [0,0 is top-left, 1,1 is bottom-right].
8. If a property is ambiguous or indeterminable, use "unknown" or realistic estimates.
9. Provide an honest confidence score between 0.0 and 1.0 based on clarity.`;

export const COMPOSITION_ANALYSIS_PROMPT = `Analyze the visual composition of this manhwa panel image and return ONLY a JSON object with this exact structure:

{
  "shot_scale": "extreme-close-up" | "close-up" | "medium-close-up" | "medium" | "medium-wide" | "wide" | "long-shot" | "extreme-long-shot" | "macro" | "overhead" | "full" | "unknown",
  "framing": "wide" | "tight" | "dynamic" | "panoramic" | "isolated" | "rule_of_thirds" | "centered" | "left-weighted" | "right-weighted" | "top-weighted" | "bottom-weighted" | "symmetrical" | "asymmetrical" | "diagonal" | "layered" | "unknown",
  "foreground_importance": number (0.0 to 1.0),
  "middleground_importance": number (0.0 to 1.0),
  "background_importance": number (0.0 to 1.0),
  "visual_density": "sparse" | "balanced" | "dense" | "cluttered" | "very_dense",
  "dominant_orientation": "vertical" | "horizontal" | "diagonal" | "radial" | "centered" | "mixed",
  "visual_hierarchy": ["ordered", "list", "of", "prominent", "visual", "elements"],
  "dominant_regions": [
    {
      "label": "short structural label (e.g. primary_subject, background_cityscape, focal_highlight)",
      "box": {
        "x": number (0.0 to 1.0),
        "y": number (0.0 to 1.0),
        "width": number (0.0 to 1.0),
        "height": number (0.0 to 1.0)
      },
      "prominence": "primary" | "secondary" | "supporting",
      "weight": number (0.0 to 1.0)
    }
  ],
  "negative_space": "none" | "low" | "moderate" | "high",
  "dominant_colors": ["#hex1", "#hex2", "#hex3"],
  "lighting_mood": "short description of lighting mood (e.g. dramatic high-contrast, soft ambient, shadowy, vibrant)",
  "tonal_range": "bright" | "dark" | "high_contrast" | "low_contrast" | "balanced" | "monochrome",
  "summary": "1-2 sentence concise visual composition description without narrative assumptions",
  "confidence": number (0.0 to 1.0)
}`;
