import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

// Route qatı test olunur — aiContentService öz faylında test olunub
const service = vi.hoisted(() => ({
  generateReadingText: vi.fn(),
  translateWord: vi.fn(),
  getPronunciation: vi.fn(),
  generateExampleSentences: vi.fn(),
}));

vi.mock('../src/services/aiContentService', () => ({ aiContentService: service }));

// Hər testdə təzə tətbiq — rate limit sayğacları sıfırdan başlayır
let app: ReturnType<typeof createApp>;
const post = (path: string, body: object) => request(app).post(`/api/ai${path}`).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
});

describe('POST /api/ai/generate-text', () => {
  const body = { level: 'Intermediate', apiToken: 'sk-1', provider: 'gemini', model: 'gemini-2.5-flash', customPrompt: 'Cats' };

  it('returns the generated text', async () => {
    service.generateReadingText.mockResolvedValue({ success: true, text: 'A story' });

    const res = await post('/generate-text', body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, text: 'A story' });
    expect(service.generateReadingText).toHaveBeenCalledWith(
      { provider: 'gemini', apiToken: 'sk-1', model: 'gemini-2.5-flash' },
      'Intermediate',
      'Cats',
    );
  });

  it('responds 400 with the AI error when generation fails', async () => {
    service.generateReadingText.mockResolvedValue({ success: false, error: 'Invalid key' });

    const res = await post('/generate-text', body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'AI text generation failed: Invalid key.' });
  });

  it('treats a success without text as a failure', async () => {
    service.generateReadingText.mockResolvedValue({ success: true, text: '' });

    const res = await post('/generate-text', body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('AI text generation failed: Unknown error.');
  });

  it('responds 500 when the service throws', async () => {
    service.generateReadingText.mockRejectedValue(new Error('boom'));
    const res = await post('/generate-text', body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'An unexpected error occurred on the server.' });
  });

  it('validates the body before calling the service', async () => {
    const res = await post('/generate-text', { ...body, level: 'Beginner' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(service.generateReadingText).not.toHaveBeenCalled();
  });
});

describe('POST /api/ai/translate-word', () => {
  const body = {
    word: 'bank',
    targetLanguage: 'Azerbaijani',
    languageCode: 'az',
    contextSentence: 'The river bank.',
    aiToken: 'sk-1',
    provider: 'openai',
  };

  it('returns the translation', async () => {
    service.translateWord.mockResolvedValue({ success: true, translation: 'sahil' });

    const res = await post('/translate-word', body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, translation: 'sahil' });
    expect(service.translateWord).toHaveBeenCalledWith(
      { provider: 'openai', apiToken: 'sk-1', model: undefined },
      { word: 'bank', targetLanguage: 'Azerbaijani', contextSentence: 'The river bank.' },
    );
  });

  it.each(['aiToken', 'provider'])('responds 400 without %s', async (field) => {
    const res = await post('/translate-word', { ...body, [field]: undefined });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('AI token and provider are required for translation');
    expect(service.translateWord).not.toHaveBeenCalled();
  });

  it('responds 502 when the AI provider fails', async () => {
    service.translateWord.mockResolvedValue({ success: false, error: 'quota' });

    const res = await post('/translate-word', body);

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ success: false, error: 'quota' });
  });

  it('responds 500 when the service throws', async () => {
    service.translateWord.mockRejectedValue(new Error('boom'));
    const res = await post('/translate-word', body);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to translate word');
  });

  it('validates the body', async () => {
    const res = await post('/translate-word', { ...body, languageCode: 'a' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/ai/pronunciation', () => {
  const body = { word: 'apart', aiToken: 'sk-1', provider: 'mistral', model: 'm' };

  it('returns the pronunciation', async () => {
    service.getPronunciation.mockResolvedValue({ success: true, pronunciation: '/əˈpɑːrt/' });

    const res = await post('/pronunciation', body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, pronunciation: '/əˈpɑːrt/' });
    expect(service.getPronunciation).toHaveBeenCalledWith({ provider: 'mistral', apiToken: 'sk-1', model: 'm' }, 'apart');
  });

  it('responds 400 without a token', async () => {
    const res = await post('/pronunciation', { word: 'apart', provider: 'mistral' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('AI token and provider are required for pronunciation');
  });

  it('responds 502 when the AI provider fails', async () => {
    service.getPronunciation.mockResolvedValue({ success: false, error: 'quota' });
    expect((await post('/pronunciation', body)).status).toBe(502);
  });

  it('responds 500 when the service throws', async () => {
    service.getPronunciation.mockRejectedValue(new Error('boom'));
    const res = await post('/pronunciation', body);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to get pronunciation');
  });
});

describe('POST /api/ai/example-sentences', () => {
  const body = { word: 'bank', level: 'Advanced', aiToken: 'sk-1', provider: 'deepseek' };

  it('returns the sentences', async () => {
    service.generateExampleSentences.mockResolvedValue({ success: true, sentences: ['The bank is open.'] });

    const res = await post('/example-sentences', body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, sentences: ['The bank is open.'] });
    expect(service.generateExampleSentences).toHaveBeenCalledWith(
      { provider: 'deepseek', apiToken: 'sk-1', model: undefined },
      'bank',
      'Advanced',
    );
  });

  it('responds 400 without a provider', async () => {
    const res = await post('/example-sentences', { word: 'bank', aiToken: 'sk-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('AI token and provider are required for generating example sentences');
  });

  it('responds 502 when the AI provider fails', async () => {
    service.generateExampleSentences.mockResolvedValue({ success: false, error: 'quota' });
    expect((await post('/example-sentences', body)).status).toBe(502);
  });

  it('responds 500 when the service throws', async () => {
    service.generateExampleSentences.mockRejectedValue(new Error('boom'));
    const res = await post('/example-sentences', body);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to generate example sentences');
  });
});

describe('AI rate limit', () => {
  it('allows 30 AI requests per window and rejects the 31st with 429', async () => {
    service.getPronunciation.mockResolvedValue({ success: true, pronunciation: '/x/' });
    const body = { word: 'x', aiToken: 't', provider: 'openai' };

    for (let i = 0; i < 30; i++) {
      expect((await post('/pronunciation', body)).status).toBe(200);
    }
    const res = await post('/pronunciation', body);

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'Too many AI requests. Please wait and try again.' });
  });

  it('counts invalid requests too', async () => {
    for (let i = 0; i < 30; i++) await post('/pronunciation', {});
    expect((await post('/pronunciation', {})).status).toBe(429);
  });

  it('does not limit dictionary requests by the AI limit', async () => {
    for (let i = 0; i < 31; i++) await post('/pronunciation', {});
    expect((await request(app).get('/api/dictionary/words')).status).toBe(200);
  });
});

// #28: boşluqdan ibarət söz AI-a göndərilməməlidir, kənar boşluqlar isə silinməlidir
describe.each([
  ['/translate-word', 'translateWord', { targetLanguage: 'Azerbaijani', languageCode: 'az' }],
  ['/pronunciation', 'getPronunciation', {}],
  ['/example-sentences', 'generateExampleSentences', {}],
] as const)('POST /api/ai%s word handling (#28)', (path, method, rest) => {
  const auth = { aiToken: 'sk-1', provider: 'openai' };

  it('responds 400 for a whitespace-only word without calling the AI', async () => {
    const res = await post(path, { ...rest, ...auth, word: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(['word: word is required']);
    expect(service[method]).not.toHaveBeenCalled();
  });

  it('passes the trimmed word to the AI', async () => {
    service[method].mockResolvedValue({ success: true });

    await post(path, { ...rest, ...auth, word: '  bank ' });

    const [, wordArg] = service[method].mock.calls[0];
    expect(typeof wordArg === 'string' ? wordArg : wordArg.word).toBe('bank');
  });
});
