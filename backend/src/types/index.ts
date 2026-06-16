// ─── Shared domain types ──────────────────────────────────────────────────────

export type AIProvider = 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral';

export type ProficiencyLevel =
  | 'Elementary'
  | 'Pre-Intermediate'
  | 'Intermediate'
  | 'Upper-Intermediate'
  | 'Advanced';

// ─── AI route request bodies ──────────────────────────────────────────────────

export interface GenerateTextBody {
  level: ProficiencyLevel;
  apiToken: string;
  provider: AIProvider;
  model?: string;
  customPrompt?: string;
}

export interface TranslateWordBody {
  word: string;
  targetLanguage: string;
  languageCode: string;
  contextSentence?: string;
  aiToken?: string;
  provider?: AIProvider;
  model?: string;
}

export interface PronunciationBody {
  word: string;
  aiToken?: string;
  provider?: AIProvider;
  model?: string;
}

export interface ExampleSentencesBody {
  word: string;
  level?: string;
  aiToken?: string;
  provider?: AIProvider;
  model?: string;
}

// ─── AI route response shapes ─────────────────────────────────────────────────

export interface AITextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface TranslateResponse {
  success: boolean;
  translation?: string;
  error?: string;
}

export interface PronunciationResponse {
  success: boolean;
  pronunciation?: string;
  error?: string;
}

export interface ExampleSentencesResponse {
  success: boolean;
  sentences?: string[];
  error?: string;
}

// ─── Dictionary route request bodies ─────────────────────────────────────────

export interface AddWordBody {
  english: string;
  translation: string;
  pronunciation?: string;
  referenceSentence?: string;
  imageUrl?: string;
}

export interface LearningStatusBody {
  known: boolean;
}

// ─── Dictionary route response shape ─────────────────────────────────────────

export interface DictionaryResponse {
  success: boolean;
  words?: any[];
  word?: any;
  message?: string;
  error?: string;
  imageUrl?: string;
}
