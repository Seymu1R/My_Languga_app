import { describe, it, expect, vi, afterAll } from 'vitest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import connectDB from '../src/config/database';
import { Word } from '../src/models/Word';
import { logger } from '../src/utils/logger';
import { createMongoServer } from './helpers/mongo';

// Real ssenari: köhnə bazada hərf böyüklüyü ilə fərqlənən dublikatlar artıq var.
// Unique index (#10) qurula bilmir — server çökməməli, aydın xəbərdarlıq verməlidir.
// (Vitest idarə olunmayan promise rejection-ları da xəta sayır.)
describe('connectDB with existing case-only duplicates (#10)', () => {
  let server: MongoMemoryServer;

  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
    delete process.env.MONGODB_URI;
  });

  it('connects, logs the index problem and keeps the data usable', async () => {
    server = await createMongoServer();
    const seed = await mongoose.createConnection(server.getUri(), { dbName: 'language_learning' }).asPromise();
    await seed.collection('words').insertMany([
      { _id: 'a', english: 'Apple', translation: 'alma' },
      { _id: 'b', english: 'apple', translation: 'alma' },
    ] as any[]);
    await seed.close();

    process.env.MONGODB_URI = server.getUri();
    const error = vi.spyOn(logger, 'error');

    await expect(connectDB()).resolves.toBeUndefined();

    expect(mongoose.connection.readyState).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.anything() }), expect.stringMatching(/letter case/));
    expect(await Word.countDocuments()).toBe(2);
  });
});
