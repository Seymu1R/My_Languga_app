import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { aiService } from '../services/api';

interface WordDefinitionModalProps {
  isOpen: boolean;
  word: string;
  onClose: () => void;
  onSave: (english: string, translation: string) => void;
}

const WordDefinitionModal: React.FC<WordDefinitionModalProps> = ({
  isOpen,
  word,
  onClose,
  onSave,
}) => {
  const { state } = useApp();
  const [translation, setTranslation] = useState('');
  const [aiTranslation, setAiTranslation] = useState('');
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or word changes
  useEffect(() => {
    if (isOpen) {
      setTranslation('');
      setAiTranslation('');
      
      // Fetch AI translation when word changes and AI is ready
      if (word && state.isAiReady && state.aiToken && state.aiProvider) {
        fetchAITranslation();
      }
    }
  }, [isOpen, word]);

  const fetchAITranslation = async () => {
    if (!word || !state.aiToken || !state.aiProvider) return;
    
    setIsLoadingTranslation(true);
    try {
      const response = await aiService.translateWord(
        word,
        state.nativeLanguage,
        state.nativeLanguageCode,
        state.aiToken,
        state.aiProvider,
        state.aiModel || undefined
      );
      
      if (response.success && response.translation) {
        setAiTranslation(response.translation);
      } else {
        console.error('Translation failed:', response.error);
        setAiTranslation('Translation not available');
      }
    } catch (error) {
      console.error('Error fetching translation:', error);
      setAiTranslation('Translation error');
    } finally {
      setIsLoadingTranslation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use user translation if provided, otherwise use AI translation
    const finalTranslation = translation.trim() || aiTranslation;
    
    if (!finalTranslation) {
      alert('Please wait for AI translation or enter your own translation');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(word, finalTranslation);
      setTranslation('');
      setAiTranslation('');
    } catch (error) {
      console.error('Error saving word:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTranslation('');
    setAiTranslation('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">
            Add Word to Dictionary
          </h2>
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              English Word
            </label>
            <div className="input bg-gray-50 text-gray-800 font-medium">
              {word}
            </div>
          </div>

          {/* AI Translation - Disabled Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Suggested Translation ({state.nativeLanguage})
            </label>
            <div className="relative">
              <input
                type="text"
                value={isLoadingTranslation ? 'Loading translation...' : aiTranslation}
                disabled
                className="input bg-blue-50 text-blue-900 font-medium cursor-not-allowed"
                placeholder={state.isAiReady ? 'AI will suggest translation here...' : 'Add AI token to enable translation'}
              />
              {isLoadingTranslation && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-blue-600">
              ✨ AI optimal translation suggestion
            </p>
          </div>

          <div className="mb-6">
            <label htmlFor="translation" className="block text-sm font-medium text-gray-700 mb-2">
              Your Translation (optional if you want to edit AI suggestion)
            </label>
            <input
              id="translation"
              type="text"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              className="input"
              placeholder={aiTranslation ? `Default: ${aiTranslation}` : "Enter your own translation..."}
              autoFocus
            />
            <p className="mt-2 text-sm text-gray-500">
              You can use AI suggestion or add your own translation of "{word}".
            </p>
          </div>

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
              disabled={isSubmitting || (!translation.trim() && !aiTranslation)}
            >
              {isSubmitting ? 'Adding...' : 'Add to Dictionary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WordDefinitionModal;