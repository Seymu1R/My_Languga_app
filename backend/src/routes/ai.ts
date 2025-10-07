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
        // 1. Correctly construct the v1 API URL
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiToken}`;

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