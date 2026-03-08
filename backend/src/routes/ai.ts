import express, { Request, Response } from 'express';
import axios from 'axios';
import { AIService } from '../services/aiService';

export const aiRouter = express.Router();

// Types
interface TextGenerationRequest {
  level: 'Elementary' | 'Pre-Intermediate' | 'Intermediate' | 'Upper-Intermediate' | 'Advanced';
  apiToken: string;
  provider: 'openai' | 'claude' | 'gemini' | 'cohere';
  model?: string;
  customPrompt?: string;
}

interface AIResponse {
  success: boolean;
  text?: string;
  message?: string;
  error?: string;
}

// Validate AI token endpoint
aiRouter.post('/validate-token', async (req: Request, res: Response<AIResponse>) => {
  try {
    const { apiToken } = req.body;

    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: 'API token is required'
      });
    }

    // Here you would validate the token with your AI provider (OpenAI, etc.)
    // For now, we'll just return a success response with the welcome message
    return res.json({
      success: true,
      message: 'Hello! I am your personal English teacher. I am ready to help you learn. Please select your proficiency level to begin.'
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate token'
    });
  }
});


// ... (inside your aiRouter.ts file)

aiRouter.post('/generate-text', async (req: Request, res: Response<AIResponse>) => {
  try {
    const { level, apiToken, provider, model, customPrompt }: TextGenerationRequest = req.body;
    
    if (!level || !apiToken || !provider || !model) {
      return res.status(400).json({
        success: false,
        error: 'Level, API token, provider, and model are required'
      });
    }

    console.log(`🤖 Generating text with ${provider} (model: ${model}) for ${level} level`);

    // --- Prompt Generation Logic (Unchanged) ---
    let prompt: string;
    if (customPrompt) {
      prompt = customPrompt;
      console.log(`💬 Using custom greeting prompt`);
    } else {
      prompt = `Generate a high-quality, engaging reading comprehension text for ${level} level English learners.

Requirements:
- Text should be approximately ${level === 'Elementary' ? '150-200' : level === 'Pre-Intermediate' ? '200-250' : level === 'Intermediate' ? '250-300' : level === 'Upper-Intermediate' ? '300-400' : '400-500'} words.
- Use appropriate vocabulary and grammar complexity for the specified level.
- Ensure the text is engaging, educational, coherent, and flows naturally.

Level: ${level}
Please generate a completely new and unique text now:`;
    }

    // --- Provider-Specific Logic ---
    if (provider === 'gemini') {
      // ** START: Transformed Gemini Logic **
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiToken}`;

        // 2. Format the request body specifically for the Gemini API
        const requestBody = {
          contents: [{
            parts: [{ text: prompt }]
          }],
          // Optional: Add safety settings and generation config if needed
          // generationConfig: {
          //   maxOutputTokens: 8192,
          //   temperature: 0.7,
          // },
        };

        console.log();
        

        console.log(`📡 Sending request to Gemini API: ${geminiUrl}`);
        const response = await axios.post(geminiUrl, requestBody);

        // 3. Extract the text from the Gemini response structure
        const generatedText = response.data.candidates[0]?.content?.parts[0]?.text;

        if (generatedText) {
          console.log(`✅ Successfully generated AI text with Gemini`);
          return res.json({ success: true, text: generatedText });
        } else {
          throw new Error('No text found in Gemini API response.');
        }

      } catch (error: any) {
        // 4. Provide detailed error feedback from the API call
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error(`❌ Gemini API Error: ${errorMessage}`);
        return res.status(500).json({
          success: false,
          error: `AI text generation failed: ${errorMessage}. Please check your AI configuration and try again.`
        });
      }
      // ** END: Transformed Gemini Logic **
    } else {
      // --- Fallback to your existing AIService for other providers (OpenAI, Claude, etc.) ---
      try {
        // This part remains the same, using your abstraction for other services.
        const aiService = new AIService({ provider, apiKey: apiToken, model });

        const aiResponse = await aiService.generateText({
          level,
          prompt,
          maxTokens: customPrompt ? 200 : (level === 'Advanced' ? 700 : 500)
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
    }
  } catch (error) {
    console.error('Unhandled text generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred on the server.'
    });
  }
});

// Translate word endpoint
interface TranslateWordRequest {
  word: string;
  targetLanguage: string;
  languageCode: string;
  aiToken?: string;
  provider?: string;
  model?: string;
}

interface TranslateResponse {
  success: boolean;
  translation?: string;
  error?: string;
}

aiRouter.post('/translate-word', async (req: Request, res: Response<TranslateResponse>) => {
  try {
    console.log('📝 Translation request received:', req.body);
    const { word, targetLanguage, languageCode, aiToken, provider, model }: TranslateWordRequest = req.body;
    
    if (!word || !targetLanguage || !languageCode) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Word, target language, and language code are required'
      });
    }

    console.log(`🔤 Translating "${word}" to ${targetLanguage} (${languageCode})`);

    if (!aiToken || !provider) {
      console.log(`⚠️ No AI token or provider provided for translation`);
      return res.json({
        success: false,
        error: 'AI token and provider are required for translation'
      });
    }

    // AI translation
    try {
      const aiService = new AIService({
        provider: provider as 'openai' | 'claude' | 'gemini' | 'cohere',
        apiKey: aiToken,
        model: model
      });

      const translationPrompt = `Translate the English word "${word}" to ${targetLanguage}. 
Provide only the direct translation without any additional text, explanation, or formatting.
Just the single word translation in ${targetLanguage}.
Word to translate: ${word}
Target language: ${targetLanguage}`;

      const aiResponse = await aiService.generateText({
        level: 'Elementary',
        prompt: translationPrompt,
        maxTokens: 50
      });

      if (aiResponse.success && aiResponse.text) {
        const translation = aiResponse.text.trim();
        console.log(`✅ AI translation successful: "${word}" → "${translation}"`);
        
        return res.json({
          success: true,
          translation: translation
        });
      }

      console.log(`⚠️ AI translation failed: ${aiResponse.error}`);
      return res.json({
        success: false,
        error: `Unable to translate "${word}". ${aiResponse.error}`
      });
    } catch (aiError) {
      console.log(`❌ AI translation error: ${aiError}`);
      return res.json({
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

// Pronunciation endpoint
interface PronunciationRequest {
  word: string;
  aiToken?: string;
  provider?: string;
  model?: string;
}

interface PronunciationResponse {
  success: boolean;
  pronunciation?: string;
  error?: string;
}

aiRouter.post('/pronunciation', async (req: Request, res: Response<PronunciationResponse>) => {
  try {
    console.log('🔊 Pronunciation request received:', req.body);
    const { word, aiToken, provider, model }: PronunciationRequest = req.body;
    
    if (!word) {
      console.log('❌ Missing word');
      return res.status(400).json({
        success: false,
        error: 'Word is required'
      });
    }

    console.log(`🔊 Getting pronunciation for "${word}"`);

    if (!aiToken || !provider) {
      console.log(`⚠️ No AI token or provider provided for pronunciation`);
      return res.json({
        success: false,
        error: 'AI token and provider are required for pronunciation'
      });
    }

    // AI pronunciation
    try {
      const aiService = new AIService({
        provider: provider as 'openai' | 'claude' | 'gemini' | 'cohere',
        apiKey: aiToken,
        model: model
      });

      const pronunciationPrompt = `Provide the phonetic pronunciation (IPA - International Phonetic Alphabet) for the English word "${word}".
Provide ONLY the IPA pronunciation enclosed in forward slashes, nothing else.
Format: /pronunciation/
Example: for "cat" return /kæt/
Example: for "bought" return /bɔːt/
Word: ${word}`;

      const aiResponse = await aiService.generateText({
        level: 'Elementary',
        prompt: pronunciationPrompt,
        maxTokens: 50
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
      return res.json({
        success: false,
        error: `Unable to get pronunciation for "${word}". ${aiResponse.error}`
      });
    } catch (aiError) {
      console.log(`❌ AI pronunciation error: ${aiError}`);
      return res.json({
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