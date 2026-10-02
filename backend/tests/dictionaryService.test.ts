import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import {
  dictionaryService,
  DuplicateWordError,
  WordNotFoundError,
  StorageUnavailableError,
} from '../src/services/dictionaryService';
import { Word } from '../src/models/Word';
import { uploadPath } from '../src/middleware/upload';
import { startMongo, stopMongo, clearMongo, reconnectMongo } from './helpers/mongo';

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
    if (useMongo) {
      await startMongo();
      await Word.init(); // unique index qurulsun
    }
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

    // #10: yoxla-sonra-yaz arasında eyni anda gələn sorğular dublikat yaratmamalıdır
    it('stores only one word when the same word is added concurrently (#10)', async () => {
      const results = await Promise.allSettled([add('apple'), add('Apple'), add('APPLE')]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results.filter((r) => r.status === 'rejected')) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(DuplicateWordError);
      }
      expect((await dictionaryService.getAllWords()).total).toBe(1);
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

    // #4: vaxtından əvvəl təkrar ("Review Again") cədvəli dəyişməməlidir
    describe('early review (#4)', () => {
      it('keeps the interval and the review date when the word is not yet due', async () => {
        const { id } = plain(await add('apple'));
        const first = plain(await dictionaryService.updateLearningStatus(id, true));

        travelDays(3);
        const again = plain(await dictionaryService.updateLearningStatus(id, true));

        expect(again).toMatchObject({
          status: 'known',
          reviewIntervalDays: 7,
          nextReviewDate: first.nextReviewDate,
        });
      });

      it('keeps the schedule through several early reviews, then grows once due', async () => {
        const { id } = plain(await add('apple'));
        await dictionaryService.updateLearningStatus(id, true);
        await dictionaryService.updateLearningStatus(id, true);
        await dictionaryService.updateLearningStatus(id, true);

        travelDays(8);
        const due = plain(await dictionaryService.updateLearningStatus(id, true));

        expect(due.reviewIntervalDays).toBe(28);
      });

      it('grows the interval exactly at the review date', async () => {
        const { id } = plain(await add('apple'));
        const first = plain(await dictionaryService.updateLearningStatus(id, true));

        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(first.nextReviewDate));
        const due = plain(await dictionaryService.updateLearningStatus(id, true));

        expect(due.reviewIntervalDays).toBe(28);
      });
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

    // #10: redaktə zamanı da dublikat yoxlanılmalıdır
    it('rejects renaming a word to an existing word, regardless of case (#10)', async () => {
      await add('apple');
      const { id } = plain(await add('pear'));

      await expect(
        dictionaryService.updateWord(id, { english: 'Apple', translation: 'alma' }),
      ).rejects.toBeInstanceOf(DuplicateWordError);
      expect(plain((await dictionaryService.getAllWords()).words).map((w: any) => w.english).sort()).toEqual([
        'apple',
        'pear',
      ]);
    });

    it('allows a word to keep its own name or change only its case (#10)', async () => {
      const { id } = plain(await add('apple'));

      await expect(dictionaryService.updateWord(id, { english: 'apple', translation: 'alma' })).resolves.toBeDefined();
      const word = plain(await dictionaryService.updateWord(id, { english: 'Apple', translation: 'alma' }));

      expect(word.english).toBe('Apple');
    });

    it('reports WordNotFoundError before checking duplicates', async () => {
      await add('apple');
      await expect(
        dictionaryService.updateWord('missing', { english: 'apple', translation: 'x' }),
      ).rejects.toBeInstanceOf(WordNotFoundError);
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
  beforeAll(async () => {
    await startMongo();
    await Word.init(); // unique index qurulsun
  });
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

  // Köhnə sənəd: status known, amma nextReviewDate yoxdur — vaxtı çatmış sayılır
  it('treats a legacy known word without a review date as due (#4)', async () => {
    await Word.collection.insertOne({
      _id: 'legacy-known',
      english: 'legacy',
      translation: 'köhnə',
      status: 'known',
      reviewIntervalDays: 7,
      dateAdded: new Date(),
    } as any);

    const word = plain(await dictionaryService.updateLearningStatus('legacy-known', true));

    expect(word.reviewIntervalDays).toBe(28);
  });

  it('enforces case-insensitive uniqueness in the database itself (#10)', async () => {
    await Word.create({ english: 'apple', translation: 'alma' });

    await expect(Word.create({ english: 'APPLE', translation: 'x' })).rejects.toMatchObject({ code: 11000 });
  });

  it('turns a duplicate-key error on update into DuplicateWordError (#10)', async () => {
    await add('apple');
    const { id } = plain(await add('pear'));
    // Yarış halı: servisin dublikat yoxlaması (english üzrə findOne) heç nə tapmır,
    // yazma isə DB index-inə dəyir. Digər findOne çağırışları (məs. Word.exists) real qalır
    const realFindOne = Word.findOne.bind(Word);
    vi.spyOn(Word, 'findOne').mockImplementation(((filter: any, ...rest: any[]) =>
      filter?.english ? Promise.resolve(null) : realFindOne(filter, ...rest)) as any);

    await expect(
      dictionaryService.updateWord(id, { english: 'APPLE', translation: 'alma' }),
    ).rejects.toBeInstanceOf(DuplicateWordError);
    vi.restoreAllMocks();
  });

  // #3: MongoDB rejimində bağlantı qopanda yazılar səssizcə in-memory-yə düşməməlidir
  describe('when MongoDB disconnects at runtime (#3)', () => {
    afterEach(async () => {
      if (mongoose.connection.readyState !== 1) await reconnectMongo();
    });

    it('rejects every operation with StorageUnavailableError', async () => {
      const { id } = plain(await add('apple'));
      await mongoose.disconnect();

      const operations = [
        () => dictionaryService.getAllWords(),
        () => dictionaryService.getAllWords({ page: 1, limit: 10 }),
        () => dictionaryService.getLearningWords(),
        () => add('pear'),
        () => dictionaryService.updateWord(id, { english: 'apple', translation: 'x' }),
        () => dictionaryService.updateLearningStatus(id, true),
        () => dictionaryService.deleteWord(id),
      ];
      for (const operation of operations) {
        await expect(operation()).rejects.toBeInstanceOf(StorageUnavailableError);
      }
    });

    // Köhnə davranış: söz "uğurla" qəbul edilirdi (in-memory-yə), bağlantı qayıdanda isə yox olurdu
    it('reports a write during the outage instead of silently accepting it', async () => {
      await mongoose.disconnect();
      const result = await add('lost').then(
        () => 'accepted',
        (error) => error,
      );
      await reconnectMongo();

      expect(result).toBeInstanceOf(StorageUnavailableError);
      expect((await dictionaryService.getAllWords()).total).toBe(0);
    });

    it('works again after reconnecting', async () => {
      await mongoose.disconnect();
      await reconnectMongo();

      await add('apple');
      expect((await dictionaryService.getAllWords()).total).toBe(1);
    });
  });

  it('stores words as UUID string ids', async () => {
    const { id } = plain(await add('apple'));
    expect(await Word.findById(id)).not.toBeNull();
  });
});
