import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AIService } from '../services/aiService';
import { Word } from '../models/Word';
import { validate } from '../middleware/validate';
import {
  generateTextSchema,
  translateWordSchema,
  pronunciationSchema,
  exampleSentencesSchema,
} from '../schemas';
import type {
  GenerateTextBody,
  TranslateWordBody,
  PronunciationBody,
  ExampleSentencesBody,
  AITextResponse,
  TranslateResponse,
  PronunciationResponse,
  ExampleSentencesResponse,
  ProficiencyLevel,
} from '../types';

export const aiRouter = express.Router();

const LEVEL_GENERATION_CONFIG: Record<
  ProficiencyLevel,
  { minWords: number; maxWords: number; maxTokens: number }
> = {
  Elementary: { minWords: 170, maxWords: 190, maxTokens: 500 },
  'Pre-Intermediate': { minWords: 210, maxWords: 230, maxTokens: 600 },
  Intermediate: { minWords: 250, maxWords: 270, maxTokens: 700 },
  'Upper-Intermediate': { minWords: 310, maxWords: 330, maxTokens: 880 },
  Advanced: { minWords: 420, maxWords: 440, maxTokens: 1200 },
};

const buildReadingPrompt = (
  level: ProficiencyLevel,
  customPrompt?: string
) => {
  const cfg = LEVEL_GENERATION_CONFIG[level];

  if (customPrompt?.trim()) {
    return [
      `Task: ${customPrompt.trim()}`,
      `Audience: ${level} English learner.`,
      `You MUST write between ${cfg.minWords} and ${cfg.maxWords} words. Do NOT stop early. Minimum 10 sentences.`,
      'Output: one continuous passage only, no title, no list, no markdown, no extra notes.'
    ].join('\n');
  }

  return [
    `Write one original reading passage for ${level} English learners.`,
    `You MUST write between ${cfg.minWords} and ${cfg.maxWords} words. Do NOT stop early. Minimum 10 sentences.`,
    'Use level-appropriate grammar and vocabulary.',
    'Output only the passage text (single block), no title or extra formatting.'
  ].join('\n');
};

aiRouter.post('/generate-text', validate(generateTextSchema), async (req: Request, res: Response<AITextResponse>) => {
  try {
    const { level, apiToken, provider, model, customPrompt }: GenerateTextBody = req.body;
    // Validation: validate() middleware artıq level/apiToken/provider-i yoxlayır
    console.log(`🤖 Generating text with ${provider} (model: ${model}) for ${level} level`);

    const prompt = buildReadingPrompt(level, customPrompt);
    const levelConfig = LEVEL_GENERATION_CONFIG[level];

    // Use the unified AI service logic for all providers (OpenAI, Grok, Gemini, DeepSeek, Mistral).
    try {
      const aiService = new AIService({ provider, apiKey: apiToken, model });

      const aiResponse = await aiService.generateText({
        level,
        prompt,
        maxTokens: levelConfig.maxTokens,
        temperature: 0.55,
      });

      if (aiResponse.success && aiResponse.text) {
        console.log(`✅ Successfully generated AI text with ${provider}`);
        return res.json({ success: true, text: aiResponse.text });
      }

      console.log(`⚠️ AI generation failed for ${provider}: ${aiResponse.error}`);
      return res.status(400).json({
        success: false,
        error: `AI text generation failed: ${aiResponse.error || 'Unknown error'}.`
      });
    } catch (aiError: any) {
      console.log(`❌ AI service error for ${provider}: ${aiError}`);
      return res.status(500).json({
        success: false,
        error: `AI service error: ${aiError.message || 'Unknown error'}.`
      });
    }
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
    
    // Zod schema word/targetLanguage/languageCode-u yoxlayır
    console.log(`🔤 Translating "${word}" to ${targetLanguage} (${languageCode})`);

    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for translation'
      });
    }

    // RAG step: query MongoDB for previously saved translations of this word
    let mongoSenses: string[] = [];
    try {
      if (mongoose.connection.readyState === 1) {
        const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const savedEntries = await Word.find({
          english: { $regex: new RegExp(`^${safeWord}$`, 'i') }
        }).select('translation').lean();
        const unique = [...new Set(savedEntries.map((e: any) => e.translation).filter(Boolean))];
        mongoSenses = unique;
        if (mongoSenses.length > 0) {
          console.log(`📚 MongoDB senses for "${word}":`, mongoSenses);
        }
      }
    } catch (dbErr) {
      console.warn('⚠️ MongoDB sense lookup failed, proceeding without RAG:', dbErr);
    }

    // Layer 2: Free Dictionary API (only if MongoDB had no results)
    let dictDefinitions: string[] = [];
    if (mongoSenses.length === 0) {
      try {
        const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        if (dictRes.ok) {
          const dictData = await dictRes.json() as any[];
          console.log(`📖 Free Dictionary API response for "${word}":`, dictData);
          dictDefinitions = (dictData[0]?.meanings ?? [])
            .flatMap((m: any) => m.definitions.map((d: any) => `(${m.partOfSpeech}) ${d.definition}`))
            .slice(0, 3);
          if (dictDefinitions.length > 0) {
            console.log(`📖 Free Dictionary definitions for "${word}":`, dictDefinitions);
          }
        }
      } catch (dictErr) {
        console.warn('⚠️ Free Dictionary API lookup failed:', dictErr);
      }
    }

    // AI translation
    try {
      const aiService = new AIService({
        provider: provider as 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral',
        apiKey: aiToken,
        model: model
      });

      let translationPrompt: string;
      if (contextSentence?.trim() && mongoSenses.length > 0) {
        // Layer 1 hit: user's own dictionary + context
        const senseList = mongoSenses.map((s, i) => `${i + 1}. ${s}`).join(', ');
        translationPrompt = [
          `You are an English-${targetLanguage} language teacher helping a student understand word meanings.`,
          `Sentence: "${contextSentence.trim()}"`,
          `The student clicked on the word "${word}" in this sentence.`,
          `Known ${targetLanguage} translations from the student's dictionary: ${senseList}.`,
          `Select the translation that matches how "${word}" is used in this sentence. If none fit, provide the correct one.`,
          'Return ONLY the translation (max 3 words), no explanation, no punctuation.'
        ].join('\n');
      } else if (contextSentence?.trim() && dictDefinitions.length > 0) {
        // Layer 2 hit: Free Dictionary API definitions + context
        const defList = dictDefinitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
        translationPrompt = [
          `You are an English-${targetLanguage} language teacher.`,
          `Sentence: "${contextSentence.trim()}"`,
          `The student clicked on the word "${word}" in this sentence.`,
          `English dictionary definitions of "${word}":\n${defList}`,
          `Using the definition that matches the sentence, translate "${word}" to ${targetLanguage}.`,
          'Return ONLY the translation (max 3 words), no explanation, no punctuation.'
        ].join('\n');
      } else if (dictDefinitions.length > 0) {
        // Layer 2 hit: Free Dictionary API definitions, no context
        const defList = dictDefinitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
        translationPrompt = [
          `Translate the English word "${word}" to ${targetLanguage}.`,
          `English dictionary definitions:\n${defList}`,
          'Return only the most common translation (max 3 words), no explanation.'
        ].join('\n');
      } else if (contextSentence?.trim()) {
        // Layer 3: context only, no dictionary data
        translationPrompt = [
          `Translate the English word "${word}" to ${targetLanguage} based on its meaning in this sentence.`,
          `Sentence: "${contextSentence.trim()}"`,
          'Return only the translated word or very short phrase (max 3 words), no explanation.'
        ].join('\n');
      } else {
        // Layer 3: AI on its own
        translationPrompt = `Translate "${word}" from English to ${targetLanguage}. Return only the translation, no explanation.`;
      }

      const aiResponse = await aiService.generateText({
        level: 'Elementary',
        prompt: translationPrompt,
        maxTokens: 24,
        temperature: 0.1,
      });

      if (aiResponse.success && aiResponse.text) {
        const translation = aiResponse.text
          .trim()
          .replace(/^['"\s]+|['"\s]+$/g, '')
          .split(/\r?\n/)[0]
          .replace(/[.。!?]+$/g, '')
          .trim();
        console.log(`✅ AI translation successful: "${word}" → "${translation}"`);
        
        return res.json({
          success: true,
          translation: translation
        });
      }

      console.log(`⚠️ AI translation failed: ${aiResponse.error}`);
      return res.status(502).json({
        success: false,
        error: `Unable to translate "${word}". ${aiResponse.error}`
      });
    } catch (aiError) {
      console.log(`❌ AI translation error: ${aiError}`);
      return res.status(502).json({
        success: false,
        error: `Translation error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`
      });
    }
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
    
    // Zod schema word-u yoxlayır
    console.log(`🔊 Getting pronunciation for "${word}"`);

    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for pronunciation'
      });
    }

    // AI pronunciation
    try {
      const aiService = new AIService({
        provider: provider as 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral',
        apiKey: aiToken,
        model: model
      });

      const pronunciationPrompt = `Give IPA for "${word}". Return only one value in /slashes/.`;

      const aiResponse = await aiService.generateText({
        level: 'Elementary',
        prompt: pronunciationPrompt,
        maxTokens: 24,
        temperature: 0.1,
      });

      if (aiResponse.success && aiResponse.text) {
        const pronunciation = aiResponse.text.trim();
        console.log(`✅ AI pronunciation successful: "${word}" → "${pronunciation}"`);
        
        return res.json({
          success: true,
          pronunciation: pronunciation
        });
      }

      console.log(`⚠️ AI pronunciation failed: ${aiResponse.error}`);
      return res.status(502).json({
        success: false,
        error: `Unable to get pronunciation for "${word}". ${aiResponse.error}`
      });
    } catch (aiError) {
      console.log(`❌ AI pronunciation error: ${aiError}`);
      return res.status(502).json({
        success: false,
        error: `Pronunciation error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`
      });
    }
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

    // Zod schema word-u yoxlayır
    if (!aiToken || !provider) {
      return res.status(400).json({
        success: false,
        error: 'AI token and provider are required for generating example sentences'
      });
    }

    console.log(`📖 Generating example sentences for "${word}" at ${level || 'Intermediate'} level`);

    try {
      const aiService = new AIService({
        provider: provider as 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral',
        apiKey: aiToken,
        model: model
      });

      const sentencePrompt = [
        `Write exactly 3 short natural sentences using "${word}".`,
        `Level: ${level || 'Intermediate'}.`,
        'Output rules: one sentence per line, no numbering, no explanation.'
      ].join('\n');

      const aiResponse = await aiService.generateText({
        level: level || 'Intermediate',
        prompt: sentencePrompt,
        maxTokens: 110,
        temperature: 0.35,
      });

      if (aiResponse.success && aiResponse.text) {
        const sentences = aiResponse.text
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0 && s.toLowerCase().includes(word.toLowerCase()))
          .slice(0, 3);

        if (sentences.length === 0) {
          // Fallback: split by any line and take non-empty ones
          const fallbackSentences = aiResponse.text
            .split('\n')
            .map(s => s.replace(/^\d+[\.\)\-]\s*/, '').trim())
            .filter(s => s.length > 5)
            .slice(0, 3);

          console.log(`✅ Example sentences generated (fallback): ${fallbackSentences.length}`);
          return res.json({
            success: true,
            sentences: fallbackSentences
          });
        }

        console.log(`✅ Example sentences generated: ${sentences.length}`);
        return res.json({
          success: true,
          sentences
        });
      }

      console.log(`⚠️ Example sentences generation failed: ${aiResponse.error}`);
      return res.status(502).json({
        success: false,
        error: `Unable to generate example sentences for "${word}". ${aiResponse.error}`
      });
    } catch (aiError) {
      console.log(`❌ Example sentences error: ${aiError}`);
      return res.status(502).json({
        success: false,
        error: `Example sentences error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error('Example sentences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate example sentences'
    });
  }
});