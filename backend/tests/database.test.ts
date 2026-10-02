import { describe, it, expect, vi, afterEach } from 'vitest';
import mongoose from 'mongoose';
import connectDB from '../src/config/database';
import { logger } from '../src/utils/logger';
import { Word } from '../src/models/Word';
import { getStorageMode, setStorageMode } from '../src/config/storage';

describe('connectDB', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MONGODB_URI;
    setStorageMode('in-memory');
  });

  it('skips connecting and warns when MONGODB_URI is not set', async () => {
    const connect = vi.spyOn(mongoose, 'connect');
    const warn = vi.spyOn(logger, 'warn');

    await connectDB();

    expect(connect).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(getStorageMode()).toBe('in-memory');
  });

  it('connects to the language_learning database and builds the word indexes', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017';
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    const init = vi.spyOn(Word, 'init').mockResolvedValue(undefined as any);

    await connectDB();

    expect(connect).toHaveBeenCalledWith('mongodb://example:27017', {
      dbName: 'language_learning',
      serverSelectionTimeoutMS: 5000,
    });
    expect(init).toHaveBeenCalledOnce();
  });

  // #3: rejim açılışda bir dəfə seçilir
  it('switches to mongodb storage after a successful connection (#3)', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017';
    vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    vi.spyOn(Word, 'init').mockResolvedValue(undefined as any);

    await connectDB();

    expect(getStorageMode()).toBe('mongodb');
  });

  it('keeps running and explains when the word indexes cannot be built (#10)', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017';
    vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    vi.spyOn(Word, 'init').mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    const error = vi.spyOn(logger, 'error');

    await expect(connectDB()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.stringMatching(/letter case/));
  });

  it('logs and resolves instead of throwing when the connection fails', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017';
    vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('ECONNREFUSED'));
    const init = vi.spyOn(Word, 'init');
    const error = vi.spyOn(logger, 'error');

    await expect(connectDB()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    expect(init).not.toHaveBeenCalled();
    expect(getStorageMode()).toBe('in-memory');
  });
});
