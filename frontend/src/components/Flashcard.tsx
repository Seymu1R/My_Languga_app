import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Word } from '../context/AppContext';
import { resolveAssetUrl } from '../services/api';

interface FlashcardProps {
  word: Word;
  onSwipeResult: (known: boolean) => void;
}

const Flashcard: React.FC<FlashcardProps> = ({ word, onSwipeResult }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Motion values for swiping
  const x = useMotionValue(0);
  
  // Rotate card as it moves left/right
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  
  // Opacity for left color (red-ish) and right color (green-ish) indicators
  const opacityLeft = useTransform(x, [-100, -20], [1, 0]);
  const opacityRight = useTransform(x, [20, 100], [0, 1]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // If dragged right past 100px -> Known
    if (info.offset.x > 100) {
      onSwipeResult(true);
    }
    // If dragged left past 100px -> Unknown (Learn again)
    else if (info.offset.x < -100) {
      onSwipeResult(false);
    }
    // Else it bounces back to center (handled automatically by framer-motion drag constraints)
  };

  const handleFlip = () => {
    // Prevent flip if clicking to drag
    // Simple way is just toggling state
    setIsFlipped(!isFlipped);
  };

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation(); // don't flip card    
    if (word.pronunciation) {
      // In a real app we'd use SpeechSynthesis or audio file, here just alerting or ignoring
      // Let's use SpeechSynthesis as a simple built-in option
      const utterance = new SpeechSynthesisUtterance(word.english);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      const utterance = new SpeechSynthesisUtterance(word.english);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="w-full max-w-sm h-96 relative perspective-1000 mx-auto select-none">
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        onClick={handleFlip}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, rotateY: isFlipped ? 180 : 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 20,
          rotateY: { duration: 0.4 } 
        }}
        className="w-full h-full rounded-2xl shadow-xl cursor-grab active:cursor-grabbing border bg-white border-gray-200 transform-style-preserve-3d absolute inset-0 flex items-center justify-center p-6"
      >
        {/* Swipe Indicators */}
        <motion.div
          style={{ opacity: opacityRight }}
          className="absolute inset-0 z-50 rounded-2xl border-4 border-green-500 bg-green-50/20 pointer-events-none flex items-center justify-center"
        >
          <span className="text-5xl font-bold text-green-600 border-4 border-green-600 rounded-full w-24 h-24 flex items-center justify-center bg-white/50 backdrop-blur-sm transform rotate-12 -translate-y-20">✓</span>
        </motion.div>
        
        <motion.div
          style={{ opacity: opacityLeft }}
          className="absolute inset-0 z-50 rounded-2xl border-4 border-red-500 bg-red-50/20 pointer-events-none flex items-center justify-center"
        >
          <span className="text-5xl font-bold text-red-600 border-4 border-red-600 rounded-lg w-24 h-24 flex items-center justify-center bg-white/50 backdrop-blur-sm transform -rotate-12 -translate-y-20">X</span>
        </motion.div>

        {/* Front of Card */}
        <div 
          className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-6 text-center bg-white rounded-2xl"
          style={{ 
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            visibility: isFlipped ? 'hidden' : 'visible'
          }}
        >
          {word.imageUrl && (
            <div className="mb-6 w-32 h-32 rounded-full overflow-hidden border-4 border-primary-100 shadow-md">
              <img 
                src={resolveAssetUrl(word.imageUrl)} 
                alt={word.english} 
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          )}
          
          <h2 className="text-4xl font-bold text-gray-800 mb-2">
            {word.english}
          </h2>
          
          <button 
            type="button"
            onClick={playAudio} 
            className="mt-4 p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <p className="absolute bottom-4 text-xs text-gray-400">
            Tap to flip • Swipe Right if Known • Swipe Left if Unknown
          </p>
        </div>

        {/* Back of Card */}
        <div 
          className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-6 text-center transform rotate-y-180 bg-primary-50 rounded-2xl"
          style={{ 
            visibility: isFlipped ? 'visible' : 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="space-y-6 w-full">
            <div>
              <p className="text-sm text-primary-600 font-semibold uppercase tracking-wider mb-1">Translation</p>
              <h3 className="text-3xl font-bold text-gray-900">{word.translation}</h3>
            </div>
            
            {word.pronunciation && (
              <div>
                <p className="text-sm text-primary-600 font-semibold uppercase tracking-wider mb-1">Pronunciation</p>
                <p className="text-lg text-gray-700 font-mono bg-white inline-block px-3 py-1 rounded shadow-sm">
                  {word.pronunciation}
                </p>
              </div>
            )}
            
            {word.referenceSentence && (
              <div>
                <p className="text-sm text-primary-600 font-semibold uppercase tracking-wider mb-2">Example</p>
                <p className="text-md text-gray-700 italic bg-white p-4 rounded-lg shadow-sm border border-primary-100">
                  "{word.referenceSentence}"
                </p>
              </div>
            )}
          </div>
          
          <p className="absolute bottom-4 text-xs text-primary-400">
            Tap to flip back
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Flashcard;
