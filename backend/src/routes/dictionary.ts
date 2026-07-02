import express, { Request, Response } from 'express';
import type { AddWordBody, LearningStatusBody, DictionaryResponse } from '../types';
import { validate } from '../middleware/validate';
import { upload } from '../middleware/upload';
import { addWordSchema, learningStatusSchema } from '../schemas';
import {
  dictionaryService,
  DuplicateWordError,
  WordNotFoundError,
} from '../services/dictionaryService';

export const dictionaryRouter = express.Router();

// Get all words in dictionary
dictionaryRouter.get('/words', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const words = await dictionaryService.getAllWords();
    return res.json({ success: true, words });
  } catch (error) {
    console.error('Get words error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve words',
    });
  }
});

// Get words for learnings queue (learning words + due known words)
dictionaryRouter.get('/words/learnings', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const words = await dictionaryService.getLearningWords();
    return res.json({ success: true, words });
  } catch (error) {
    console.error('Get learning words error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve learning words',
    });
  }
});

// Add a new word to dictionary
dictionaryRouter.post('/words', validate(addWordSchema), async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const word = await dictionaryService.addWord(req.body as AddWordBody);

    return res.status(201).json({
      success: true,
      word,
      message: 'Word added successfully',
    });
  } catch (error) {
    if (error instanceof DuplicateWordError) {
      return res.status(409).json({ success: false, error: error.message });
    }

    console.error('Add word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to add word',
    });
  }
});

// Update learning status based on flashcard result
dictionaryRouter.patch('/words/:id/learning-status', validate(learningStatusSchema), async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const { known }: LearningStatusBody = req.body;
    const word = await dictionaryService.updateLearningStatus(req.params.id, known);

    return res.json({
      success: true,
      word,
      message: known ? 'Word marked as known' : 'Word moved back to learning',
    });
  } catch (error) {
    if (error instanceof WordNotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }

    console.error('Update learning status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update learning status',
    });
  }
});

// Delete a word from dictionary
dictionaryRouter.delete('/words/:id', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    await dictionaryService.deleteWord(req.params.id);

    return res.json({
      success: true,
      message: 'Word deleted successfully',
    });
  } catch (error) {
    if (error instanceof WordNotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }

    console.error('Delete word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete word',
    });
  }
});

// Update a word in dictionary
dictionaryRouter.put('/words/:id', validate(addWordSchema), async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const word = await dictionaryService.updateWord(req.params.id, req.body as AddWordBody);

    return res.json({
      success: true,
      word,
      message: 'Word updated successfully',
    });
  } catch (error) {
    if (error instanceof WordNotFoundError) {
      return res.status(404).json({ success: false, error: error.message });
    }

    console.error('Update word error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update word',
    });
  }
});

// Upload image endpoint
dictionaryRouter.post('/upload-image', upload.single('image'), (req: Request, res: Response<DictionaryResponse>) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      imageUrl,
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    });
  }
});
