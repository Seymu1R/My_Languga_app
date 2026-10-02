import express, { Request, Response } from 'express';
import type { AddWordBody, LearningStatusBody, DictionaryResponse } from '../types';
import { validate } from '../middleware/validate';
import { uploadImage } from '../middleware/upload';
import { addWordSchema, learningStatusSchema } from '../schemas';
import { logger } from '../utils/logger';
import {
  dictionaryService,
  DuplicateWordError,
  WordNotFoundError,
} from '../services/dictionaryService';

export const dictionaryRouter = express.Router();

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 20;

// ?page= və ya ?limit= verilməyibsə undefined qaytarır → köhnə davranış (bütün sözlər)
const parsePagination = (query: Request['query']) => {
  if (query.page === undefined && query.limit === undefined) return undefined;

  const page = Math.max(1, parseInt(String(query.page), 10) || 1);
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(String(query.limit), 10) || DEFAULT_PAGE_LIMIT),
  );

  return { page, limit };
};

// Get all words in dictionary (optionally paginated: /words?page=1&limit=20)
dictionaryRouter.get('/words', async (req: Request, res: Response<DictionaryResponse>) => {
  try {
    const pagination = parsePagination(req.query);
    const { words, total } = await dictionaryService.getAllWords(pagination);

    if (!pagination) {
      return res.json({ success: true, words });
    }

    return res.json({
      success: true,
      words,
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get words error');
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
    logger.error({ err: error }, 'Get learning words error');
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

    logger.error({ err: error }, 'Add word error');
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

    logger.error({ err: error }, 'Update learning status error');
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

    logger.error({ err: error }, 'Delete word error');
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

    logger.error({ err: error }, 'Update word error');
    return res.status(500).json({
      success: false,
      error: 'Failed to update word',
    });
  }
});

// Upload image endpoint
dictionaryRouter.post('/upload-image', uploadImage, (req: Request, res: Response<DictionaryResponse>) => {
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
    logger.error({ err: error }, 'Image upload error');
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload image',
    });
  }
});
