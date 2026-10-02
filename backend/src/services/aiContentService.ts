import mongoose from 'mongoose';
import { AIService, AIServiceResponse } from './aiService';
import { Word, ENGLISH_COLLATION } from '../models/Word';
import { logger } from '../utils/logger';
import type {
  AIProvider,
  ProficiencyLevel,
  TranslateResponse,
  PronunciationResponse,
  ExampleSentencesResponse,
} from '../types';

export interface AIRequestConfig {
  provider: AIProvider;
  apiToken: string;
  model?: string;
}

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

// dictionaryapi.dev üçün gözləmə limiti — tərcümə bu API-dən asılı deyil, sadəcə zənginləşir
const DICTIONARY_API_TIMEOUT_MS = 3000;

const createAIService = (config: AIRequestConfig) =>
  new AIService({ provider: config.provider, apiKey: config.apiToken, model: config.model });

const buildReadingPrompt = (level: ProficiencyLevel, customPrompt?: string) => {
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

// RAG Layer 1: istifadəçinin öz lüğətindəki əvvəlki tərcümələr
const lookupSavedSenses = async (word: string): Promise<string[]> => {
  try {
    if (mongoose.connection.readyState !== 1) return [];

    // Regex (^word$, 'i') index-dən istifadə etmirdi; collation sorğusu english_unique_ci-dən keçir (#13)
    const savedEntries = await Word.find({ english: word }, null, { collation: ENGLISH_COLLATION })
      .select('translation')
      .lean();

    const senses = [...new Set(savedEntries.map((e: any) => e.translation).filter(Boolean))];
    if (senses.length > 0) {
      logger.info({ word, senses }, 'RAG layer 1 hit: saved senses found in MongoDB');
    }
    return senses;
  } catch (dbErr) {
    logger.warn({ err: dbErr }, 'MongoDB sense lookup failed, proceeding without RAG');
    return [];
  }
};

// RAG Layer 2: Free Dictionary API definitions
const lookupDictionaryDefinitions = async (word: string): Promise<string[]> => {
  try {
    // Siqnal həm sorğunu, həm də body oxunuşunu (json) kəsir — API cavab verməsə
    // tərcümə asılı qalmır, təriflərsiz davam edir (#12)
    const dictRes = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(DICTIONARY_API_TIMEOUT_MS) },
    );
    if (!dictRes.ok) return [];

    const dictData = await dictRes.json() as any[];
    const definitions = (dictData[0]?.meanings ?? [])
      .flatMap((m: any) => m.definitions.map((d: any) => `(${m.partOfSpeech}) ${d.definition}`))
      .slice(0, 3);

    if (definitions.length > 0) {
      logger.info({ word, definitions }, 'RAG layer 2 hit: Free Dictionary definitions found');
    }
    return definitions;
  } catch (dictErr) {
    if (dictErr instanceof Error && dictErr.name === 'TimeoutError') {
      logger.warn({ word, timeoutMs: DICTIONARY_API_TIMEOUT_MS }, 'Free Dictionary API timed out');
      return [];
    }
    logger.warn({ err: dictErr }, 'Free Dictionary API lookup failed');
    return [];
  }
};

// Mövcud məlumat qatlarına görə ən dəqiq tərcümə promptunu seç
const buildTranslationPrompt = (
  word: string,
  targetLanguage: string,
  contextSentence: string | undefined,
  mongoSenses: string[],
  dictDefinitions: string[],
): string => {
  if (contextSentence?.trim() && mongoSenses.length > 0) {
    // Layer 1 hit: user's own dictionary + context
    const senseList = mongoSenses.map((s, i) => `${i + 1}. ${s}`).join(', ');
    return [
      `You are an English-${targetLanguage} language teacher helping a student understand word meanings.`,
      `Sentence: "${contextSentence.trim()}"`,
      `The student clicked on the word "${word}" in this sentence.`,
      `Known ${targetLanguage} translations from the student's dictionary: ${senseList}.`,
      `Select the translation that matches how "${word}" is used in this sentence. If none fit, provide the correct one.`,
      'Return ONLY the translation (max 3 words), no explanation, no punctuation.'
    ].join('\n');
  }

  if (contextSentence?.trim() && dictDefinitions.length > 0) {
    // Layer 2 hit: Free Dictionary API definitions + context
    const defList = dictDefinitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
    return [
      `You are an English-${targetLanguage} language teacher.`,
      `Sentence: "${contextSentence.trim()}"`,
      `The student clicked on the word "${word}" in this sentence.`,
      `English dictionary definitions of "${word}":\n${defList}`,
      `Using the definition that matches the sentence, translate "${word}" to ${targetLanguage}.`,
      'Return ONLY the translation (max 3 words), no explanation, no punctuation.'
    ].join('\n');
  }

  if (dictDefinitions.length > 0) {
    // Layer 2 hit: definitions, no context
    const defList = dictDefinitions.map((d, i) => `${i + 1}. ${d}`).join('\n');
    return [
      `Translate the English word "${word}" to ${targetLanguage}.`,
      `English dictionary definitions:\n${defList}`,
      'Return only the most common translation (max 3 words), no explanation.'
    ].join('\n');
  }

  if (contextSentence?.trim()) {
    // Layer 3: context only, no dictionary data
    return [
      `Translate the English word "${word}" to ${targetLanguage} based on its meaning in this sentence.`,
      `Sentence: "${contextSentence.trim()}"`,
      'Return only the translated word or very short phrase (max 3 words), no explanation.'
    ].join('\n');
  }

  // Layer 3: AI on its own
  return `Translate "${word}" from English to ${targetLanguage}. Return only the translation, no explanation.`;
};

// AI cavabından artıq simvolları təmizlə (dırnaqlar, yeni sətirlər, son durğu işarələri)
const cleanTranslationOutput = (raw: string): string =>
  raw
    .trim()
    .replace(/^['"\s]+|['"\s]+$/g, '')
    .split(/\r?\n/)[0]
    .replace(/[.。!?]+$/g, '')
    .trim();

// AI mətndən nümunə cümlələri çıxar: sözü ehtiva edənləri üstün tut
const parseSentences = (text: string, word: string): string[] => {
  const matching = text
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.toLowerCase().includes(word.toLowerCase()))
    .slice(0, 3);

  if (matching.length > 0) return matching;

  // Fallback: nömrələnməni təmizlə, çox qısa sətirləri at
  return text
    .split('\n')
    .map(s => s.replace(/^\d+[\.\)\-]\s*/, '').trim())
    .filter(s => s.length > 5)
    .slice(0, 3);
};

export const aiContentService = {
  // Açar yoxlaması — mətn generasiya etmir, 1 tokenlik sorğu göndərir (#9)
  async validateKey(config: AIRequestConfig): Promise<AIServiceResponse> {
    return createAIService(config).validateKey();
  },

  async generateReadingText(
    config: AIRequestConfig,
    level: ProficiencyLevel,
    customPrompt?: string,
  ): Promise<AIServiceResponse> {
    const prompt = buildReadingPrompt(level, customPrompt);
    const levelConfig = LEVEL_GENERATION_CONFIG[level];

    return createAIService(config).generateText({
      level,
      prompt,
      maxTokens: levelConfig.maxTokens,
      temperature: 0.55,
    });
  },

  async translateWord(
    config: AIRequestConfig,
    params: { word: string; targetLanguage: string; contextSentence?: string },
  ): Promise<TranslateResponse> {
    const { word, targetLanguage, contextSentence } = params;

    const mongoSenses = await lookupSavedSenses(word);
    const dictDefinitions = mongoSenses.length === 0
      ? await lookupDictionaryDefinitions(word)
      : [];

    try {
      const prompt = buildTranslationPrompt(
        word, targetLanguage, contextSentence, mongoSenses, dictDefinitions,
      );

      const aiResponse = await createAIService(config).generateText({
        level: 'Elementary',
        prompt,
        maxTokens: 24,
        temperature: 0.1,
      });

      if (aiResponse.success && aiResponse.text) {
        const translation = cleanTranslationOutput(aiResponse.text);
        logger.info({ word, translation }, 'AI translation successful');
        return { success: true, translation };
      }

      logger.warn({ word, error: aiResponse.error }, 'AI translation failed');
      return {
        success: false,
        error: `Unable to translate "${word}". ${aiResponse.error}`,
      };
    } catch (aiError) {
      logger.error({ err: aiError, word }, 'AI translation error');
      return {
        success: false,
        error: `Translation error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
      };
    }
  },

  async getPronunciation(
    config: AIRequestConfig,
    word: string,
  ): Promise<PronunciationResponse> {
    try {
      const aiResponse = await createAIService(config).generateText({
        level: 'Elementary',
        prompt: `Give IPA for "${word}". Return only one value in /slashes/.`,
        maxTokens: 24,
        temperature: 0.1,
      });

      if (aiResponse.success && aiResponse.text) {
        const pronunciation = aiResponse.text.trim();
        logger.info({ word, pronunciation }, 'AI pronunciation successful');
        return { success: true, pronunciation };
      }

      logger.warn({ word, error: aiResponse.error }, 'AI pronunciation failed');
      return {
        success: false,
        error: `Unable to get pronunciation for "${word}". ${aiResponse.error}`,
      };
    } catch (aiError) {
      logger.error({ err: aiError, word }, 'AI pronunciation error');
      return {
        success: false,
        error: `Pronunciation error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
      };
    }
  },

  async generateExampleSentences(
    config: AIRequestConfig,
    word: string,
    level?: string,
  ): Promise<ExampleSentencesResponse> {
    try {
      const sentencePrompt = [
        `Write exactly 3 short natural sentences using "${word}".`,
        `Level: ${level || 'Intermediate'}.`,
        'Output rules: one sentence per line, no numbering, no explanation.'
      ].join('\n');

      const aiResponse = await createAIService(config).generateText({
        level: level || 'Intermediate',
        prompt: sentencePrompt,
        maxTokens: 110,
        temperature: 0.35,
      });

      if (aiResponse.success && aiResponse.text) {
        const sentences = parseSentences(aiResponse.text, word);
        logger.info({ word, count: sentences.length }, 'Example sentences generated');
        return { success: true, sentences };
      }

      logger.warn({ word, error: aiResponse.error }, 'Example sentences generation failed');
      return {
        success: false,
        error: `Unable to generate example sentences for "${word}". ${aiResponse.error}`,
      };
    } catch (aiError) {
      logger.error({ err: aiError, word }, 'Example sentences error');
      return {
        success: false,
        error: `Example sentences error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
      };
    }
  },
};
