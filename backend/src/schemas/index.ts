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

// Klik edilən söz — trim() uzunluq yoxlamasından əvvəl, əks halda "   " keçir (#28, #27 ilə eyni)
const wordSchema = z.string().trim().min(1, 'word is required').max(200);

// Söz üzərində işləyən AI endpoint-ləri istifadəçinin açarı olmadan işləyə bilməz —
// əvvəl optional idi və handler-lər ayrıca yoxlayırdı (#17)
const aiCredentials = {
  aiToken: z.string().min(1, 'aiToken is required'),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().optional(),
};

export const generateTextSchema = z.object({
  level: z.enum(PROFICIENCY_LEVELS),
  apiToken: z.string().min(1, 'apiToken is required'),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().optional(),
  customPrompt: z.string().max(2000, 'customPrompt must not exceed 2000 characters').optional(),
});

// Açar yoxlaması (#9): mətn generasiya olunmur, ona görə level/prompt lazım deyil
export const validateKeySchema = z.object({
  apiToken: z.string().min(1, 'apiToken is required'),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().optional(),
});

// languageCode heç yerdə işlənmirdi və artıq qəbul olunmur — göndərilsə atılır (#17)
export const translateWordSchema = z.object({
  word: wordSchema,
  targetLanguage: z.string().min(1, 'targetLanguage is required'),
  contextSentence: z.string().max(1000).optional(),
  ...aiCredentials,
});

export const pronunciationSchema = z.object({
  word: wordSchema,
  ...aiCredentials,
});

// level prompta birbaşa yazılır — sərbəst mətn əvəzinə yalnız məlum səviyyələr (#17)
export const exampleSentencesSchema = z.object({
  word: wordSchema,
  level: z.enum(PROFICIENCY_LEVELS).optional(),
  ...aiCredentials,
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
