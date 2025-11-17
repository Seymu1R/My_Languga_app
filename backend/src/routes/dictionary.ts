import express, { Request, Response } from 'express';
import { Word } from '../models/Word';

export const dictionaryRouter = express.Router();

// Types
interface AddWordRequest {
  english: string;
  translation: string;
  pronunciation?: string;
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
    const words = await Word.find().sort({ dateAdded: -1 });
    return res.json({
      success: true,
      words: words
    });
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
    const { english, translation, pronunciation }: AddWordRequest = req.body;
    
    if (!english || !translation) {
      return res.status(400).json({
        success: false,
        error: 'Both english word and translation are required'
      });
    }

    // Check if word already exists
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
      pronunciation: pronunciation?.trim()
    });

    await newWord.save();

    return res.status(201).json({
      success: true,
      word: newWord.toJSON(),
      message: 'Word added successfully'
    });
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
    const { english, translation, pronunciation }: AddWordRequest = req.body;
    
    if (!english || !translation) {
      return res.status(400).json({
        success: false,
        error: 'Both english word and translation are required'
      });
    }

    const updatedWord = await Word.findByIdAndUpdate(
      id,
      {
        english: english.trim(),
        translation: translation.trim(),
        pronunciation: pronunciation?.trim()
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
  } catch (error) {
    console.error('Update word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update word'
    });
  }
});