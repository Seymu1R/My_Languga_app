import axios from 'axios';
import { Word, ProficiencyLevel } from '../context/AppContext';

const API_BASE_URL = 'http://localhost:7000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// AI Service
export const aiService = {
  async validateToken(apiToken: string) {
    const response = await api.post('/ai/validate-token', { apiToken });
    return response.data;
  },

  async generateText(
    level: ProficiencyLevel, 
    apiToken: string, 
    provider?: string, 
    model?: string,
    customPrompt?: string
  ) {
    const response = await api.post('/ai/generate-text', { 
      level, 
      apiToken, 
      provider: provider || 'openai',
      model: model || 'gpt-3.5-turbo',
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
    model?: string
  ) {
    const response = await api.post('/ai/translate-word', {
      word,
      targetLanguage,
      languageCode,
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

  async addWord(english: string, translation: string): Promise<Word> {
    const response = await api.post('/dictionary/words', { english, translation });
    return response.data.word;
  },

  async deleteWord(id: string): Promise<void> {
    await api.delete(`/dictionary/words/${id}`);
  },

  async updateWord(id: string, english: string, translation: string): Promise<Word> {
    const response = await api.put(`/dictionary/words/${id}`, { english, translation });
    return response.data.word;
  },
};

export default api;