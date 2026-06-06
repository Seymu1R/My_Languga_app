export interface Word {
  id: string;
  english: string;
  translation: string;
  pronunciation?: string;
  referenceSentence?: string;
  imageUrl?: string;
  dateAdded: string;
  status?: 'learning' | 'known';
  nextReviewDate?: string | null;
  reviewIntervalDays?: number;
}

export type ProficiencyLevel =
  | 'Elementary'
  | 'Pre-Intermediate'
  | 'Intermediate'
  | 'Upper-Intermediate'
  | 'Advanced';

export type AIProvider = 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral';

export interface AppState {
  aiToken: string | null;
  aiProvider: AIProvider | null;
  aiModel: string | null;
  isAiReady: boolean;
  nativeLanguage: string;
  nativeLanguageCode: string;
  selectedLevel: ProficiencyLevel | null;
  generatedText: string | null;
  dictionary: Word[];
  isLoading: boolean;
  error: string | null;
}
