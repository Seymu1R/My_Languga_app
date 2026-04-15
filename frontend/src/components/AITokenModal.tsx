import React, { useEffect, useState } from 'react';
import { useApp, actions } from '../context/AppContext';
import { aiService, API_ORIGIN } from '../services/api';

interface AITokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AIProviderKey = 'openai' | 'grok' | 'gemini' | 'deepseek' | 'mistral';

const MASKED_CHAR_PATTERN = /[•●◦▪·]/;
const NON_ASCII_PATTERN = /[^\x20-\x7E]/;

const AIProviders = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o'],
    description: 'Current OpenAI GPT-4o models'
  },
  grok: {
    name: 'Grok',
    models: ['grok-3-mini', 'grok-3-fast'],
    description: 'Grok free-tier friendly models'
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    description: 'Google Gemini free-tier friendly models'
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'DeepSeek chat and reasoning models'
  },
  mistral: {
    name: 'Mistral AI',
    models: ['mistral-small-latest', 'open-mistral-nemo'],
    description: 'Mistral free-tier friendly models'
  }
};

const getPreferredModel = (provider: AIProviderKey, candidateModel?: string | null) => {
  const models = AIProviders[provider].models;
  return candidateModel && models.includes(candidateModel) ? candidateModel : models[0];
};

const normalizeTokenInput = (provider: AIProviderKey, token: string) => {
  const trimmedToken = token.trim();

  if (provider === 'openai' || provider === 'grok' || provider === 'gemini' || provider === 'deepseek' || provider === 'mistral') {
    return trimmedToken.replace(/\s+/g, '');
  }

  return trimmedToken;
};

const getTokenValidationError = (provider: AIProviderKey, token: string) => {
  if (!token) {
    return 'API token is required.';
  }

  if (provider === 'openai' || provider === 'grok' || provider === 'gemini' || provider === 'deepseek' || provider === 'mistral') {
    const providerName = provider === 'openai'
      ? 'OpenAI'
      : provider === 'grok'
        ? 'Grok'
        : provider === 'gemini'
          ? 'Gemini'
          : provider === 'deepseek'
            ? 'DeepSeek'
            : 'Mistral';

    if (MASKED_CHAR_PATTERN.test(token)) {
      return `${providerName} API key appears masked or corrupted. Paste the raw API key, not the bullet characters.`;
    }

    if (NON_ASCII_PATTERN.test(token)) {
      return `${providerName} API key contains hidden or unsupported characters. Paste the raw API key again.`;
    }
  }

  return null;
};

const getStoredTokenValue = (provider: AIProviderKey, token?: string | null) => {
  if (!token) {
    return '';
  }

  const normalizedToken = normalizeTokenInput(provider, token);
  return getTokenValidationError(provider, normalizedToken) ? '' : normalizedToken;
};

const AITokenModal: React.FC<AITokenModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useApp();
  console.log(state, "state");

  const initialProvider = state.aiProvider || 'openai';
  
  const [tokenInput, setTokenInput] = useState(getStoredTokenValue(initialProvider, state.aiToken));
  const [selectedProvider, setSelectedProvider] = useState<AIProviderKey>(initialProvider);
  const [selectedModel, setSelectedModel] = useState(getPreferredModel(initialProvider, state.aiModel));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedTokenValue = getStoredTokenValue(initialProvider, state.aiToken);

    if (state.aiToken && !storedTokenValue) {
      dispatch(actions.setAiToken(''));
      dispatch(actions.setAiReady(false));
    }
  }, [dispatch, initialProvider, state.aiToken]);

  useEffect(() => {
    setSelectedModel((currentModel) => getPreferredModel(selectedProvider, currentModel));
  }, [selectedProvider]);

  const handleProviderChange = (provider: AIProviderKey) => {
    setSelectedProvider(provider);
    setSelectedModel(getPreferredModel(provider));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedToken = normalizeTokenInput(selectedProvider, tokenInput);
    const tokenValidationError = getTokenValidationError(selectedProvider, normalizedToken);

    if (tokenValidationError) {
      setError(tokenValidationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log(`🔧 Using AI: ${selectedProvider} with model: ${selectedModel}`);

      // Send greeting to AI
      const greetingResponse = await aiService.generateText(
        'Elementary',
        normalizedToken,
        selectedProvider,
        selectedModel,
        'Salam! Mən sizin şagirdinizəm və ingilis dili öyrənmək istəyirəm. Özünüzü təqdim edə bilərsinizmi?'
      );

      if (greetingResponse.success) {
        dispatch(actions.setAiToken(normalizedToken));
        dispatch(actions.setAiProvider(selectedProvider));
        dispatch(actions.setAiModel(selectedModel));
        dispatch(actions.setAiReady(true));
        dispatch(actions.setError(null));

        if (greetingResponse.text) {
          console.log('AI Greeting Response:', greetingResponse.text);
        }

        onClose();
      } else {
        setError(greetingResponse.error || 'AI ilə əlaqə qurula bilmədi. API açarınızı yoxlayın.');
      }
    } catch (err: any) {
      console.error('Token validation error:', err);
      if (err.response) {
        // Server responded with error
        setError(err.response.data?.error || `Server error: ${err.response.status}`);
      } else if (err.request) {
        // Request was made but no response received
        setError(`Cannot connect to server. Please check if the backend server is running on ${API_ORIGIN}`);
      } else {
        // Something else happened
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setTokenInput(state.aiToken || '');
    setSelectedProvider(initialProvider);
    setSelectedModel(getPreferredModel(initialProvider, state.aiModel));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Add AI Token</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* AI Provider Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(AIProviders).map(([key, provider]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleProviderChange(key as AIProviderKey)}
                  className={`p-3 border rounded-lg text-left transition-all ${selectedProvider === key
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="font-medium text-sm">{provider.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{provider.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div className="mb-4">
            <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </label>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input"
            >
              {AIProviders[selectedProvider].models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {/* API Token */}
          <div className="mb-4">
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
              {AIProviders[selectedProvider].name} API Token
            </label>
            <input
              id="token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="input"
              placeholder={`Enter your ${AIProviders[selectedProvider].name} API token...`}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              Bu token {AIProviders[selectedProvider].name} ilə əlaqə qurmaq üçün istifadə olunacaq.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !tokenInput.trim()}
            >
              {isSubmitting ? 'Connecting to AI...' : 'Save & Test AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AITokenModal;