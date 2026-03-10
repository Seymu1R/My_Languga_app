import express, { Request, Response } from 'express';
import { Word } from '../models/Word';
import mongoose from 'mongoose';

export const dictionaryRouter = express.Router();

// In-memory fallback storage
let memoryDictionary: any[] = [];
let memoryId = 1;

// Helper to check if MongoDB is connected
const isMongoConnected = () => mongoose.connection.readyState === 1;

// Types
interface AddWordRequest {
  english: string;
  translation: string;
  pronunciation?: string;
  referenceSentence?: string;
}

interface DictionaryResponse {
  success: boolean;
  words?: any[];
  word?: any;
  message?: string;
  error?: string;
}

// Get all words in dictionary
dictionaryRouter.get('/words', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    if (isMongoConnected()) {
      const words = await Word.find().sort({ dateAdded: -1 });
      return res.json({
        success: true,
        words: words
      });
    } else {
      // Use in-memory storage
      return res.json({
        success: true,
        words: memoryDictionary.sort((a, b) => 
          new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        )
      });
    }
  } catch (error) {
    console.error('Get words error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve words'
    });
  }
});

// Add a new word to dictionary
dictionaryRouter.post('/words', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const { english, translation, pronunciation, referenceSentence }: AddWordRequest = req.body;
    
    if (!english || !translation) {
      return res.status(400).json({
        success: false,
        error: 'Both english word and translation are required'
      });
    }

    if (isMongoConnected()) {
      // Use MongoDB
      const existingWord = await Word.findOne({ 
        english: { $regex: new RegExp(`^${english}$`, 'i') }
      });

      if (existingWord) {
        return res.status(409).json({
          success: false,
          error: 'Word already exists in dictionary'
        });
      }

      const newWord = new Word({
        english: english.trim(),
        translation: translation.trim(),
        pronunciation: pronunciation?.trim(),
        referenceSentence: referenceSentence?.trim()
      });

      await newWord.save();

      return res.status(201).json({
        success: true,
        word: newWord.toJSON(),
        message: 'Word added successfully'
      });
    } else {
      // Use in-memory storage
      const existingWord = memoryDictionary.find(w => 
        w.english.toLowerCase() === english.toLowerCase()
      );

      if (existingWord) {
        return res.status(409).json({
          success: false,
          error: 'Word already exists in dictionary'
        });
      }

      const newWord = {
        id: (memoryId++).toString(),
        english: english.trim(),
        translation: translation.trim(),
        pronunciation: pronunciation?.trim(),
        referenceSentence: referenceSentence?.trim(),
        dateAdded: new Date().toISOString()
      };

      memoryDictionary.push(newWord);

      return res.status(201).json({
        success: true,
        word: newWord,
        message: 'Word added successfully (in-memory)'
      });
    }
  } catch (error) {
    console.error('Add word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add word'
    });
  }
});

// Delete a word from dictionary
dictionaryRouter.delete('/words/:id', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const { id } = req.params;
    
    if (isMongoConnected()) {
      const deletedWord = await Word.findByIdAndDelete(id);
      
      if (!deletedWord) {
        return res.status(404).json({
          success: false,
          error: 'Word not found'
        });
      }

      return res.json({
        success: true,
        message: 'Word deleted successfully'
      });
    } else {
      // Use in-memory storage
      const wordIndex = memoryDictionary.findIndex(w => w.id === id);
      
      if (wordIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Word not found'
        });
      }

      memoryDictionary.splice(wordIndex, 1);

      return res.json({
        success: true,
        message: 'Word deleted successfully (in-memory)'
      });
    }
  } catch (error) {
    console.error('Delete word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete word'
    });
  }
});

// Update a word in dictionary
dictionaryRouter.put('/words/:id', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const { id } = req.params;
    const { english, translation, pronunciation, referenceSentence }: AddWordRequest = req.body;
    
    if (!english || !translation) {
      return res.status(400).json({
        success: false,
        error: 'Both english word and translation are required'
      });
    }

    if (isMongoConnected()) {
      const updatedWord = await Word.findByIdAndUpdate(
        id,
        {
          english: english.trim(),
          translation: translation.trim(),
          pronunciation: pronunciation?.trim(),
          referenceSentence: referenceSentence?.trim()
        },
        { new: true }
      );
      
      if (!updatedWord) {
        return res.status(404).json({
          success: false,
          error: 'Word not found'
        });
      }

      return res.json({
        success: true,
        word: updatedWord.toJSON(),
        message: 'Word updated successfully'
      });
    } else {
      // Use in-memory storage
      const wordIndex = memoryDictionary.findIndex(w => w.id === id);
      
      if (wordIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Word not found'
        });
      }

      memoryDictionary[wordIndex] = {
        ...memoryDictionary[wordIndex],
        english: english.trim(),
        translation: translation.trim(),
        pronunciation: pronunciation?.trim(),
        referenceSentence: referenceSentence?.trim()
      };

      return res.json({
        success: true,
        word: memoryDictionary[wordIndex],
        message: 'Word updated successfully (in-memory)'
      });
    }
  } catch (error) {
    console.error('Update word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update word'
    });
  }
});