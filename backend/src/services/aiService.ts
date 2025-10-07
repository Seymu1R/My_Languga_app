import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIServiceConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'cohere';
  apiKey: string;
  model?: string;
}

export interface TextGenerationParams {
  level: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIServiceResponse {
  success: boolean;
  text?: string;
  error?: string;
}

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
        case 'claude':
          return await this.generateWithClaude(params);
        case 'gemini':
          return await this.generateWithGemini(params);
        case 'cohere':
          return await this.generateWithCohere(params);
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
        // Rate limit errors
        else if (errorMessage.includes('rate limit') || 
                 errorMessage.includes('quota') ||
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
      const openai = new OpenAI({
        apiKey: this.config.apiKey,
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      
      const response = await openai.chat.completions.create({
        model: this.config.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.prompt }
        ],
        max_tokens: params.maxTokens || 500,
        temperature: 0.7,
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
      
      // Re-throw to be handled by main error handler
      throw error;
    }
  }

  private async generateWithClaude(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const anthropic = new Anthropic({
        apiKey: this.config.apiKey,
      });

      const systemPrompt = this.getSystemPrompt(params.level);
      
      const response = await anthropic.messages.create({
        model: this.config.model || 'claude-3-haiku-20240307',
        max_tokens: params.maxTokens || 500,
        system: systemPrompt,
        messages: [
          { role: 'user', content: params.prompt }
        ],
      });

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return { success: false, error: 'No text generated from Claude' };
      }

      return { success: true, text: textContent.text };
    } catch (error: any) {
      // Handle Claude-specific errors
      if (error?.status === 401) {
        return { 
          success: false, 
          error: 'Invalid Claude API key. Please check your API key at https://console.anthropic.com/' 
        };
      }
      
      // Re-throw to be handled by main error handler
      throw error;
    }
  }

  private async generateWithGemini(params: TextGenerationParams): Promise<AIServiceResponse> {
    try {
      const modelName = this.config.model || 'gemini-1.5-flash';
      console.log(`🔍 Gemini using model: ${modelName}`);
      
      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

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
          error: 'Invalid Gemini API key. Please get a valid API key from https://makersuite.google.com/app/apikey' 
        };
      }
      
      // Re-throw to be handled by main error handler
      throw error;
    }
  }

  private async generateWithCohere(params: TextGenerationParams): Promise<AIServiceResponse> {
    // Note: Cohere SDK would need to be installed and implemented
    // For now, return an error
    return {
      success: false,
      error: 'Cohere integration not yet implemented'
    };
  }

  private getSystemPrompt(level: string): string {
    const prompts = {
      'Elementary': 'You are an English teacher creating simple, engaging content for elementary level students. Use basic vocabulary and simple sentence structures.',
      'Pre-Intermediate': 'You are an English teacher creating content for pre-intermediate students. Use moderately complex vocabulary and varied sentence structures.',
      'Intermediate': 'You are an English teacher creating content for intermediate level students. Use a good variety of vocabulary and complex sentence structures.',
      'Upper-Intermediate': 'You are an English teacher creating advanced content for upper-intermediate students. Use sophisticated vocabulary and complex grammatical structures.',
      'Advanced': 'You are an English teacher creating challenging content for advanced students. Use complex vocabulary, idiomatic expressions, and sophisticated grammatical structures.'
    };

    return prompts[level as keyof typeof prompts] || prompts['Intermediate'];
  }
}