import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { startMongo, stopMongo } from './helpers/mongo';

describe('GET /api/health', () => {
  it('reports in-memory storage when MongoDB is not connected', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'OK',
      database: { status: 'disconnected', connected: false, storageMode: 'in-memory' },
    });
    expect(Number.isInteger(res.body.uptime)).toBe(true);
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  describe('with MongoDB connected', () => {
    beforeAll(startMongo);
    afterAll(stopMongo);

    it('reports mongodb storage', async () => {
      const res = await request(createApp()).get('/api/health');
      expect(res.body.database).toEqual({ status: 'connected', connected: true, storageMode: 'mongodb' });
    });
  });
});

describe('fallback handlers', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('responds 404 for an unknown route', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  it('hides error details outside development', async () => {
    process.env.NODE_ENV = 'production';

    const res = await request(createApp())
      .post('/api/dictionary/words')
      .set('Content-Type', 'application/json')
      .send('{"english":');

    expect(res.body).toEqual({ error: 'Something went wrong!', message: 'Internal server error' });
  });

  it('shows the error message in development', async () => {
    process.env.NODE_ENV = 'development';

    const res = await request(createApp())
      .post('/api/dictionary/words')
      .set('Content-Type', 'application/json')
      .send('{"english":');

    expect(res.body.error).toBe('Something went wrong!');
    expect(res.body.message).toMatch(/JSON/);
  });

  // #26: body-parser xətaları (status 400/413) global handler-də 500-ə çevrilir
  it.fails('responds 400 for malformed JSON (#26)', async () => {
    const res = await request(createApp())
      .post('/api/dictionary/words')
      .set('Content-Type', 'application/json')
      .send('{"english":');
    expect(res.status).toBe(400);
  });

  it.fails('responds 413 for a JSON body over 10kb (#26)', async () => {
    const res = await request(createApp())
      .post('/api/dictionary/words')
      .send({ english: 'a', translation: 'x'.repeat(11 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe('security headers and CORS', () => {
  afterEach(() => {
    delete process.env.FRONTEND_URL;
  });

  it('sets helmet headers but allows cross-origin image loading', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBeUndefined();
  });

  it.each(['http://localhost:5173', 'http://localhost:5174'])('allows the dev frontend origin %s', async (origin) => {
    const res = await request(createApp()).get('/api/health').set('Origin', origin);

    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows FRONTEND_URL', async () => {
    process.env.FRONTEND_URL = 'https://teacher.example.com';

    const res = await request(createApp()).get('/api/health').set('Origin', 'https://teacher.example.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://teacher.example.com');
  });

  it('does not allow other origins', async () => {
    const res = await request(createApp()).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('general rate limit', () => {
  it('allows 200 API requests per window and rejects the 201st with 429', async () => {
    const app = createApp();

    for (let i = 0; i < 200; i++) await request(app).get('/api/nope');
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many requests. Please try again later.' });
  });
});
