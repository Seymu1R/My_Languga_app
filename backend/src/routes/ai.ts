import express, { Request, Response } from 'express';
import { validate } from '../middleware/validate';
import {
  generateTextSchema,
  translateWordSchema,
  pronunciationSchema,
  exampleSentencesSchema,
} from '../schemas';
import { aiContentService } from '../services/aiContentService';
import { logger } from '../utils/logger';
import type {
  GenerateTextBody,
  TranslateWordBody,
  PronunciationBody,
  ExampleSentencesBody,
  AITextResponse,
  TranslateResponse,
  PronunciationResponse,
  ExampleSentencesResponse,
} from '../types';

export const aiRouter = express.Router();

aiRouter.post('/generate-text', validate(generateTextSchema), async (req: Request, res: Response<AITextResponse>) => {
  try {
    const { level, apiToken, provider, model, customPrompt }: GenerateTextBody = req.body;
    logger.info({ provider, model, level }, 'Generating reading text');

    const aiResponse = await aiContentService.generateReadingText(
      { provider, apiToken, model },
      level,
      customPrompt,
    );

    if (aiResponse.success && aiResponse.text) {
      logger.info({ provider }, 'Reading text generated');
      return res.json({ success: true, text: aiResponse.text });
    }

    logger.warn({ provider, error: aiResponse.error }, 'AI generation failed');
    return res.status(400).json({
      success: false,
      error: `AI text generation failed: ${aiResponse.error || 'Unknown error'}.`
    });
  } catch (error) {
    logger.error({ err: error }, 'Unhandled text generation error');
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred on the server.'
    });
  }
});

aiRouter.post('/translate-word', validate(translateWordSchema), async (req: Request, res: Response<TranslateResponse>) => {
  try {
    const { word, targetLanguage, languageCode, contextSentence, aiToken, provider, model }: TranslateWordBody = req.body;
    logger.info({ word, targetLanguage, languageCode, provider }, 'Translation request');

    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for translation'
      });
    }

    const result = await aiContentService.translateWord(
      { provider, apiToken: aiToken, model },
      { word, targetLanguage, contextSentence },
    );

    if (result.success) {
      return res.json(result);
    }

    return res.status(502).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Word translation error');
    return res.status(500).json({
      success: false,
      error: 'Failed to translate word'
    });
  }
});

aiRouter.post('/pronunciation', validate(pronunciationSchema), async (req: Request, res: Response<PronunciationResponse>) => {
  try {
    const { word, aiToken, provider, model }: PronunciationBody = req.body;
    logger.info({ word, provider }, 'Pronunciation request');

    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for pronunciation'
      });
    }

    const result = await aiContentService.getPronunciation(
      { provider, apiToken: aiToken, model },
      word,
    );

    if (result.success) {
      return res.json(result);
    }

    return res.status(502).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Pronunciation error');
    return res.status(500).json({
      success: false,
      error: 'Failed to get pronunciation'
    });
  }
});

aiRouter.post('/example-sentences', validate(exampleSentencesSchema), async (req: Request, res: Response<ExampleSentencesResponse>) => {
  try {
    const { word, level, aiToken, provider, model }: ExampleSentencesBody = req.body;
    logger.info({ word, level, provider }, 'Example sentences request');

    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for generating example sentences'
      });
    }

    const result = await aiContentService.generateExampleSentences(
      { provider, apiToken: aiToken, model },
      word,
      level,
    );

    if (result.success) {
      return res.json(result);
    }

    return res.status(502).json(result);
  } catch (error) {
    logger.error({ err: error }, 'Example sentences error');
    return res.status(500).json({
      success: false,
      error: 'Failed to generate example sentences'
    });
  }
});
