import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import {
  dictionaryService,
  DuplicateWordError,
  WordNotFoundError,
} from '../src/services/dictionaryService';
import { Word } from '../src/models/Word';
import { uploadPath } from '../src/middleware/upload';
import { startMongo, stopMongo, clearMongo } from './helpers/mongo';

const DAY_MS = 24 * 60 * 60 * 1000;

// Mongo sənədlərini və in-memory obyektləri eyni formada müqayisə etmək üçün
const plain = <T>(value: T): any => JSON.parse(JSON.stringify(value));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const add = (english: string, extra: Record<string, string> = {}) =>
  dictionaryService.addWord({ english, translation: `${english}-tr`, ...extra });

// Saxlanılan nextReviewDate-dən sonraya "zaman səyahəti" — yalnız Date saxtalaşdırılır,
// timer-lər real qalır ki, Mongo driver-i işləsin
const travelDays = (days: number) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + days * DAY_MS);
};

describe.each([
  ['in-memory', false],
  ['mongodb', true],
])('dictionaryService (%s storage)', (_mode, useMongo) => {
  beforeAll(async () => {
    if (useMongo) await startMongo();
  });

  afterAll(async () => {
    if (useMongo) await stopMongo();
  });

  beforeEach(async () => {
    if (useMongo) {
      await clearMongo();
      return;
    }
    const { words } = await dictionaryService.getAllWords();
    for (const word of words) await dictionaryService.deleteWord(word.id);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs against the expected storage', () => {
    expect(mongoose.connection.readyState).toBe(useMongo ? 1 : 0);
  });

  describe('addWord', () => {
    it('returns the stored word with trimmed fields and SRS defaults', async () => {
      const word = plain(
        await dictionaryService.addWord({
          english: ' apple ',
          translation: ' alma ',
          pronunciation: ' /ˈæp.əl/ ',
          referenceSentence: ' I like apples. ',
        }),
      );

      expect(word).toMatchObject({
        english: 'apple',
        translation: 'alma',
        pronunciation: '/ˈæp.əl/',
        referenceSentence: 'I like apples.',
        status: 'learning',
        nextReviewDate: null,
        reviewIntervalDays: 7,
      });
      expect(typeof word.id).toBe('string');
      expect(word).not.toHaveProperty('_id');
      expect(Number.isNaN(Date.parse(word.dateAdded))).toBe(false);
    });

    it('rejects a duplicate regardless of case', async () => {
      await add('Apple');
      await expect(add('apple')).rejects.toBeInstanceOf(DuplicateWordError);
      await expect(add('APPLE')).rejects.toBeInstanceOf(DuplicateWordError);
    });

    it('treats regex characters literally when checking duplicates', async () => {
      await add('abc');
      await expect(add('a.c')).resolves.toBeDefined();
    });
  });

  describe('getAllWords', () => {
    it('returns an empty list when the dictionary is empty', async () => {
      expect(await dictionaryService.getAllWords()).toEqual({ words: [], total: 0 });
    });

    it('returns all words, newest first, when no pagination is given', async () => {
      for (const english of ['one', 'two', 'three']) {
        await add(english);
        await sleep(5);
      }

      const { words, total } = await dictionaryService.getAllWords();

      expect(total).toBe(3);
      expect(plain(words).map((w: any) => w.english)).toEqual(['three', 'two', 'one']);
    });

    it('returns one page plus the overall total', async () => {
      for (const english of ['one', 'two', 'three', 'four', 'five']) {
        await add(english);
        await sleep(5);
      }

      const page2 = await dictionaryService.getAllWords({ page: 2, limit: 2 });
      expect(page2.total).toBe(5);
      expect(plain(page2.words).map((w: any) => w.english)).toEqual(['three', 'two']);

      const page3 = await dictionaryService.getAllWords({ page: 3, limit: 2 });
      expect(plain(page3.words).map((w: any) => w.english)).toEqual(['one']);

      const beyond = await dictionaryService.getAllWords({ page: 9, limit: 2 });
      expect(beyond).toEqual({ words: [], total: 5 });
    });
  });

  describe('updateLearningStatus (spaced repetition)', () => {
    it('marks a word known with a 7-day interval', async () => {
      const { id } = plain(await add('apple'));
      const before = Date.now();

      const word = plain(await dictionaryService.updateLearningStatus(id, true));

      expect(word.status).toBe('known');
      expect(word.reviewIntervalDays).toBe(7);
      const due = Date.parse(word.nextReviewDate);
      expect(due).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
      expect(due).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
    });

    it('multiplies the interval by 4 on each due review, capped at 30 days', async () => {
      const { id } = plain(await add('apple'));
      await dictionaryService.updateLearningStatus(id, true); // 7

      travelDays(8);
      const second = plain(await dictionaryService.updateLearningStatus(id, true));
      expect(second.reviewIntervalDays).toBe(28);

      travelDays(29);
      const third = plain(await dictionaryService.updateLearningStatus(id, true));
      expect(third.reviewIntervalDays).toBe(30);
    });

    it('resets a word to learning when it is not known', async () => {
      const { id } = plain(await add('apple'));
      await dictionaryService.updateLearningStatus(id, true);

      const word = plain(await dictionaryService.updateLearningStatus(id, false));

      expect(word).toMatchObject({ status: 'learning', nextReviewDate: null, reviewIntervalDays: 7 });
    });

    // #4: interval review vaxtı çatmadan da böyüyür ("Review Again" → dərhal 28 gün)
    it.fails('does not grow the interval when the word was not yet due (#4)', async () => {
      const { id } = plain(await add('apple'));
      await dictionaryService.updateLearningStatus(id, true);

      const again = plain(await dictionaryService.updateLearningStatus(id, true));
      expect(again.reviewIntervalDays).toBe(7);
    });

    it('throws WordNotFoundError for an unknown id', async () => {
      await expect(dictionaryService.updateLearningStatus('missing', true)).rejects.toBeInstanceOf(
        WordNotFoundError,
      );
    });
  });

  describe('getLearningWords', () => {
    it('returns learning words and known words that are due, but not known words that are not due', async () => {
      const learning = plain(await add('learning'));
      const known = plain(await add('known'));
      await dictionaryService.updateLearningStatus(known.id, true);

      const now = plain(await dictionaryService.getLearningWords()).map((w: any) => w.id);
      expect(now).toEqual([learning.id]);

      travelDays(8);
      const later = plain(await dictionaryService.getLearningWords()).map((w: any) => w.id).sort();
      expect(later).toEqual([learning.id, known.id].sort());
    });

    it('returns an empty list when there are no words', async () => {
      expect(plain(await dictionaryService.getLearningWords())).toEqual([]);
    });
  });

  describe('updateWord', () => {
    it('updates and trims the editable fields', async () => {
      const { id } = plain(await add('apple'));

      const word = plain(
        await dictionaryService.updateWord(id, { english: ' green apple ', translation: ' yaşıl alma ' }),
      );

      expect(word).toMatchObject({ id, english: 'green apple', translation: 'yaşıl alma' });
      const { words } = await dictionaryService.getAllWords();
      expect(plain(words)[0].english).toBe('green apple');
    });

    it('keeps the SRS state', async () => {
      const { id } = plain(await add('apple'));
      await dictionaryService.updateLearningStatus(id, true);

      const word = plain(await dictionaryService.updateWord(id, { english: 'apple', translation: 'alma' }));

      expect(word.status).toBe('known');
    });

    it('throws WordNotFoundError for an unknown id', async () => {
      await expect(
        dictionaryService.updateWord('missing', { english: 'a', translation: 'b' }),
      ).rejects.toBeInstanceOf(WordNotFoundError);
    });

    // #10: redaktə zamanı dublikat yoxlanılmır
    it.fails('rejects renaming a word to an existing word (#10)', async () => {
      await add('apple');
      const { id } = plain(await add('pear'));

      await expect(
        dictionaryService.updateWord(id, { english: 'Apple', translation: 'alma' }),
      ).rejects.toBeInstanceOf(DuplicateWordError);
    });
  });

  describe('deleteWord', () => {
    it('removes the word', async () => {
      const { id } = plain(await add('apple'));

      await dictionaryService.deleteWord(id);

      expect((await dictionaryService.getAllWords()).total).toBe(0);
    });

    it('throws WordNotFoundError for an unknown id', async () => {
      await expect(dictionaryService.deleteWord('missing')).rejects.toBeInstanceOf(WordNotFoundError);
    });

    it('deletes the word image from the uploads directory', async () => {
      const filename = `${Date.now()}-img.png`;
      const file = path.join(uploadPath, filename);
      fs.mkdirSync(uploadPath, { recursive: true });
      fs.writeFileSync(file, 'x');
      const { id } = plain(await add('apple', { imageUrl: `/uploads/${filename}` }));

      await dictionaryService.deleteWord(id);

      expect(fs.existsSync(file)).toBe(false);
    });

    it('does not fail when the image file is already gone', async () => {
      const { id } = plain(await add('apple', { imageUrl: '/uploads/missing.png' }));
      await expect(dictionaryService.deleteWord(id)).resolves.toBeUndefined();
    });

    // #1 regression: service səviyyəsində (Zod-dan yan keçərək) traversal yolu
    it('never deletes files outside the uploads directory (#1)', async () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-outside-'));
      const sentinel = path.join(outsideDir, 'sentinel.txt');
      fs.writeFileSync(sentinel, 'keep me');
      const imageUrl = `/uploads/${path.relative(uploadPath, sentinel)}`;
      const { id } = plain(await add('apple', { imageUrl }));

      await dictionaryService.deleteWord(id);

      expect(fs.existsSync(sentinel)).toBe(true);
      fs.rmSync(outsideDir, { recursive: true, force: true });
    });
  });
});

describe('dictionaryService (mongodb only)', () => {
  beforeAll(startMongo);
  afterAll(stopMongo);
  beforeEach(clearMongo);

  it('treats legacy documents without a status as learning words', async () => {
    await Word.collection.insertOne({
      _id: 'legacy-id',
      english: 'legacy',
      translation: 'köhnə',
      dateAdded: new Date(),
    } as any);

    const words = plain(await dictionaryService.getLearningWords());

    expect(words.map((w: any) => w.id)).toEqual(['legacy-id']);
  });

  it('stores words as UUID string ids', async () => {
    const { id } = plain(await add('apple'));
    expect(await Word.findById(id)).not.toBeNull();
  });
});
