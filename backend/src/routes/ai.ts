import express, { Request, Response } from 'express';
import { validate } from '../middleware/validate';
import {
  generateTextSchema,
  translateWordSchema,
  pronunciationSchema,
  exampleSentencesSchema,
} from '../schemas';
import { aiContentService } from '../services/aiContentService';
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
    console.log(`🤖 Generating text with ${provider} (model: ${model}) for ${level} level`);

    const aiResponse = await aiContentService.generateReadingText(
      { provider, apiToken, model },
      level,
      customPrompt,
    );

    if (aiResponse.success && aiResponse.text) {
      console.log(`✅ Successfully generated AI text with ${provider}`);
      return res.json({ success: true, text: aiResponse.text });
    }

    console.log(`⚠️ AI generation failed for ${provider}: ${aiResponse.error}`);
    return res.status(400).json({
      success: false,
      error: `AI text generation failed: ${aiResponse.error || 'Unknown error'}.`
    });
  } catch (error) {
    console.error('Unhandled text generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred on the server.'
    });
  }
});

aiRouter.post('/translate-word', validate(translateWordSchema), async (req: Request, res: Response<TranslateResponse>) => {
  try {
    const { word, targetLanguage, languageCode, contextSentence, aiToken, provider, model }: TranslateWordBody = req.body;
    console.log(`📝 Translation request: word="${word}", lang="${targetLanguage}", provider="${provider}"`);

    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for translation'
      });
    }

    console.log(`🔤 Translating "${word}" to ${targetLanguage} (${languageCode})`);

    const result = await aiContentService.translateWord(
      { provider, apiToken: aiToken, model },
      { word, targetLanguage, contextSentence },
    );

    if (result.success) {
      return res.json(result);
    }

    return res.status(502).json(result);
  } catch (error) {
    console.error('Word translation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to translate word'
    });
  }
});

aiRouter.post('/pronunciation', validate(pronunciationSchema), async (req: Request, res: Response<PronunciationResponse>) => {
  try {
    const { word, aiToken, provider, model }: PronunciationBody = req.body;
    console.log(`🔊 Pronunciation request: word="${word}", provider="${provider}"`);

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
    console.error('Pronunciation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get pronunciation'
    });
  }
});

aiRouter.post('/example-sentences', validate(exampleSentencesSchema), async (req: Request, res: Response<ExampleSentencesResponse>) => {
  try {
    const { word, level, aiToken, provider, model }: ExampleSentencesBody = req.body;
    console.log(`📝 Example sentences request: word="${word}", level="${level}", provider="${provider}"`);

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
    console.error('Example sentences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate example sentences'
    });
  }
});
