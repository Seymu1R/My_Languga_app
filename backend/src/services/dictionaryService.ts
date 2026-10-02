import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Word } from '../models/Word';
import { logger } from '../utils/logger';
import { uploadPath } from '../middleware/upload';
import { getStorageMode } from '../config/storage';
import type { AddWordBody } from '../types';

// Custom domain errors — router bunları HTTP status-lara map edir
export class DuplicateWordError extends Error {
  constructor() {
    super('Word already exists in dictionary');
    this.name = 'DuplicateWordError';
  }
}

export class WordNotFoundError extends Error {
  constructor() {
    super('Word not found');
    this.name = 'WordNotFoundError';
  }
}

// MongoDB rejimində bağlantı (müvəqqəti) yoxdur — router 503-ə map edir (#3)
export class StorageUnavailableError extends Error {
  constructor() {
    super('Database is temporarily unavailable. Please try again shortly.');
    this.name = 'StorageUnavailableError';
  }
}

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Rejim açılışda seçilir (config/storage). MongoDB rejimində bağlantı yoxdursa xəta atırıq —
// əvvəl yazılar səssizcə in-memory-yə düşür və bağlantı qayıdanda itirdi (#3)
const useMongo = () => {
  if (getStorageMode() !== 'mongodb') return false;
  if (mongoose.connection.readyState !== 1) throw new StorageUnavailableError();
  return true;
};

// Unique index (english_unique_ci) pozulanda MongoDB 11000 qaytarır (#10)
const isDuplicateKeyError = (error: unknown) => (error as { code?: number })?.code === 11000;

// Hərf böyüklüyündən asılı olmayaraq eyni sözü tap; excludeId — redaktə olunan sözün özü
const findWordByEnglish = (english: string, excludeId?: string) =>
  Word.findOne({
    english: { $regex: new RegExp(`^${escapeRegex(english)}$`, 'i') },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

const hasMemoryDuplicate = (english: string, excludeId?: string) =>
  memoryDictionary.some(
    (w) => w.id !== excludeId && w.english.toLowerCase() === english.toLowerCase(),
  );

// Spaced Repetition System (SRS) parametrləri
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_DAYS = 7;
const MAX_INTERVAL_DAYS = 30;
const INTERVAL_GROWTH_FACTOR = 4;

// In-memory fallback storage (MongoDB bağlı olmayanda)
let memoryDictionary: any[] = [];
let memoryId = 1;

// Lokal upload olunmuş şəkli sil (xarici URL-lərə toxunmur)
const deleteLocalImage = (imageUrl?: string) => {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;

  // "../" seqmentləri ilə uploads qovluğundan kənara çıxmağın qarşısını al:
  // həll olunmuş yol birbaşa uploads qovluğunun içində olmalıdır
  const imagePath = path.resolve(uploadPath, imageUrl.slice('/uploads/'.length));
  if (path.dirname(imagePath) !== uploadPath) {
    logger.warn({ imageUrl }, 'Refusing to delete file outside uploads directory');
    return;
  }

  if (fs.existsSync(imagePath)) {
    try {
      fs.unlinkSync(imagePath);
    } catch (err) {
      logger.error({ err, imageUrl }, 'Failed to delete image file');
    }
  }
};

// Review vaxtı çatıbmı? Tarixi olmayan (köhnə) "known" söz vaxtı çatmış sayılır
const isReviewDue = (nextReviewDate: Date | string | null | undefined) =>
  !nextReviewDate || new Date(nextReviewDate).getTime() <= Date.now();

// Vaxtından əvvəl "bilirəm" ("Review Again") cədvəli dəyişmir — interval yalnız
// review vaxtı çatanda böyüyür (#4)
const isEarlyReview = (
  currentStatus: string | undefined,
  nextReviewDate: Date | string | null | undefined,
) => currentStatus === 'known' && !isReviewDue(nextReviewDate);

// Söz artıq "known" idisə intervalı genişləndir, əks halda cari intervalı saxla
const computeNextInterval = (
  currentStatus: string | undefined,
  currentInterval: number | undefined,
) => {
  const interval = currentInterval || DEFAULT_INTERVAL_DAYS;
  return currentStatus === 'known'
    ? Math.min(interval * INTERVAL_GROWTH_FACTOR, MAX_INTERVAL_DAYS)
    : interval;
};

const normalizeWordFields = (data: AddWordBody) => ({
  english: data.english.trim(),
  translation: data.translation.trim(),
  pronunciation: data.pronunciation?.trim(),
  referenceSentence: data.referenceSentence?.trim(),
  imageUrl: data.imageUrl?.trim(),
});

export interface PaginationParams {
  page: number;
  limit: number;
}

export const dictionaryService = {
  // pagination verilməsə bütün sözlər qaytarılır (geriyə uyğunluq)
  async getAllWords(pagination?: PaginationParams) {
    if (useMongo()) {
      if (!pagination) {
        const words = await Word.find().sort({ dateAdded: -1 });
        return { words, total: words.length };
      }

      const { page, limit } = pagination;
      const [words, total] = await Promise.all([
        Word.find().sort({ dateAdded: -1 }).skip((page - 1) * limit).limit(limit),
        Word.countDocuments(),
      ]);
      return { words, total };
    }

    const sorted = [...memoryDictionary].sort(
      (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
    );

    if (!pagination) {
      return { words: sorted, total: sorted.length };
    }

    const start = (pagination.page - 1) * pagination.limit;
    return {
      words: sorted.slice(start, start + pagination.limit),
      total: sorted.length,
    };
  },

  // Learning queue: öyrənilməkdə olan sözlər + review vaxtı çatmış "known" sözlər
  async getLearningWords() {
    const now = new Date();

    if (useMongo()) {
      return Word.find({
        $or: [
          { status: 'learning' },
          { status: { $exists: false } },
          { status: 'known', nextReviewDate: { $lte: now } },
        ],
      }).sort({ dateAdded: -1 });
    }

    return memoryDictionary
      .filter((word) => {
        if (word.status !== 'known') return true;
        if (!word.nextReviewDate) return true;
        return new Date(word.nextReviewDate).getTime() <= now.getTime();
      })
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  },

  async addWord(data: AddWordBody) {
    const fields = normalizeWordFields(data);

    if (useMongo()) {
      if (await findWordByEnglish(fields.english)) throw new DuplicateWordError();

      const newWord = new Word(fields);
      try {
        await newWord.save();
      } catch (error) {
        // Yoxlamadan sonra eyni söz başqa sorğu ilə artıq yazılıb
        if (isDuplicateKeyError(error)) throw new DuplicateWordError();
        throw error;
      }
      return newWord.toJSON();
    }

    if (hasMemoryDuplicate(fields.english)) throw new DuplicateWordError();

    const newWord = {
      id: (memoryId++).toString(),
      ...fields,
      status: 'learning',
      nextReviewDate: null,
      reviewIntervalDays: DEFAULT_INTERVAL_DAYS,
      dateAdded: new Date().toISOString(),
    };

    memoryDictionary.push(newWord);
    return newWord;
  },

  // Flashcard nəticəsinə görə SRS statusunu yenilə
  async updateLearningStatus(id: string, known: boolean) {
    if (useMongo()) {
      const existingWord = await Word.findById(id);
      if (!existingWord) throw new WordNotFoundError();

      if (known && isEarlyReview(existingWord.status, existingWord.nextReviewDate)) {
        return existingWord.toJSON();
      }

      let nextStatus = 'learning';
      let nextReviewDate: Date | null = null;
      let nextIntervalDays = DEFAULT_INTERVAL_DAYS;

      if (known) {
        nextIntervalDays = computeNextInterval(
          existingWord.status,
          existingWord.reviewIntervalDays,
        );
        nextStatus = 'known';
        nextReviewDate = new Date(Date.now() + nextIntervalDays * DAY_IN_MS);
      }

      const updatedWord = await Word.findByIdAndUpdate(
        id,
        { status: nextStatus, nextReviewDate, reviewIntervalDays: nextIntervalDays },
        { new: true },
      );

      return updatedWord?.toJSON();
    }

    const wordIndex = memoryDictionary.findIndex((w) => w.id === id);
    if (wordIndex === -1) throw new WordNotFoundError();

    const currentWord = memoryDictionary[wordIndex];

    if (known && isEarlyReview(currentWord.status, currentWord.nextReviewDate)) {
      return currentWord;
    }

    if (known) {
      const nextIntervalDays = computeNextInterval(
        currentWord.status,
        currentWord.reviewIntervalDays,
      );
      currentWord.status = 'known';
      currentWord.nextReviewDate = new Date(Date.now() + nextIntervalDays * DAY_IN_MS).toISOString();
      currentWord.reviewIntervalDays = nextIntervalDays;
    } else {
      currentWord.status = 'learning';
      currentWord.nextReviewDate = null;
      currentWord.reviewIntervalDays = DEFAULT_INTERVAL_DAYS;
    }

    memoryDictionary[wordIndex] = currentWord;
    return currentWord;
  },

  async deleteWord(id: string) {
    if (useMongo()) {
      const deletedWord = await Word.findByIdAndDelete(id);
      if (!deletedWord) throw new WordNotFoundError();

      deleteLocalImage(deletedWord.imageUrl);
      return;
    }

    const wordIndex = memoryDictionary.findIndex((w) => w.id === id);
    if (wordIndex === -1) throw new WordNotFoundError();

    const [wordToDelete] = memoryDictionary.splice(wordIndex, 1);
    deleteLocalImage(wordToDelete.imageUrl);
  },

  async updateWord(id: string, data: AddWordBody) {
    const fields = normalizeWordFields(data);

    if (useMongo()) {
      if (!(await Word.exists({ _id: id }))) throw new WordNotFoundError();
      // Sözü başqa mövcud sözün adına dəyişmək olmaz; öz adını saxlamaq və ya hərf böyüklüyünü dəyişmək olar (#10)
      if (await findWordByEnglish(fields.english, id)) throw new DuplicateWordError();

      try {
        const updatedWord = await Word.findByIdAndUpdate(id, fields, { new: true });
        if (!updatedWord) throw new WordNotFoundError();
        return updatedWord.toJSON();
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new DuplicateWordError();
        throw error;
      }
    }

    const wordIndex = memoryDictionary.findIndex((w) => w.id === id);
    if (wordIndex === -1) throw new WordNotFoundError();
    if (hasMemoryDuplicate(fields.english, id)) throw new DuplicateWordError();

    memoryDictionary[wordIndex] = { ...memoryDictionary[wordIndex], ...fields };
    return memoryDictionary[wordIndex];
  },
};
