import axios from 'axios';
import type { Word, ProficiencyLevel } from '../types';

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'http://localhost:7001';

const API_BASE_URL = `${API_ORIGIN}/api`;

export const resolveAssetUrl = (assetPath: string) => {
  if (assetPath.startsWith('http') || assetPath.startsWith('blob:')) {
    return assetPath;
  }

  return `${API_ORIGIN}${assetPath.startsWith('/') ? '' : '/'}${assetPath}`;
};

// Custom error class — bütün API xətaları bu formada gəlir
export class ApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 saniyə gözlə, sonra xəta ver
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — bütün xətaları mərkəzi yerdə idarə edir
api.interceptors.response.use(
  (response) => response, // Uğurlu cavab — olduğu kimi ötür
  (error) => {
    if (!error.response) {
      // Server işləmir və ya internet yoxdur
      throw new ApiError(
        `Cannot connect to server. Please check if the backend is running on ${API_ORIGIN}`,
      );
    }

    const { status, data } = error.response;
    const serverMessage = data?.error || data?.message;

    switch (status) {
      case 400:
        throw new ApiError(serverMessage || 'Invalid request. Please check your input.', 400);
      case 401:
        throw new ApiError(serverMessage || 'Unauthorized. Please check your API token.', 401);
      case 403:
        throw new ApiError(serverMessage || 'Access denied.', 403);
      case 404:
        throw new ApiError(serverMessage || 'Resource not found.', 404);
      case 413:
        throw new ApiError('File is too large. Maximum size is 5MB.', 413);
      case 422:
        throw new ApiError(serverMessage || 'Validation error. Please check your input.', 422);
      case 429:
        throw new ApiError('Too many requests. Please wait a moment and try again.', 429);
      case 500:
        throw new ApiError(serverMessage || 'Server error. Please try again later.', 500);
      default:
        throw new ApiError(serverMessage || `Unexpected error (${status}).`, status);
    }
  },
);

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  grok: 'grok-3-mini',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
  mistral: 'mistral-small-latest',
} as const;

// AI Service
export const aiService = {
  async generateText(
    level: ProficiencyLevel, 
    apiToken: string, 
    provider?: string, 
    model?: string,
    customPrompt?: string
  ) {
    const resolvedProvider = (provider || 'openai') as keyof typeof DEFAULT_MODELS;

    const response = await api.post('/ai/generate-text', { 
      level, 
      apiToken, 
      provider: resolvedProvider,
      model: model || DEFAULT_MODELS[resolvedProvider],
      customPrompt
    });
    return response.data;
  },

  async translateWord(
    word: string,
    targetLanguage: string,
    languageCode: string,
    aiToken?: string,
    provider?: string,
    model?: string,
    contextSentence?: string
  ) {
    const response = await api.post('/ai/translate-word', {
      word,
      targetLanguage,
      languageCode,
      aiToken,
      provider,
      model,
      contextSentence,
    });
    return response.data;
  },

  async getPronunciation(
    word: string,
    aiToken?: string,
    provider?: string,
    model?: string
  ) {
    const response = await api.post('/ai/pronunciation', {
      word,
      aiToken,
      provider,
      model
    });
    return response.data;
  },

  async generateExampleSentences(
    word: string,
    level?: string,
    aiToken?: string,
    provider?: string,
    model?: string
  ) {
    const response = await api.post('/ai/example-sentences', {
      word,
      level,
      aiToken,
      provider,
      model
    });
    return response.data;
  },
};

// Dictionary Service
export const dictionaryService = {
  async getWords(): Promise<Word[]> {
    const response = await api.get('/dictionary/words');
    return response.data.words;
  },

  async getLearningWords(): Promise<Word[]> {
    const response = await api.get('/dictionary/words/learnings');
    return response.data.words;
  },

  async addWord(english: string, translation: string, pronunciation?: string, referenceSentence?: string, imageUrl?: string): Promise<Word> {
    const response = await api.post('/dictionary/words', { english, translation, pronunciation, referenceSentence, imageUrl });
    return response.data.word;
  },

  async deleteWord(id: string): Promise<void> {
    await api.delete(`/dictionary/words/${id}`);
  },

  async updateWord(id: string, english: string, translation: string, pronunciation?: string, referenceSentence?: string, imageUrl?: string): Promise<Word> {
    const response = await api.put(`/dictionary/words/${id}`, { english, translation, pronunciation, referenceSentence, imageUrl });
    return response.data.word;
  },

  async updateLearningStatus(id: string, known: boolean): Promise<Word> {
    const response = await api.patch(`/dictionary/words/${id}/learning-status`, { known });
    return response.data.word;
  },

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    
    // Use the base api instance but override headers for multipart form data
    const response = await api.post('/dictionary/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.imageUrl;
  },
};

export default api;