import express, { Request, Response } from 'express';
import { AIService } from '../services/aiService';

export const aiRouter = express.Router();

// Types
interface TextGenerationRequest {
  level: 'Elementary' | 'Pre-Intermediate' | 'Intermediate' | 'Upper-Intermediate' | 'Advanced';
  apiToken: string;
  provider: 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral';
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

    // Use the unified AI service logic for all providers (OpenAI, Grok, Gemini, DeepSeek, Mistral).
    try {
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
        provider: provider as 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral',
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
        provider: provider as 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral',
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

// Example sentences endpoint
interface ExampleSentencesRequest {
  word: string;
  level?: string;
  aiToken?: string;
  provider?: string;
  model?: string;
}

interface ExampleSentencesResponse {
  success: boolean;
  sentences?: string[];
  error?: string;
}

aiRouter.post('/example-sentences', async (req: Request, res: Response<ExampleSentencesResponse>) => {
  try {
    console.log('📝 Example sentences request received:', req.body);
    const { word, level, aiToken, provider, model }: ExampleSentencesRequest = req.body;

    if (!word) {
      return res.status(400).json({
        success: false,
        error: 'Word is required'
      });
    }

    if (!aiToken || !provider) {
      return res.json({
        success: false,
        error: 'AI token and provider are required for generating example sentences'
      });
    }

    console.log(`📖 Generating example sentences for "${word}" at ${level || 'Intermediate'} level`);

    try {
      const aiService = new AIService({
        provider: provider as 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral',
        apiKey: aiToken,
        model: model
      });

      const sentencePrompt = `Generate exactly 3 short, natural example sentences using the English word "${word}".
The sentences should be appropriate for ${level || 'Intermediate'} level English learners.
Each sentence should be on a new line.
Do NOT number the sentences.
Do NOT add any extra text, explanation, or formatting.
Just 3 plain sentences, one per line.
Word: ${word}`;

      const aiResponse = await aiService.generateText({
        level: level || 'Intermediate',
        prompt: sentencePrompt,
        maxTokens: 200
      });

      if (aiResponse.success && aiResponse.text) {
        const sentences = aiResponse.text
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0 && s.toLowerCase().includes(word.toLowerCase()))
          .slice(0, 3);

        if (sentences.length === 0) {
          // Fallback: split by any line and take non-empty ones
          const fallbackSentences = aiResponse.text
            .split('\n')
            .map(s => s.replace(/^\d+[\.\)\-]\s*/, '').trim())
            .filter(s => s.length > 5)
            .slice(0, 3);

          console.log(`✅ Example sentences generated (fallback): ${fallbackSentences.length}`);
          return res.json({
            success: true,
            sentences: fallbackSentences
          });
        }

        console.log(`✅ Example sentences generated: ${sentences.length}`);
        return res.json({
          success: true,
          sentences
        });
      }

      console.log(`⚠️ Example sentences generation failed: ${aiResponse.error}`);
      return res.json({
        success: false,
        error: `Unable to generate example sentences for "${word}". ${aiResponse.error}`
      });
    } catch (aiError) {
      console.log(`❌ Example sentences error: ${aiError}`);
      return res.json({
        success: false,
        error: `Example sentences error: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error('Example sentences error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate example sentences'
    });
  }
});