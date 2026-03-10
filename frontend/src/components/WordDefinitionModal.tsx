import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { aiService } from '../services/api';

interface WordDefinitionModalProps {
  isOpen: boolean;
  word: string;
  onClose: () => void;
  onSave: (english: string, translation: string, pronunciation?: string, referenceSentence?: string) => void;
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
  const [pronunciation, setPronunciation] = useState('');
  const [aiPronunciation, setAiPronunciation] = useState('');
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [isLoadingPronunciation, setIsLoadingPronunciation] = useState(false);
  const [isLoadingSentences, setIsLoadingSentences] = useState(false);
  const [exampleSentences, setExampleSentences] = useState<string[]>([]);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes or word changes
  useEffect(() => {
    if (isOpen) {
      setTranslation('');
      setAiTranslation('');
      setPronunciation('');
      setAiPronunciation('');
      setExampleSentences([]);
      setSelectedSentenceIndex(null);
      
      // Fetch AI translation, pronunciation, and example sentences when word changes and AI is ready
      if (word && state.isAiReady && state.aiToken && state.aiProvider) {
        fetchAITranslation();
        fetchAIPronunciation();
        fetchExampleSentences();
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

  const fetchAIPronunciation = async () => {
    if (!word || !state.aiToken || !state.aiProvider) return;
    
    setIsLoadingPronunciation(true);
    try {
      const response = await aiService.getPronunciation(
        word,
        state.aiToken,
        state.aiProvider,
        state.aiModel || undefined
      );
      
      if (response.success && response.pronunciation) {
        setAiPronunciation(response.pronunciation);
      } else {
        console.error('Pronunciation failed:', response.error);
        setAiPronunciation('');
      }
    } catch (error) {
      console.error('Error fetching pronunciation:', error);
      setAiPronunciation('');
    } finally {
      setIsLoadingPronunciation(false);
    }
  };

  const fetchExampleSentences = async () => {
    if (!word || !state.aiToken || !state.aiProvider) return;
    
    setIsLoadingSentences(true);
    try {
      const response = await aiService.generateExampleSentences(
        word,
        state.selectedLevel || 'Intermediate',
        state.aiToken,
        state.aiProvider,
        state.aiModel || undefined
      );
      
      if (response.success && response.sentences && response.sentences.length > 0) {
        setExampleSentences(response.sentences);
        setSelectedSentenceIndex(0); // Auto-select the first sentence
      } else {
        console.error('Example sentences failed:', response.error);
        setExampleSentences([]);
      }
    } catch (error) {
      console.error('Error fetching example sentences:', error);
      setExampleSentences([]);
    } finally {
      setIsLoadingSentences(false);
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

    // Use user pronunciation if provided, otherwise use AI pronunciation (optional)
    const finalPronunciation = pronunciation.trim() || aiPronunciation.trim() || undefined;

    // Get selected reference sentence
    const finalReferenceSentence = selectedSentenceIndex !== null && exampleSentences[selectedSentenceIndex]
      ? exampleSentences[selectedSentenceIndex]
      : undefined;

    setIsSubmitting(true);
    try {
      await onSave(word, finalTranslation, finalPronunciation, finalReferenceSentence);
      setTranslation('');
      setAiTranslation('');
      setPronunciation('');
      setAiPronunciation('');
      setExampleSentences([]);
      setSelectedSentenceIndex(null);
    } catch (error) {
      console.error('Error saving word:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTranslation('');
    setAiTranslation('');
    setPronunciation('');
    setAiPronunciation('');
    setExampleSentences([]);
    setSelectedSentenceIndex(null);
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

          {/* AI Pronunciation - Optional Editable Input */}
          <div className="mb-4">
            <label htmlFor="pronunciation" className="block text-sm font-medium text-gray-700 mb-2">
              Pronunciation (IPA) - Optional
            </label>
            <div className="relative">
              <input
                id="pronunciation"
                type="text"
                value={pronunciation || aiPronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
                className="input bg-purple-50 text-purple-900 focus:ring-purple-500 focus:border-purple-500"
                placeholder={state.isAiReady ? (isLoadingPronunciation ? 'Loading pronunciation...' : 'AI will suggest pronunciation...') : 'Add AI token to enable'}
              />
              {isLoadingPronunciation && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-purple-600">
              🔊 AI suggested pronunciation (e.g., /bɔːt/ for "bought"). Edit if needed.
            </p>
          </div>

          {/* Example Sentences - Radio Buttons */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📖 Reference Sentence
            </label>
            {isLoadingSentences ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-emerald-700">Generating example sentences...</span>
                </div>
              </div>
            ) : exampleSentences.length > 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <p className="text-xs text-emerald-600 mb-2">
                  ✨ Select a reference sentence to save with this word:
                </p>
                {exampleSentences.map((sentence, index) => (
                  <label
                    key={index}
                    className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedSentenceIndex === index
                        ? 'bg-emerald-100 border-2 border-emerald-400'
                        : 'bg-white border-2 border-transparent hover:bg-emerald-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="referenceSentence"
                      value={index}
                      checked={selectedSentenceIndex === index}
                      onChange={() => setSelectedSentenceIndex(index)}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-800 leading-relaxed">{sentence}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-500">
                  {state.isAiReady ? 'No example sentences available' : 'Add AI token to generate example sentences'}
                </p>
              </div>
            )}
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