import { z } from 'zod';

const AI_PROVIDERS = ['openai', 'grok', 'gemini', 'deepseek', 'mistral'] as const;

export const PROFICIENCY_LEVELS = [
  'Elementary',
  'Pre-Intermediate',
  'Intermediate',
  'Upper-Intermediate',
  'Advanced',
] as const;

// ─── AI schemas ───────────────────────────────────────────────────────────────

export const generateTextSchema = z.object({
  level: z.enum(PROFICIENCY_LEVELS),
  apiToken: z.string().min(1, 'apiToken is required'),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().optional(),
  customPrompt: z.string().max(2000, 'customPrompt must not exceed 2000 characters').optional(),
});

export const translateWordSchema = z.object({
  word: z.string().min(1, 'word is required').max(200),
  targetLanguage: z.string().min(1, 'targetLanguage is required'),
  languageCode: z.string().min(2).max(10),
  contextSentence: z.string().max(1000).optional(),
  aiToken: z.string().optional(),
  provider: z.enum(AI_PROVIDERS).optional(),
  model: z.string().optional(),
});

export const pronunciationSchema = z.object({
  word: z.string().min(1, 'word is required').max(200),
  aiToken: z.string().optional(),
  provider: z.enum(AI_PROVIDERS).optional(),
  model: z.string().optional(),
});

export const exampleSentencesSchema = z.object({
  word: z.string().min(1, 'word is required').max(200),
  level: z.string().optional(),
  aiToken: z.string().optional(),
  provider: z.enum(AI_PROVIDERS).optional(),
  model: z.string().optional(),
});


// ─── Dictionary schemas ───────────────────────────────────────────────────────

export const addWordSchema = z.object({
  // trim() uzunluq yoxlamalarından əvvəl gəlməlidir — əks halda "   " min(1)-i keçib
  // boş sətrə çevrilir (#27)
  english: z.string().trim().min(1, 'english is required').max(300),
  translation: z.string().trim().min(1, 'translation is required').max(500),
  pronunciation: z.string().max(200).optional(),
  referenceSentence: z.string().max(1000).optional(),
  // Yalnız /upload-image endpoint-inin qaytardığı formata icazə ver.
  // Fayl adı nöqtə ilə başlaya bilməz → "/uploads/.." kimi dəyərlər rədd olunur
  imageUrl: z
    .string()
    .max(500)
    .regex(/^\/uploads\/\w[\w.-]*$/, 'imageUrl must be a path returned by /upload-image')
    .optional(),
});

export const learningStatusSchema = z.object({
  known: z.boolean({ error: 'known must be a boolean value' }),
});
