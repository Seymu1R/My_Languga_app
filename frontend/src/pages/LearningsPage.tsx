import React, { useState, useEffect } from 'react';
import { Word } from '../context/AppContext';
import { dictionaryService } from '../services/api';
import Flashcard from '../components/Flashcard';
import { Link } from 'react-router-dom';

const LearningsPage: React.FC = () => {
  const [queue, setQueue] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [learnedCount, setLearnedCount] = useState(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const loadLearningWords = async () => {
      setIsLoading(true);
      try {
        const words = await dictionaryService.getLearningWords();
        initQueue(words);
      } catch (error) {
        console.error('Failed to load learning words:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadLearningWords();
  }, []);

  const initQueue = (words: Word[]) => {
    // Shuffle the loaded words array
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrentIndex(0);
    setLearnedCount(0);
  };

  const currentWord = queue[currentIndex];

  const handleSwipeResult = async (known: boolean) => {
    if (!currentWord || isUpdatingStatus) {
      return;
    }

    setIsUpdatingStatus(true);

    try {
      await dictionaryService.updateLearningStatus(currentWord.id, known);
    } catch (error) {
      console.error('Failed to update learning status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }

    if (known) {
      // Swiped Right -> User knows it
      setLearnedCount(prev => prev + 1);
      
      // Move to next card
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 300); // Small delay to let card finish animating out
    } else {
      // Swiped Left -> Doesn't know it, push to end of queue to repeat
      setTimeout(() => {
        setQueue(prevQueue => {
          const newQ = [...prevQueue];
          newQ.push(currentWord); // Add it to end to see again
          return newQ;
        });
        setCurrentIndex(prev => prev + 1);
      }, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If no words in dictionary at all
  if (queue.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-24 h-24 bg-primary-50 rounded-full flex flex-col items-center justify-center mx-auto mb-6">
          <span className="text-5xl">🃏</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">No Words Yet</h2>
        <p className="text-gray-600 max-w-md mx-auto mb-8">
          You need to add words to your dictionary before you can start learning them with flashcards.
        </p>
        <Link to="/" className="btn-primary">
          Start Reading
        </Link>
      </div>
    );
  }

  // If successfully finished the full queue
  if (currentIndex >= queue.length) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">🎉</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-3">Amazing Job!</h2>
        <p className="text-gray-600 max-w-md mx-auto mb-8">
          You reviewed {learnedCount} words successfully. Keep up the great work!
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={() => initQueue(queue)} className="btn-primary">
            Review Again
          </button>
          <Link to="/dictionary" className="btn-secondary">
            Go to Dictionary
          </Link>
        </div>
      </div>
    );
  }

  // Flashcards Active View
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col h-full min-h-[80vh]">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Learnings</h1>
        <p className="text-gray-600 mt-2">Test your memory with flashcards</p>
      </div>

      {/* Progress */}
      <div className="max-w-md mx-auto w-full mb-10">
        <div className="flex justify-between text-sm text-gray-500 font-medium mb-2 px-1">
          <span>Card {currentIndex + 1} of {queue.length}</span>
          <span className="text-green-600 font-bold">{learnedCount} Known</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-primary-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${(currentIndex / queue.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Flashcard Area */}
      <div className="flex-1 flex justify-center mt-2 perspective-1000 relative">
        {/* Render stacked cards effect - show next card behind */}
        {currentIndex + 1 < queue.length && (
          <div className="absolute inset-0 max-w-sm mx-auto w-full h-96 bg-white border border-gray-200 rounded-2xl shadow-sm transform scale-[0.95] translate-y-4 opacity-50 z-0"></div>
        )}
        {currentIndex + 2 < queue.length && (
          <div className="absolute inset-0 max-w-sm mx-auto w-full h-96 bg-white border border-gray-200 rounded-2xl shadow-sm transform scale-[0.90] translate-y-8 opacity-25 z-0"></div>
        )}
        
        {/* Actual Draggable Card */}
        {currentWord && (
          <div className="z-10 w-full relative">
            {/* Key forces remount when index changes, so drag resets */}
            <Flashcard 
              key={`${currentWord.id}-${currentIndex}`} 
              word={currentWord} 
              onSwipeResult={handleSwipeResult} 
            />
          </div>
        )}
      </div>

      {/* Instructions footer */}
      <div className="text-center mt-12 grid grid-cols-2 gap-4 max-w-sm mx-auto w-full">
        <button 
          onClick={() => handleSwipeResult(false)}
          disabled={isUpdatingStatus}
          className="flex items-center justify-center space-x-2 text-red-500 border border-red-200 bg-red-50 rounded-xl p-3 hover:bg-red-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          <span className="font-semibold text-sm">Don't Know</span>
        </button>
        <button 
          onClick={() => handleSwipeResult(true)}
          disabled={isUpdatingStatus}
          className="flex items-center justify-center space-x-2 text-green-500 border border-green-200 bg-green-50 rounded-xl p-3 hover:bg-green-100 transition-colors"
        >
          <span className="font-semibold text-sm">Know</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>
    </div>
  );
};

export default LearningsPage;
