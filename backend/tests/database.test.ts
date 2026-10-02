import { describe, it, expect, vi, afterEach } from 'vitest';
import mongoose from 'mongoose';
import connectDB from '../src/config/database';
import { logger } from '../src/utils/logger';

describe('connectDB', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MONGODB_URI;
  });

  it('skips connecting and warns when MONGODB_URI is not set', async () => {
    const connect = vi.spyOn(mongoose, 'connect');
    const warn = vi.spyOn(logger, 'warn');

    await connectDB();

    expect(connect).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('connects to the language_learning database', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017';
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    await connectDB();

    expect(connect).toHaveBeenCalledWith('mongodb://example:27017', { dbName: 'language_learning' });
  });

  it('logs and resolves instead of throwing when the connection fails', async () => {
    process.env.MONGODB_URI = 'mongodb://example:27017';
    vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('ECONNREFUSED'));
    const error = vi.spyOn(logger, 'error');

    await expect(connectDB()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });
});
