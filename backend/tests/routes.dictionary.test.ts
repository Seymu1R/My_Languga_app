import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { dictionaryService } from '../src/services/dictionaryService';
import { uploadPath } from '../src/middleware/upload';
import { PNG, JPEG, GIF, WEBP, HTML, SVG } from './helpers/images';

// In-memory storage (MONGODB_URI yoxdur) — route qatı hər iki rejimdə eynidir
const app = createApp();
const api = () => request(app);

const addWord = (english: string, extra: Record<string, unknown> = {}) =>
  api().post('/api/dictionary/words').send({ english, translation: `${english}-tr`, ...extra });

const uploadedFiles = () => (fs.existsSync(uploadPath) ? fs.readdirSync(uploadPath) : []);

beforeEach(async () => {
  const { words } = await dictionaryService.getAllWords();
  for (const word of words) await dictionaryService.deleteWord(word.id);
  for (const file of uploadedFiles()) fs.rmSync(path.join(uploadPath, file));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/dictionary/words', () => {
  it('returns all words without pagination metadata by default', async () => {
    await addWord('apple');

    const res = await api().get('/api/dictionary/words');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.words.map((w: any) => w.english)).toEqual(['apple']);
    expect(res.body).not.toHaveProperty('pagination');
  });

  it('returns a page with pagination metadata', async () => {
    for (const english of ['a1', 'a2', 'a3']) await addWord(english);

    const res = await api().get('/api/dictionary/words?page=2&limit=2');

    expect(res.body.words).toHaveLength(1);
    expect(res.body.pagination).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2 });
  });

  it.each([
    ['limit above 100 is capped', '?limit=500', { page: 1, limit: 100 }],
    ['page below 1 becomes 1', '?page=-3&limit=5', { page: 1, limit: 5 }],
    ['non-numeric page becomes 1', '?page=abc', { page: 1, limit: 20 }],
    ['only limit given', '?limit=10', { page: 1, limit: 10 }],
    ['negative limit becomes 1', '?limit=-5', { page: 1, limit: 1 }],
    ['zero limit falls back to the default', '?limit=0', { page: 1, limit: 20 }],
  ])('normalises pagination: %s', async (_case, query, expected) => {
    const res = await api().get(`/api/dictionary/words${query}`);
    expect(res.body.pagination).toMatchObject(expected);
  });

  it('responds 500 when the service fails', async () => {
    vi.spyOn(dictionaryService, 'getAllWords').mockRejectedValue(new Error('db down'));

    const res = await api().get('/api/dictionary/words');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to retrieve words' });
  });
});

describe('GET /api/dictionary/words/learnings', () => {
  it('returns words that are still being learned', async () => {
    const { body } = await addWord('apple');
    const known = await addWord('pear');
    await api().patch(`/api/dictionary/words/${known.body.word.id}/learning-status`).send({ known: true });

    const res = await api().get('/api/dictionary/words/learnings');

    expect(res.status).toBe(200);
    expect(res.body.words.map((w: any) => w.id)).toEqual([body.word.id]);
  });

  it('responds 500 when the service fails', async () => {
    vi.spyOn(dictionaryService, 'getLearningWords').mockRejectedValue(new Error('db down'));
    const res = await api().get('/api/dictionary/words/learnings');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to retrieve learning words');
  });
});

describe('POST /api/dictionary/words', () => {
  it('creates a word and responds 201', async () => {
    const res = await addWord(' apple ', { pronunciation: '/ˈæp.əl/' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Word added successfully',
      word: { english: 'apple', translation: 'apple -tr', status: 'learning' },
    });
  });

  it('ignores client-supplied SRS fields', async () => {
    const res = await addWord('apple', { status: 'known', reviewIntervalDays: 30 });

    expect(res.body.word).toMatchObject({ status: 'learning', reviewIntervalDays: 7 });
  });

  it('responds 409 for a duplicate word', async () => {
    await addWord('apple');

    const res = await addWord('Apple');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, error: 'Word already exists in dictionary' });
  });

  it('responds 400 with details for an invalid body', async () => {
    const res = await api().post('/api/dictionary/words').send({ english: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/^english: /)]));
  });

  it('rejects a whitespace-only word with 400 and stores nothing (#27)', async () => {
    const res = await api().post('/api/dictionary/words').send({ english: '   ', translation: 'alma' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['english: english is required']);
    expect((await api().get('/api/dictionary/words')).body.words).toEqual([]);
  });

  it('rejects a path traversal imageUrl (#1)', async () => {
    const res = await addWord('apple', { imageUrl: '/uploads/../../../etc/passwd' });
    expect(res.status).toBe(400);
  });

  it('responds 500 when the service fails unexpectedly', async () => {
    vi.spyOn(dictionaryService, 'addWord').mockRejectedValue(new Error('db down'));
    const res = await addWord('apple');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to add word');
  });
});

describe('PUT /api/dictionary/words/:id', () => {
  it('updates the word', async () => {
    const { body } = await addWord('apple');

    const res = await api()
      .put(`/api/dictionary/words/${body.word.id}`)
      .send({ english: 'green apple', translation: 'yaşıl alma' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, word: { english: 'green apple' }, message: 'Word updated successfully' });
  });

  it('responds 404 for an unknown id', async () => {
    const res = await api().put('/api/dictionary/words/missing').send({ english: 'a', translation: 'b' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Word not found' });
  });

  it('responds 400 for an invalid body', async () => {
    const { body } = await addWord('apple');
    const res = await api().put(`/api/dictionary/words/${body.word.id}`).send({ english: 'a' });
    expect(res.status).toBe(400);
  });

  it('rejects renaming a word to whitespace only (#27)', async () => {
    const { body } = await addWord('apple');

    const res = await api().put(`/api/dictionary/words/${body.word.id}`).send({ english: 'apple', translation: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['translation: translation is required']);
  });
});

describe('PATCH /api/dictionary/words/:id/learning-status', () => {
  it.each([
    [true, 'known', 'Word marked as known'],
    [false, 'learning', 'Word moved back to learning'],
  ])('known=%s sets status %s', async (known, status, message) => {
    const { body } = await addWord('apple');

    const res = await api().patch(`/api/dictionary/words/${body.word.id}/learning-status`).send({ known });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, word: { status }, message });
  });

  it('responds 400 when known is not a boolean', async () => {
    const { body } = await addWord('apple');
    const res = await api().patch(`/api/dictionary/words/${body.word.id}/learning-status`).send({ known: 'yes' });
    expect(res.status).toBe(400);
  });

  it('responds 404 for an unknown id', async () => {
    const res = await api().patch('/api/dictionary/words/missing/learning-status').send({ known: true });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/dictionary/words/:id', () => {
  it('deletes the word', async () => {
    const { body } = await addWord('apple');

    const res = await api().delete(`/api/dictionary/words/${body.word.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Word deleted successfully' });
    expect((await api().get('/api/dictionary/words')).body.words).toEqual([]);
  });

  it('responds 404 for an unknown id', async () => {
    const res = await api().delete('/api/dictionary/words/missing');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/dictionary/upload-image', () => {
  const upload = (buffer: Buffer, filename: string, contentType: string, field = 'image') =>
    api().post('/api/dictionary/upload-image').attach(field, buffer, { filename, contentType });

  it.each([
    ['PNG', PNG, 'image/png', '.png'],
    ['JPEG', JPEG, 'image/jpeg', '.jpg'],
    ['GIF', GIF, 'image/gif', '.gif'],
    ['WebP', WEBP, 'image/webp', '.webp'],
  ])('stores a %s image and returns its URL', async (_type, buffer, contentType, extension) => {
    const res = await upload(buffer, 'picture.bin', contentType);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imageUrl).toMatch(new RegExp(`^/uploads/\\d+-\\d+\\${extension}$`));
    expect(uploadedFiles()).toEqual([path.basename(res.body.imageUrl)]);
  });

  it('takes the extension from the type, not from the file name (#8)', async () => {
    const res = await upload(JPEG, 'şəkil.jp g', 'image/jpeg');

    expect(res.body.imageUrl).toMatch(/\.jpg$/);
    // #1-dən qalan problem: bu imageUrl ilə söz artıq saxlanılır
    expect((await addWord('apple', { imageUrl: res.body.imageUrl })).status).toBe(201);
  });

  it('rejects HTML disguised as PNG and removes the file (#8)', async () => {
    const res = await upload(HTML, 'x.html', 'image/png');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'File content is not a valid image of the declared type' });
    expect(uploadedFiles()).toEqual([]);
  });

  it('rejects a JPEG declared as PNG', async () => {
    const res = await upload(JPEG, 'x.png', 'image/png');
    expect(res.status).toBe(400);
    expect(uploadedFiles()).toEqual([]);
  });

  it.each([
    ['SVG', SVG, 'image/svg+xml'],
    ['HTML', HTML, 'text/html'],
    ['a PDF', Buffer.from('%PDF-1.4'), 'application/pdf'],
  ])('rejects %s by type with 400 (#7, #8)', async (_type, buffer, contentType) => {
    const res = await upload(buffer, 'file', contentType);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Only JPEG, PNG, WebP and GIF images are allowed' });
    expect(uploadedFiles()).toEqual([]);
  });

  it('rejects a file over 5MB with 413 and leaves nothing behind (#7)', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);

    const res = await upload(big, 'big.jpg', 'image/jpeg');

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, error: 'Image must be 5MB or smaller' });
    expect(uploadedFiles()).toEqual([]);
  });

  it('rejects an unexpected field name with 400 (#7)', async () => {
    const res = await upload(PNG, 'a.png', 'image/png', 'file');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Unexpected field' });
  });

  it('responds 400 when no file is sent', async () => {
    const res = await api().post('/api/dictionary/upload-image').field('other', '1');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'No image file provided' });
  });

  it('serves the uploaded file from /uploads (#21)', async () => {
    const { body } = await upload(PNG, 'a.png', 'image/png');

    const res = await api().get(body.imageUrl);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('upload → save → delete removes the file again', async () => {
    const { body: uploaded } = await upload(PNG, 'a.png', 'image/png');
    const { body: created } = await addWord('apple', { imageUrl: uploaded.imageUrl });
    expect(uploadedFiles()).toHaveLength(1);

    await api().delete(`/api/dictionary/words/${created.word.id}`);

    expect(uploadedFiles()).toEqual([]);
  });
});
