import React, { useState } from 'react';
import { useApp, actions } from '../context/AppContext';
import { aiService } from '../services/api';

interface AITokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIProviders = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
    description: 'ChatGPT & GPT-4 models'
  },
  claude: {
    name: 'Anthropic Claude',
    models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229'],
    description: 'Claude 3 models'
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-flash'],
    description: 'Google Gemini models'
  },
  cohere: {
    name: 'Cohere',
    models: ['command', 'command-light'],
    description: 'Cohere models'
  }
};

const AITokenModal: React.FC<AITokenModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch } = useApp();
  console.log(state, "state");
  
  const [tokenInput, setTokenInput] = useState(state.aiToken || '');
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'claude' | 'gemini' | 'cohere'>(state.aiProvider || 'openai');
  const [selectedModel, setSelectedModel] = useState(state.aiModel || AIProviders[state.aiProvider || 'openai'].models[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProviderChange = (provider: 'openai' | 'claude' | 'gemini' | 'cohere') => {
    setSelectedProvider(provider);
    setSelectedModel(AIProviders[provider].models[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Save AI configuration
      dispatch(actions.setAiToken(tokenInput.trim()));
      dispatch(actions.setAiProvider(selectedProvider));
      dispatch(actions.setAiModel(selectedModel));

      console.log(`🔧 Using AI: ${selectedProvider} with model: ${selectedModel}`);

      // Send greeting to AI
      const greetingResponse = await aiService.generateText(
        'Elementary',
        tokenInput.trim(),
        selectedProvider,
        selectedModel,
        'Salam! Mən sizin şagirdinizəm və ingilis dili öyrənmək istəyirəm. Özünüzü təqdim edə bilərsinizmi?'
      );

      if (greetingResponse.success) {
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
        setError('Cannot connect to server. Please check if the backend server is running on http://localhost:7000');
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
                  onClick={() => handleProviderChange(key as 'openai' | 'claude' | 'gemini' | 'cohere')}
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