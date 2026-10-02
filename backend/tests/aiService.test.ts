import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService, type AIServiceConfig } from '../src/services/aiService';

// SDK-lar mock olunur — testlər heç bir real API-yə müraciət etmir
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  openAIOptions: [] as any[],
  geminiKeys: [] as string[],
  getGenerativeModel: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mocks.create } };
    constructor(options: any) {
      mocks.openAIOptions.push(options);
    }
  },
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor(apiKey: string) {
      mocks.geminiKeys.push(apiKey);
    }
    getGenerativeModel(config: any) {
      mocks.getGenerativeModel(config);
      return { generateContent: mocks.generateContent };
    }
  },
}));

const completion = (content: string | null) => ({ choices: [{ message: { content } }] });
const apiError = (status: number, message = '') => Object.assign(new Error(message), { status });
const geminiResult = (text: string) => ({ response: Promise.resolve({ text: () => text }) });

const generate = (config: Partial<AIServiceConfig>, params: Record<string, unknown> = {}) =>
  new AIService({ provider: 'openai', apiKey: 'sk-test', ...config } as AIServiceConfig).generateText({
    level: 'Elementary',
    prompt: 'Write a story',
    ...params,
  } as any);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.openAIOptions.length = 0;
  mocks.geminiKeys.length = 0;
});

describe.each([
  {
    provider: 'openai',
    name: 'OpenAI',
    baseURL: undefined,
    defaultModel: 'gpt-4o-mini',
    alias: 'gpt-4',
  },
  {
    provider: 'grok',
    name: 'Grok',
    baseURL: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    alias: 'grok-beta',
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    alias: 'deepseek-v3',
  },
  {
    provider: 'mistral',
    name: 'Mistral',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    alias: 'mistral-medium-latest',
  },
] as const)('AIService with $provider (OpenAI-compatible)', ({ provider, name, baseURL, defaultModel, alias }) => {
  it('returns the generated text', async () => {
    mocks.create.mockResolvedValue(completion('Once upon a time'));

    expect(await generate({ provider })).toEqual({ success: true, text: 'Once upon a time' });
  });

  it('creates the client with the normalised key and the provider base URL', async () => {
    mocks.create.mockResolvedValue(completion('ok'));

    await generate({ provider, apiKey: '  sk-ab cd\n' });

    expect(mocks.openAIOptions).toEqual([baseURL ? { apiKey: 'sk-abcd', baseURL } : { apiKey: 'sk-abcd' }]);
  });

  it('sends the level system prompt, the user prompt and default limits', async () => {
    mocks.create.mockResolvedValue(completion('ok'));

    await generate({ provider });

    const request = mocks.create.mock.calls[0][0];
    expect(request).toMatchObject({ model: defaultModel, max_tokens: 500, temperature: 0.6 });
    expect(request.messages[0].role).toBe('system');
    expect(request.messages[0].content).toContain('Elementary');
    expect(request.messages[1]).toEqual({ role: 'user', content: 'Write a story' });
  });

  it('passes maxTokens and temperature, including temperature 0', async () => {
    mocks.create.mockResolvedValue(completion('ok'));

    await generate({ provider }, { maxTokens: 24, temperature: 0 });

    expect(mocks.create.mock.calls[0][0]).toMatchObject({ max_tokens: 24, temperature: 0 });
  });

  it('maps a retired model alias to the default model', async () => {
    mocks.create.mockResolvedValue(completion('ok'));
    await generate({ provider, model: alias });
    expect(mocks.create.mock.calls[0][0].model).toBe(defaultModel);
  });

  it('passes an unknown model through unchanged', async () => {
    mocks.create.mockResolvedValue(completion('ok'));
    await generate({ provider, model: 'custom-model' });
    expect(mocks.create.mock.calls[0][0].model).toBe('custom-model');
  });

  it('falls back to the Intermediate system prompt for an unknown level', async () => {
    mocks.create.mockResolvedValue(completion('ok'));
    await generate({ provider }, { level: 'Expert' });
    expect(mocks.create.mock.calls[0][0].messages[0].content).toContain('Intermediate');
  });

  it('reports an empty completion', async () => {
    mocks.create.mockResolvedValue(completion(null));
    expect(await generate({ provider })).toEqual({ success: false, error: `No text generated from ${name}` });
  });

  describe('API key validation (no request is sent)', () => {
    it.each([
      ['an empty key', '   ', 'is required'],
      ['a masked key', 'sk-••••••••', 'appears masked or corrupted'],
      ['hidden non-ASCII characters', 'sk-abc​def', 'contains hidden or unsupported characters'],
    ])('rejects %s', async (_case, apiKey, message) => {
      const result = await generate({ provider, apiKey });

      expect(result.success).toBe(false);
      expect(result.error).toContain(`${name} API key ${message}`);
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe('provider errors', () => {
    it('explains an invalid key (401)', async () => {
      mocks.create.mockRejectedValue(apiError(401));
      expect((await generate({ provider })).error).toMatch(new RegExp(`^Invalid ${name} API key`));
    });

    it('explains an unavailable model (404)', async () => {
      mocks.create.mockRejectedValue(apiError(404));
      const { error } = await generate({ provider });
      expect(error).toContain(`Selected ${name} model is unavailable`);
      expect(error).toContain(defaultModel);
    });

    it('distinguishes quota problems from rate limits (429)', async () => {
      mocks.create.mockRejectedValueOnce(apiError(429, 'You exceeded your current quota'));
      expect((await generate({ provider })).error).toContain(`${name} quota or billing limit reached`);

      mocks.create.mockRejectedValueOnce(apiError(429, 'Too fast'));
      expect((await generate({ provider })).error).toContain(`${name} rate limit exceeded`);
    });
  });
});

describe('AIService with gemini', () => {
  it('returns the generated text', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult('Hello'));
    expect(await generate({ provider: 'gemini' })).toEqual({ success: true, text: 'Hello' });
  });

  it('uses the normalised key, the default model and the generation limits', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult('Hello'));

    await generate({ provider: 'gemini', apiKey: ' AIza key ' }, { maxTokens: 50, temperature: 0.2 });

    expect(mocks.geminiKeys).toEqual(['AIzakey']);
    expect(mocks.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.2, maxOutputTokens: 50 },
    });
  });

  it('sends the system prompt and the user prompt as one text', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult('Hello'));

    await generate({ provider: 'gemini' });

    const prompt: string = mocks.generateContent.mock.calls[0][0];
    expect(prompt).toMatch(/Elementary[\s\S]*\n\nWrite a story$/);
  });

  it.each(['gemini-1.5-pro', 'gemini-3.0-flash'])('maps the retired alias %s to the default model', async (model) => {
    mocks.generateContent.mockResolvedValue(geminiResult('Hello'));
    await generate({ provider: 'gemini', model });
    expect(mocks.getGenerativeModel.mock.calls[0][0].model).toBe('gemini-2.5-flash');
  });

  it('keeps a supported model', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult('Hello'));
    await generate({ provider: 'gemini', model: 'gemini-2.5-flash-lite' });
    expect(mocks.getGenerativeModel.mock.calls[0][0].model).toBe('gemini-2.5-flash-lite');
  });

  it('reports an empty response', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult(''));
    expect(await generate({ provider: 'gemini' })).toEqual({ success: false, error: 'No text generated from Gemini' });
  });

  it('rejects a masked key without calling the SDK', async () => {
    const result = await generate({ provider: 'gemini', apiKey: '••••' });
    expect(result.error).toContain('Gemini API key appears masked');
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid key (400)', apiError(400, 'API key not valid. Please pass a valid API key.'), 'Invalid Gemini API key'],
    ['an unavailable model (404)', apiError(404), 'Selected Gemini model is unavailable'],
    ['an exhausted quota (429)', apiError(429, 'Resource has been exhausted (e.g. check quota).'), 'Gemini quota or billing limit reached'],
    ['a rate limit (429)', apiError(429, 'slow down'), 'Gemini rate limit exceeded'],
  ])('explains %s', async (_case, error, message) => {
    mocks.generateContent.mockRejectedValue(error);
    expect((await generate({ provider: 'gemini' })).error).toContain(message);
  });
});

describe('AIService generic error handling', () => {
  it.each([
    ['an invalid key message without status', 'Incorrect API key: invalid api key', 'Invalid OPENAI API key'],
    ['a quota message', 'billing hard limit reached', 'OPENAI quota or billing limit reached'],
    ['a rate limit message', 'Rate limit reached for requests', 'OPENAI rate limit exceeded'],
    ['a network failure', 'Connection error.', 'Network error connecting to OPENAI'],
    ['a timeout', 'Request timeout', 'Network error connecting to OPENAI'],
    ['a bad request', '400 Bad Request', 'Invalid request to OPENAI'],
    ['a server failure', '500 Internal Server Error', 'OPENAI service is temporarily unavailable'],
  ])('turns %s into a user-friendly message', async (_case, message, expected) => {
    mocks.create.mockRejectedValue(new Error(message));

    const result = await generate({ provider: 'openai' });

    expect(result.success).toBe(false);
    expect(result.error).toContain(expected);
  });

  it('returns other error messages unchanged', async () => {
    mocks.create.mockRejectedValue(new Error('Something odd'));
    expect(await generate({ provider: 'openai' })).toEqual({ success: false, error: 'Something odd' });
  });

  it('handles values that are not Error instances', async () => {
    mocks.create.mockRejectedValue('boom');
    expect(await generate({ provider: 'openai' })).toEqual({ success: false, error: 'Unknown AI service error' });
  });

  it('rejects an unsupported provider', async () => {
    expect(await generate({ provider: 'claude' as any })).toEqual({
      success: false,
      error: 'Unsupported AI provider: claude',
    });
  });
});

// #9: açar tam mətn generasiya etmədən, 1 tokenlik sorğu ilə yoxlanılır
const validateKey = (config: Partial<AIServiceConfig>) =>
  new AIService({ provider: 'openai', apiKey: 'sk-test', ...config } as AIServiceConfig).validateKey();

describe.each([
  { provider: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { provider: 'grok', name: 'Grok', defaultModel: 'grok-3-mini' },
  { provider: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-chat' },
  { provider: 'mistral', name: 'Mistral', defaultModel: 'mistral-small-latest' },
] as const)('AIService.validateKey with $provider (#9)', ({ provider, name, defaultModel }) => {
  it('sends a single request limited to 1 token at temperature 0', async () => {
    mocks.create.mockResolvedValue(completion('OK'));

    expect(await validateKey({ provider })).toEqual({ success: true });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ model: defaultModel, max_tokens: 1, temperature: 0 });
  });

  it('checks the selected model, not only the key', async () => {
    mocks.create.mockResolvedValue(completion('OK'));
    await validateKey({ provider, model: 'custom-model' });
    expect(mocks.create.mock.calls[0][0].model).toBe('custom-model');
  });

  it('accepts a key whose 1-token answer is empty (reasoning models)', async () => {
    mocks.create.mockResolvedValue(completion(null));
    expect(await validateKey({ provider })).toEqual({ success: true });
  });

  it('reports an invalid key (401)', async () => {
    mocks.create.mockRejectedValue(apiError(401));

    const result = await validateKey({ provider });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(new RegExp(`^Invalid ${name} API key`));
  });

  it('reports an exhausted quota (429)', async () => {
    mocks.create.mockRejectedValue(apiError(429, 'You exceeded your current quota'));
    expect((await validateKey({ provider })).error).toContain(`${name} quota or billing limit reached`);
  });

  it('rejects a masked key without sending a request', async () => {
    const result = await validateKey({ provider, apiKey: 'sk-••••' });

    expect(result.error).toContain(`${name} API key appears masked`);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('AIService.validateKey with gemini (#9)', () => {
  it('limits the output to 1 token at temperature 0', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult('OK'));

    expect(await validateKey({ provider: 'gemini' })).toEqual({ success: true });

    expect(mocks.getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0, maxOutputTokens: 1 },
    });
  });

  it('accepts a key whose 1-token answer is empty (thinking models)', async () => {
    mocks.generateContent.mockResolvedValue(geminiResult(''));
    expect(await validateKey({ provider: 'gemini' })).toEqual({ success: true });
  });

  it('reports an invalid key', async () => {
    mocks.generateContent.mockRejectedValue(apiError(400, 'API key not valid. Please pass a valid API key.'));
    expect((await validateKey({ provider: 'gemini' })).error).toContain('Invalid Gemini API key');
  });
});

describe('AIService.validateKey generic errors (#9)', () => {
  it('turns a network failure into a user-friendly message', async () => {
    mocks.create.mockRejectedValue(new Error('Connection error.'));
    expect(await validateKey({ provider: 'openai' })).toEqual({
      success: false,
      error: 'Network error connecting to OPENAI. Please check your internet connection.',
    });
  });

  it('rejects an unsupported provider', async () => {
    expect(await validateKey({ provider: 'claude' as any })).toEqual({
      success: false,
      error: 'Unsupported AI provider: claude',
    });
  });
});
