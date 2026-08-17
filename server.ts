import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  COMPOSITION_SYSTEM_INSTRUCTION,
  COMPOSITION_ANALYSIS_PROMPT,
} from './src/features/analysis/prompts/composition.prompt';
import {
  SUBJECT_DETECTION_SYSTEM_INSTRUCTION,
  SUBJECT_DETECTION_ANALYSIS_PROMPT,
} from './src/features/analysis/prompts/subject-detection.prompt';
import {
  TEXT_ANALYSIS_SYSTEM_INSTRUCTION,
  TEXT_ANALYSIS_USER_PROMPT,
} from './src/features/analysis/prompts/text-analysis.prompt';
import {
  SCENE_ACTION_SYSTEM_INSTRUCTION,
  SCENE_ACTION_ANALYSIS_PROMPT,
} from './src/features/analysis/prompts/scene-action.prompt';
import {
  FOCUS_SALIENCE_SYSTEM_INSTRUCTION,
  FOCUS_SALIENCE_ANALYSIS_PROMPT,
} from './src/features/analysis/prompts/focus-salience.prompt';
import {
  CONTINUITY_SYSTEM_INSTRUCTION,
  CONTINUITY_ANALYSIS_PROMPT,
} from './src/features/analysis/prompts/continuity.prompt';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON payload parser for base64 analysis proxy images
  app.use(express.json({ limit: '30mb' }));

  // API Routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/analysis/composition', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', panelId, context } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          code: 'MISSING_IMAGE_DATA',
          message: 'Image data (base64) is required for visual composition analysis',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(401).json({
          code: 'PROVIDER_AUTH_MISSING',
          message: 'GEMINI_API_KEY is not configured in the workspace environment.',
        });
      }

      const ai = getGenAI();

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          COMPOSITION_ANALYSIS_PROMPT +
            (context?.readingDirection ? `\nReading direction context: ${context.readingDirection}` : ''),
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
        config: {
          systemInstruction: COMPOSITION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text || '';
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        return res.status(502).json({
          code: 'MALFORMED_AI_RESPONSE',
          message: 'AI response could not be parsed as JSON',
          rawText: responseText.slice(0, 1000),
        });
      }

      return res.json({
        success: true,
        panelId,
        composition: parsedJson,
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
      });
    } catch (err: any) {
      console.error('Composition analysis error:', err);
      const isAuthError = err.message?.includes('API key') || err.status === 401 || err.status === 403;
      return res.status(isAuthError ? 401 : 500).json({
        code: isAuthError ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR',
        message: err.message || 'Internal server error during composition analysis',
      });
    }
  });

  app.post('/api/analysis/subjects', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', panelId, context } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          code: 'MISSING_IMAGE_DATA',
          message: 'Image data (base64) is required for subject & character detection',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(401).json({
          code: 'PROVIDER_AUTH_MISSING',
          message: 'GEMINI_API_KEY is not configured in the workspace environment.',
        });
      }

      const ai = getGenAI();

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          SUBJECT_DETECTION_ANALYSIS_PROMPT +
            (context?.readingDirection ? `\nReading direction context: ${context.readingDirection}` : ''),
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
        config: {
          systemInstruction: SUBJECT_DETECTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        return res.status(502).json({
          code: 'MALFORMED_AI_RESPONSE',
          message: 'AI response could not be parsed as JSON',
          rawText: responseText.slice(0, 1000),
        });
      }

      return res.json({
        success: true,
        panelId,
        detections: parsedJson,
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
      });
    } catch (err: any) {
      console.error('Subject detection analysis error:', err);
      const isAuthError = err.message?.includes('API key') || err.status === 401 || err.status === 403;
      return res.status(isAuthError ? 401 : 500).json({
        code: isAuthError ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR',
        message: err.message || 'Internal server error during subject detection analysis',
      });
    }
  });

  app.post('/api/analysis/text', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', panelId, context } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          code: 'MISSING_IMAGE_DATA',
          message: 'Image data (base64) is required for text and speech-bubble analysis',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(401).json({
          code: 'PROVIDER_AUTH_MISSING',
          message: 'GEMINI_API_KEY is not configured in the workspace environment.',
        });
      }

      const ai = getGenAI();

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          TEXT_ANALYSIS_USER_PROMPT +
            (context?.readingDirection ? `\nReading direction context: ${context.readingDirection}` : ''),
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
        config: {
          systemInstruction: TEXT_ANALYSIS_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        return res.status(502).json({
          code: 'MALFORMED_AI_RESPONSE',
          message: 'AI response could not be parsed as JSON',
          rawText: responseText.slice(0, 1000),
        });
      }

      return res.json({
        success: true,
        panelId,
        text_elements: parsedJson.text_elements || (Array.isArray(parsedJson) ? parsedJson : []),
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
      });
    } catch (err: any) {
      console.error('Text analysis error:', err);
      const isAuthError = err.message?.includes('API key') || err.status === 401 || err.status === 403;
      return res.status(isAuthError ? 401 : 500).json({
        code: isAuthError ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR',
        message: err.message || 'Internal server error during text analysis',
      });
    }
  });

  app.post('/api/analysis/scene-action', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', panelId, context } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          code: 'MISSING_IMAGE_DATA',
          message: 'Image data (base64) is required for scene and action analysis',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(401).json({
          code: 'PROVIDER_AUTH_MISSING',
          message: 'GEMINI_API_KEY is not configured in the workspace environment.',
        });
      }

      const ai = getGenAI();

      let contextPrompt = '';
      if (context?.characters && Array.isArray(context.characters) && context.characters.length > 0) {
        contextPrompt += `\nPreviously detected characters in panel: ${JSON.stringify(context.characters.map((c: any) => ({ id: c.id || c.detection_id, label: c.label })))}`;
      }
      if (context?.subjects && Array.isArray(context.subjects) && context.subjects.length > 0) {
        contextPrompt += `\nPreviously detected subjects in panel: ${JSON.stringify(context.subjects.map((s: any) => ({ id: s.id || s.subject_id, label: s.label, type: s.type })))}`;
      }
      if (context?.textElements && Array.isArray(context.textElements) && context.textElements.length > 0) {
        contextPrompt += `\nVisible dialogue/text in panel (use as context, not proof of action): ${JSON.stringify(context.textElements.map((t: any) => ({ id: t.text_id, type: t.type, content: t.content })))}`;
      }
      if (context?.readingDirection) {
        contextPrompt += `\nReading direction context: ${context.readingDirection}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          SCENE_ACTION_ANALYSIS_PROMPT + contextPrompt,
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
        config: {
          systemInstruction: SCENE_ACTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        return res.status(502).json({
          code: 'MALFORMED_AI_RESPONSE',
          message: 'AI response could not be parsed as JSON',
          rawText: responseText.slice(0, 1000),
        });
      }

      return res.json({
        success: true,
        panelId,
        analysis: parsedJson,
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
      });
    } catch (err: any) {
      console.error('Scene & Action analysis error:', err);
      const isAuthError = err.message?.includes('API key') || err.status === 401 || err.status === 403;
      return res.status(isAuthError ? 401 : 500).json({
        code: isAuthError ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR',
        message: err.message || 'Internal server error during scene & action analysis',
      });
    }
  });

  // Part 2.7: Visual Focus & Salience Analysis Endpoint
  app.post('/api/analysis/focus', async (req, res) => {
    try {
      const { imageBase64, mimeType, panelId, context } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          code: 'INVALID_PAYLOAD',
          message: 'Image binary data (imageBase64) is required for focus & salience analysis',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(401).json({
          code: 'PROVIDER_AUTH_MISSING',
          message: 'Gemini API key is not configured on the server',
        });
      }

      const ai = getGenAI();

      let contextPrompt = '';
      if (context?.characters && Array.isArray(context.characters) && context.characters.length > 0) {
        contextPrompt += `\nPreviously detected characters in panel: ${JSON.stringify(context.characters.map((c: any) => ({ id: c.id || c.detection_id, label: c.label, region: c.bounding_box })))}`;
      }
      if (context?.subjects && Array.isArray(context.subjects) && context.subjects.length > 0) {
        contextPrompt += `\nPreviously detected subjects in panel: ${JSON.stringify(context.subjects.map((s: any) => ({ id: s.id || s.subject_id, label: s.label, type: s.type, region: s.bounding_box })))}`;
      }
      if (context?.textElements && Array.isArray(context.textElements) && context.textElements.length > 0) {
        contextPrompt += `\nVisible dialogue/text in panel: ${JSON.stringify(context.textElements.map((t: any) => ({ id: t.text_id, type: t.type, content: t.content, region: t.bounding_box })))}`;
      }
      if (context?.scene) {
        contextPrompt += `\nScene context: ${JSON.stringify({ location: context.scene.location, setting: context.scene.indoor_outdoor, time: context.scene.time_context })}`;
      }
      if (context?.actions && Array.isArray(context.actions) && context.actions.length > 0) {
        contextPrompt += `\nPhysical actions: ${JSON.stringify(context.actions.map((a: any) => ({ type: a.type, actor: a.actor_subject_id, target: a.target_subject_id, intensity: a.intensity })))}`;
      }
      if (context?.readingDirection) {
        contextPrompt += `\nReading direction context: ${context.readingDirection}`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [
          FOCUS_SALIENCE_ANALYSIS_PROMPT + contextPrompt,
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
        config: {
          systemInstruction: FOCUS_SALIENCE_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        return res.status(502).json({
          code: 'MALFORMED_AI_RESPONSE',
          message: 'AI response could not be parsed as JSON',
          rawText: responseText.slice(0, 1000),
        });
      }

      return res.json({
        success: true,
        panelId,
        analysis: parsedJson,
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
      });
    } catch (err: any) {
      console.error('Visual Focus & Salience analysis error:', err);
      const isAuthError = err.message?.includes('API key') || err.status === 401 || err.status === 403;
      return res.status(isAuthError ? 401 : 500).json({
        code: isAuthError ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR',
        message: err.message || 'Internal server error during visual focus & salience analysis',
      });
    }
  });

  app.post('/api/analysis/continuity', async (req, res) => {
    try {
      const {
        currentImageBase64,
        previousImageBase64,
        nextImageBase64,
        currentPanelId,
        previousPanelId,
        nextPanelId,
        currentContext,
        previousContext,
        nextContext,
        mimeType = 'image/jpeg',
      } = req.body;

      if (!currentImageBase64) {
        return res.status(400).json({
          code: 'MISSING_IMAGE_DATA',
          message: 'Current panel image data (base64) is required for continuity analysis',
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(401).json({
          code: 'PROVIDER_AUTH_MISSING',
          message: 'GEMINI_API_KEY is not configured in the workspace environment.',
        });
      }

      const ai = getGenAI();

      let contextPrompt = `\n\n--- PANEL CONTEXT DATA ---\n`;
      if (previousPanelId && previousContext) {
        contextPrompt += `\n[PRECEDING PANEL ${previousContext.order !== undefined ? `#${previousContext.order + 1}` : ''} (ID: ${previousPanelId})]:\n` +
          `- Detected Characters: ${JSON.stringify(previousContext.characters || [])}\n` +
          `- Detected Subjects/Objects: ${JSON.stringify(previousContext.subjects || [])}\n` +
          `- Extracted Dialogue/Text: ${JSON.stringify((previousContext.textElements || []).map((t: any) => ({ id: t.text_id || t.id, type: t.type, content: t.content })))}\n` +
          `- Scene Context: ${JSON.stringify(previousContext.scene || {})}\n` +
          `- Actions: ${JSON.stringify(previousContext.actions || [])}\n` +
          `- Visual Focus: ${JSON.stringify(previousContext.visualFocus || {})}\n`;
      } else {
        contextPrompt += `\n[PRECEDING PANEL]: None (This is the first panel in sequence or no preceding panel provided).\n`;
      }

      contextPrompt += `\n[CURRENT PANEL ${currentContext?.order !== undefined ? `#${currentContext.order + 1}` : ''} (ID: ${currentPanelId})]:\n` +
        `- Detected Characters: ${JSON.stringify(currentContext?.characters || [])}\n` +
        `- Detected Subjects/Objects: ${JSON.stringify(currentContext?.subjects || [])}\n` +
        `- Extracted Dialogue/Text: ${JSON.stringify((currentContext?.textElements || []).map((t: any) => ({ id: t.text_id || t.id, type: t.type, content: t.content })))}\n` +
        `- Scene Context: ${JSON.stringify(currentContext?.scene || {})}\n` +
        `- Actions: ${JSON.stringify(currentContext?.actions || [])}\n` +
        `- Visual Focus: ${JSON.stringify(currentContext?.visualFocus || {})}\n`;

      if (nextPanelId && nextContext) {
        contextPrompt += `\n[SUCCEEDING PANEL ${nextContext.order !== undefined ? `#${nextContext.order + 1}` : ''} (ID: ${nextPanelId})]:\n` +
          `- Detected Characters: ${JSON.stringify(nextContext.characters || [])}\n` +
          `- Scene: ${JSON.stringify(nextContext.scene || {})}\n`;
      }

      const contents: any[] = [];
      contents.push(CONTINUITY_ANALYSIS_PROMPT + contextPrompt);

      if (previousImageBase64) {
        contents.push(`[Image 1: PRECEDING PANEL (ID: ${previousPanelId})]`);
        contents.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: previousImageBase64,
          },
        });
      }

      contents.push(`[Image ${previousImageBase64 ? '2' : '1'}: CURRENT PANEL (ID: ${currentPanelId})]`);
      contents.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: currentImageBase64,
        },
      });

      if (nextImageBase64) {
        contents.push(`[Image ${previousImageBase64 ? '3' : '2'}: SUCCEEDING PANEL (ID: ${nextPanelId})]`);
        contents.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: nextImageBase64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents,
        config: {
          systemInstruction: CONTINUITY_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (err: any) {
        return res.status(502).json({
          code: 'MALFORMED_AI_RESPONSE',
          message: 'AI response could not be parsed as JSON',
          rawText: responseText.slice(0, 1000),
        });
      }

      return res.json({
        success: true,
        panelId: currentPanelId,
        analysis: parsedJson,
        model: 'gemini-3.7-flash',
        model_version: '2026-03',
      });
    } catch (err: any) {
      console.error('Visual Continuity & Relationship analysis error:', err);
      const isAuthError = err.message?.includes('API key') || err.status === 401 || err.status === 403;
      return res.status(isAuthError ? 401 : 500).json({
        code: isAuthError ? 'PROVIDER_AUTH_MISSING' : 'API_ERROR',
        message: err.message || 'Internal server error during visual continuity analysis',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Manhwa Panel Analyzer Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
