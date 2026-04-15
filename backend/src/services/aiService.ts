import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIServiceConfig {
  provider: 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral';
  apiKey: string;
  model?: string;
}

export interface TextGenerationParams {
  level: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIServiceResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GROK_MODEL = 'grok-3-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_MISTRAL_MODEL = 'mistral-small-latest';
const OPENAI_MASKED_CHAR_PATTERN = /[•●◦▪·]/;
const NON_ASCII_PATTERN = /[^\x20-\x7E]/;

const OPENAI_MODEL_ALIASES: Record<string, string> = {
  'gpt-3.5-turbo': DEFAULT_OPENAI_MODEL,
  'gpt-4': DEFAULT_OPENAI_MODEL,
  'gpt-4-turbo': DEFAULT_OPENAI_MODEL,
};

const GROK_MODEL_ALIASES: Record<string, string> = {
  'grok-beta': DEFAULT_GROK_MODEL,
};

const GEMINI_MODEL_ALIASES: Record<string, string> = {
  'gemini-1.5-flash': DEFAULT_GEMINI_MODEL,
  'gemini-1.5-pro': DEFAULT_GEMINI_MODEL,
  'gemini-2.5-pro': DEFAULT_GEMINI_MODEL,
  'gemini-3.1-flash': DEFAULT_GEMINI_MODEL,
  'gemini-3.1-pro': DEFAULT_GEMINI_MODEL,
  'gemini-3.0-flash': DEFAULT_GEMINI_MODEL,
  'gemini-3.0-pro': DEFAULT_GEMINI_MODEL,
};

const DEEPSEEK_MODEL_ALIASES: Record<string, string> = {
  'deepseek-v3': DEFAULT_DEEPSEEK_MODEL,
};

const MISTRAL_MODEL_ALIASES: Record<string, string> = {
  'mistral-medium-latest': DEFAULT_MISTRAL_MODEL,
};

const resolveOpenAIModel = (model?: string) => {
  if (!model) {
    return DEFAULT_OPENAI_MODEL;
  }

  return OPENAI_MODEL_ALIASES[model] || model;
};

const resolveGrokModel = (model?: string) => {
  if (!model) {
    return DEFAULT_GROK_MODEL;
  }

  return GROK_MODEL_ALIASES[model] || model;
};

const resolveGeminiModel = (model?: string) => {
  if (!model) {
    return DEFAULT_GEMINI_MODEL;
  }

  return GEMINI_MODEL_ALIASES[model] || model;
};

const resolveDeepSeekModel = (model?: string) => {
  if (!model) {
    return DEFAULT_DEEPSEEK_MODEL;
  }

  return DEEPSEEK_MODEL_ALIASES[model] || model;
};

const resolveMistralModel = (model?: string) => {
  if (!model) {
    return DEFAULT_MISTRAL_MODEL;
  }

  return MISTRAL_MODEL_ALIASES[model] || model;
};

const normalizeOpenAIApiKey = (apiKey: string) => apiKey.trim().replace(/\s+/g, '');

const getOpenAIApiKeyValidationError = (apiKey: string) => {
  if (!apiKey) {
    return 'OpenAI API key is required.';
  }

  if (OPENAI_MASKED_CHAR_PATTERN.test(apiKey)) {
    return 'OpenAI API key appears masked or corrupted. Paste the raw API key from https://platform.openai.com/api-keys, not the bullet characters.';
  }

  if (NON_ASCII_PATTERN.test(apiKey)) {
    return 'OpenAI API key contains hidden or unsupported characters. Paste the raw API key again from https://platform.openai.com/api-keys.';
  }

  return null;
};

const normalizeGrokApiKey = (apiKey: string) => apiKey.trim().replace(/\s+/g, '');

const getGrokApiKeyValidationError = (apiKey: string) => {
  if (!apiKey) {
    return 'Grok API key is required.';
  }

  if (OPENAI_MASKED_CHAR_PATTERN.test(apiKey)) {
    return 'Grok API key appears masked or corrupted. Paste the raw API key from https://console.x.ai/, not the bullet characters.';
  }

  if (NON_ASCII_PATTERN.test(apiKey)) {
    return 'Grok API key contains hidden or unsupported characters. Paste the raw API key again from https://console.x.ai/.';
  }

  return null;
};

const normalizeGeminiApiKey = (apiKey: string) => apiKey.trim().replace(/\s+/g, '');

const getGeminiApiKeyValidationError = (apiKey: string) => {
  if (!apiKey) {
    return 'Gemini API key is required.';
  }

  if (OPENAI_MASKED_CHAR_PATTERN.test(apiKey)) {
    return 'Gemini API key appears masked or corrupted. Paste the raw API key from https://aistudio.google.com/apikey, not the bullet characters.';
  }

  if (NON_ASCII_PATTERN.test(apiKey)) {
    return 'Gemini API key contains hidden or unsupported characters. Paste the raw API key again from https://aistudio.google.com/apikey.';
  }

  return null;
};

const normalizeDeepSeekApiKey = (apiKey: string) => apiKey.trim().replace(/\s+/g, '');

const getDeepSeekApiKeyValidationError = (apiKey: string) => {
  if (!apiKey) {
    return 'DeepSeek API key is required.';
  }

  if (OPENAI_MASKED_CHAR_PATTERN.test(apiKey)) {
    return 'DeepSeek API key appears masked or corrupted. Paste the raw API key from https://platform.deepseek.com/api_keys, not the bullet characters.';
  }

  if (NON_ASCII_PATTERN.test(apiKey)) {
    return 'DeepSeek API key contains hidden or unsupported characters. Paste the raw API key again from https://platform.deepseek.com/api_keys.';
  }

  return null;
};

const normalizeMistralApiKey = (apiKey: string) => apiKey.trim().replace(/\s+/g, '');

const getMistralApiKeyValidationError = (apiKey: string) => {
  if (!apiKey) {
    return 'Mistral API key is required.';
  }

  if (OPENAI_MASKED_CHAR_PATTERN.test(apiKey)) {
    return 'Mistral API key appears masked or corrupted. Paste the raw API key from https://console.mistral.ai/api-keys, not the bullet characters.';
  }

  if (NON_ASCII_PATTERN.test(apiKey)) {
    return 'Mistral API key contains hidden or unsupported characters. Paste the raw API key again from https://console.mistral.ai/api-keys.';
  }

  return null;
};

export class AIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  async generateText(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      switch (this.config.provider) {
        case 'openai':
          return await this.generateWithOpenAI(params);
        case 'grok':
          return await this.generateWithGrok(params);
        case 'gemini':
          return await this.generateWithGemini(params);
        case 'deepseek':
          return await this.generateWithDeepSeek(params);
        case 'mistral':
          return await this.generateWithMistral(params);
        default:
          return {
            success: false,
            error: `Unsupported AI provider: ${this.config.provider}`
          };
      }
    } catch (error) {
      console.error(`AI generation error (${this.config.provider}):`, error);
      
      // Parse specific error types for user-friendly messages
      let userMessage = 'Unknown AI service error';
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // API Key related errors
        if (errorMessage.includes('api key not valid') || 
            errorMessage.includes('invalid api key') ||
            errorMessage.includes('api_key_invalid') ||
            errorMessage.includes('unauthorized')) {
          userMessage = `Invalid ${this.config.provider.toUpperCase()} API key. Please check your API key and try again.`;
        }
        // Quota/billing errors
        else if (errorMessage.includes('insufficient_quota') ||
                 errorMessage.includes('quota') ||
                 errorMessage.includes('billing') ||
                 errorMessage.includes('credit balance')) {
          userMessage = `${this.config.provider.toUpperCase()} quota or billing limit reached. This is usually an account credit or billing issue, not today's usage.`;
        }
        // Rate limit errors
        else if (errorMessage.includes('rate limit') || 
                 errorMessage.includes('too many requests')) {
          userMessage = `${this.config.provider.toUpperCase()} rate limit exceeded. Please try again in a few minutes.`;
        }
        // Network/connection errors
        else if (errorMessage.includes('network') || 
                 errorMessage.includes('connection') ||
                 errorMessage.includes('timeout')) {
          userMessage = `Network error connecting to ${this.config.provider.toUpperCase()}. Please check your internet connection.`;
        }
        // Generic API errors
        else if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
          userMessage = `Invalid request to ${this.config.provider.toUpperCase()}. Please check your API key configuration.`;
        }
        else if (errorMessage.includes('500') || errorMessage.includes('internal server error')) {
          userMessage = `${this.config.provider.toUpperCase()} service is temporarily unavailable. Please try again later.`;
        }
        else {
          userMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: userMessage
      };
    }
  }

  private async generateWithOpenAI(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const apiKey = normalizeOpenAIApiKey(this.config.apiKey);
      const apiKeyValidationError = getOpenAIApiKeyValidationError(apiKey);

      if (apiKeyValidationError) {
        return {
          success: false,
          error: apiKeyValidationError
        };
      }

      const openai = new OpenAI({
        apiKey,
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      const model = resolveOpenAIModel(this.config.model);
      
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxTokens || 500,
        temperature: params.temperature ?? 0.6,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        return { success: false, error: 'No text generated from OpenAI' };
      }

      return { success: true, text };
    } catch (error: any) {
      // Handle OpenAI-specific errors
      if (error?.status === 401) {
        return { 
          success: false, 
          error: 'Invalid OpenAI API key. Please check your API key at https://platform.openai.com/api-keys' 
        };
      }

      if (error?.status === 404) {
        return {
          success: false,
          error: `Selected OpenAI model is unavailable for this API key. Use ${DEFAULT_OPENAI_MODEL} or gpt-4o.`
        };
      }

      if (error?.status === 429) {
        const openAIErrorMessage = String(
          error?.error?.message || error?.message || ''
        ).toLowerCase();

        if (openAIErrorMessage.includes('insufficient_quota') ||
            openAIErrorMessage.includes('quota') ||
            openAIErrorMessage.includes('billing') ||
            openAIErrorMessage.includes('credit balance')) {
          return {
            success: false,
            error: 'OpenAI quota or billing limit reached. This usually means the API project has no active credits or billing, even if you did not use it today.'
          };
        }

        return {
          success: false,
          error: 'OpenAI rate limit exceeded. Too many requests were sent in a short time. Please try again in a few minutes.'
        };
      }
      
      // Re-throw to be handled by main error handler
      throw error;
    }
  }

  private async generateWithGrok(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const apiKey = normalizeGrokApiKey(this.config.apiKey);
      const apiKeyValidationError = getGrokApiKeyValidationError(apiKey);

      if (apiKeyValidationError) {
        return {
          success: false,
          error: apiKeyValidationError
        };
      }

      const grok = new OpenAI({
        apiKey,
        baseURL: 'https://api.x.ai/v1',
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      const model = resolveGrokModel(this.config.model);

      const response = await grok.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxTokens || 500,
        temperature: params.temperature ?? 0.6,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        return { success: false, error: 'No text generated from Grok' };
      }

      return { success: true, text };
    } catch (error: any) {
      if (error?.status === 401) {
        return { 
          success: false, 
          error: 'Invalid Grok API key. Please check your API key at https://console.x.ai/' 
        };
      }

      if (error?.status === 404) {
        return {
          success: false,
          error: `Selected Grok model is unavailable for this API key. Use ${DEFAULT_GROK_MODEL}.`
        };
      }

      if (error?.status === 429) {
        const grokErrorMessage = String(
          error?.error?.message || error?.message || ''
        ).toLowerCase();

        if (grokErrorMessage.includes('insufficient_quota') ||
            grokErrorMessage.includes('quota') ||
            grokErrorMessage.includes('billing') ||
            grokErrorMessage.includes('credit balance')) {
          return {
            success: false,
            error: 'Grok quota or billing limit reached. This usually means the API project has no active credits or billing, even if you did not use it today.'
          };
        }

        return {
          success: false,
          error: 'Grok rate limit exceeded. Too many requests were sent in a short time. Please try again in a few minutes.'
        };
      }
      
      throw error;
    }
  }

  private async generateWithGemini(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const apiKey = normalizeGeminiApiKey(this.config.apiKey);
      const apiKeyValidationError = getGeminiApiKeyValidationError(apiKey);

      if (apiKeyValidationError) {
        return {
          success: false,
          error: apiKeyValidationError
        };
      }

      const modelName = resolveGeminiModel(this.config.model);
      console.log(`🔍 Gemini using model: ${modelName}`);
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: params.temperature ?? 0.6,
          maxOutputTokens: params.maxTokens || 500,
        },
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      const fullPrompt = `${systemPrompt}\n\n${params.prompt}`;
      
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        return { success: false, error: 'No text generated from Gemini' };
      }

      return { success: true, text };
    } catch (error: any) {
      // Handle Gemini-specific errors
      if (error?.status === 400 && error?.message?.includes('API key not valid')) {
        return { 
          success: false, 
          error: 'Invalid Gemini API key. Please get a valid API key from https://aistudio.google.com/apikey' 
        };
      }

      if (error?.status === 404) {
        return {
          success: false,
          error: `Selected Gemini model is unavailable for this API key. Use ${DEFAULT_GEMINI_MODEL}.`
        };
      }

      if (error?.status === 429) {
        const geminiErrorMessage = String(
          error?.error?.message || error?.message || ''
        ).toLowerCase();

        if (geminiErrorMessage.includes('insufficient_quota') ||
            geminiErrorMessage.includes('quota') ||
            geminiErrorMessage.includes('billing') ||
            geminiErrorMessage.includes('credit balance')) {
          return {
            success: false,
            error: 'Gemini quota or billing limit reached. This usually means the API project has no active credits or billing, even if you did not use it today.'
          };
        }

        return {
          success: false,
          error: 'Gemini rate limit exceeded. Too many requests were sent in a short time. Please try again in a few minutes.'
        };
      }
      
      // Re-throw to be handled by main error handler
      throw error;
    }
  }

  private async generateWithDeepSeek(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const apiKey = normalizeDeepSeekApiKey(this.config.apiKey);
      const apiKeyValidationError = getDeepSeekApiKeyValidationError(apiKey);

      if (apiKeyValidationError) {
        return {
          success: false,
          error: apiKeyValidationError
        };
      }

      const deepSeek = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com/v1',
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      const model = resolveDeepSeekModel(this.config.model);

      const response = await deepSeek.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxTokens || 500,
        temperature: params.temperature ?? 0.6,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        return { success: false, error: 'No text generated from DeepSeek' };
      }

      return { success: true, text };
    } catch (error: any) {
      if (error?.status === 401) {
        return {
          success: false,
          error: 'Invalid DeepSeek API key. Please check your API key at https://platform.deepseek.com/api_keys'
        };
      }

      if (error?.status === 404) {
        return {
          success: false,
          error: `Selected DeepSeek model is unavailable for this API key. Use ${DEFAULT_DEEPSEEK_MODEL} or deepseek-reasoner.`
        };
      }

      if (error?.status === 429) {
        const deepSeekErrorMessage = String(
          error?.error?.message || error?.message || ''
        ).toLowerCase();

        if (deepSeekErrorMessage.includes('insufficient_quota') ||
            deepSeekErrorMessage.includes('quota') ||
            deepSeekErrorMessage.includes('billing') ||
            deepSeekErrorMessage.includes('credit balance')) {
          return {
            success: false,
            error: 'DeepSeek quota or billing limit reached. This usually means the API project has no active credits or billing, even if you did not use it today.'
          };
        }

        return {
          success: false,
          error: 'DeepSeek rate limit exceeded. Too many requests were sent in a short time. Please try again in a few minutes.'
        };
      }

      throw error;
    }
  }

  private async generateWithMistral(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const apiKey = normalizeMistralApiKey(this.config.apiKey);
      const apiKeyValidationError = getMistralApiKeyValidationError(apiKey);

      if (apiKeyValidationError) {
        return {
          success: false,
          error: apiKeyValidationError
        };
      }

      const mistral = new OpenAI({
        apiKey,
        baseURL: 'https://api.mistral.ai/v1',
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      const model = resolveMistralModel(this.config.model);

      const response = await mistral.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxTokens || 500,
        temperature: params.temperature ?? 0.6,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        return { success: false, error: 'No text generated from Mistral' };
      }

      return { success: true, text };
    } catch (error: any) {
      if (error?.status === 401) {
        return {
          success: false,
          error: 'Invalid Mistral API key. Please check your API key at https://console.mistral.ai/api-keys'
        };
      }

      if (error?.status === 404) {
        return {
          success: false,
          error: `Selected Mistral model is unavailable for this API key. Use ${DEFAULT_MISTRAL_MODEL}.`
        };
      }

      if (error?.status === 429) {
        const mistralErrorMessage = String(
          error?.error?.message || error?.message || ''
        ).toLowerCase();

        if (mistralErrorMessage.includes('insufficient_quota') ||
            mistralErrorMessage.includes('quota') ||
            mistralErrorMessage.includes('billing') ||
            mistralErrorMessage.includes('credit balance')) {
          return {
            success: false,
            error: 'Mistral quota or billing limit reached. This usually means the API project has no active credits or billing, even if you did not use it today.'
          };
        }

        return {
          success: false,
          error: 'Mistral rate limit exceeded. Too many requests were sent in a short time. Please try again in a few minutes.'
        };
      }

      throw error;
    }
  }

  private getSystemPrompt(level: string): string {
    const prompts = {
      'Elementary': 'You are an English teacher. Keep language simple for Elementary learners. Return only final text without extra notes.',
      'Pre-Intermediate': 'You are an English teacher. Keep language clear for Pre-Intermediate learners. Return only final text without extra notes.',
      'Intermediate': 'You are an English teacher. Use balanced vocabulary for Intermediate learners. Return only final text without extra notes.',
      'Upper-Intermediate': 'You are an English teacher. Use richer language for Upper-Intermediate learners. Return only final text without extra notes.',
      'Advanced': 'You are an English teacher. Use advanced natural language for Advanced learners. Return only final text without extra notes.'
    };

    return prompts[level as keyof typeof prompts] || prompts['Intermediate'];
  }
}