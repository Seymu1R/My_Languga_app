import React, { useState } from 'react';
import { useApp, actions } from '../context/AppContext';
import { dictionaryService } from '../services/api';
import WordDefinitionModal from './WordDefinitionModal';

interface InteractiveTextProps {
  text: string;
}

const InteractiveText: React.FC<InteractiveTextProps> = ({ text }) => {
  const { dispatch } = useApp();
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to clean word of punctuation for dictionary lookup
  const cleanWord = (word: string): string => {
    return word.replace(/[.,!?;:"'()[\]{}\-]/g, '').toLowerCase();
  };

  const getSentenceForIndex = (charIndex: number): string => {
    const boundaryRegex = /[.!?\n]/;
    let start = charIndex;
    let end = charIndex;

    while (start > 0 && !boundaryRegex.test(text[start - 1])) {
      start -= 1;
    }

    while (end < text.length && !boundaryRegex.test(text[end])) {
      end += 1;
    }

    if (end < text.length) {
      end += 1;
    }

    return text.slice(start, end).trim();
  };

  // Function to handle word click
  const handleWordClick = (word: string, charIndex: number) => {
    const cleanedWord = cleanWord(word);
    if (cleanedWord.length > 0) {
      setSelectedWord(cleanedWord);
      setSelectedSentence(getSentenceForIndex(charIndex));
      setIsModalOpen(true);
    }
  };

  // Function to save word to dictionary
  const handleSaveWord = async (english: string, translation: string, pronunciation?: string, referenceSentence?: string, imageUrl?: string) => {
    try {
      dispatch(actions.setLoading(true));
      const newWord = await dictionaryService.addWord(english, translation, pronunciation, referenceSentence, imageUrl);
      dispatch(actions.addWord(newWord));
      setIsModalOpen(false);
      setSelectedWord(null);
    } catch (error) {
      console.error('Error saving word:', error);
      dispatch(actions.setError('Failed to save word to dictionary'));
    } finally {
      dispatch(actions.setLoading(false));
    }
  };

  // Function to split text into clickable words
  const renderInteractiveText = () => {
    // Split by spaces but preserve the spaces and punctuation
    const words = text.split(/(\s+)/);
    let currentOffset = 0;
    
    return words.map((segment, index) => {
      const segmentStart = currentOffset;
      currentOffset += segment.length;

      // If it's just whitespace, render as is
      if (/^\s+$/.test(segment)) {
        return <span key={index}>{segment}</span>;
      }

      // If it contains letters, make it clickable
      if (/[a-zA-Z]/.test(segment)) {
        return (
          <span
            key={index}
            className="text-clickable inline-block"
            onClick={() => handleWordClick(segment, segmentStart)}
            title={`Click to add "${cleanWord(segment)}" to your dictionary`}
          >
            {segment}
          </span>
        );
      }

      // For punctuation or other characters, render as is
      return <span key={index}>{segment}</span>;
    });
  };

  return (
    <>
      <div className="reading-panel select-none">
        <p className="text-sm sm:text-base text-slate-500 mb-4">
          Click any word for context-based translation and quick save.
        </p>
        <div className="reading-text">
          {renderInteractiveText()}
        </div>
      </div>

      <WordDefinitionModal
        isOpen={isModalOpen}
        word={selectedWord || ''}
        contextSentence={selectedSentence}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedWord(null);
          setSelectedSentence('');
        }}
        onSave={handleSaveWord}
      />
    </>
  );
};

export default InteractiveText;