import { describe, it, expect } from 'vitest';
import {
  generateTextSchema,
  translateWordSchema,
  pronunciationSchema,
  exampleSentencesSchema,
  addWordSchema,
  learningStatusSchema,
  PROFICIENCY_LEVELS,
} from '../src/schemas';

const PROVIDERS = ['openai', 'grok', 'gemini', 'deepseek', 'mistral'];

describe('generateTextSchema', () => {
  const valid = { level: 'Intermediate', apiToken: 'sk-1', provider: 'openai' };

  it('accepts every proficiency level and provider', () => {
    for (const level of PROFICIENCY_LEVELS) {
      for (const provider of PROVIDERS) {
        expect(generateTextSchema.safeParse({ ...valid, level, provider }).success).toBe(true);
      }
    }
  });

  it('accepts optional model and customPrompt', () => {
    const result = generateTextSchema.safeParse({ ...valid, model: 'gpt-4o', customPrompt: 'About cats' });
    expect(result.success).toBe(true);
  });

  it.each([
    ['unknown level', { level: 'Beginner' }],
    ['empty apiToken', { apiToken: '' }],
    ['unknown provider', { provider: 'claude' }],
    ['customPrompt over 2000 chars', { customPrompt: 'x'.repeat(2001) }],
  ])('rejects %s', (_name, override) => {
    expect(generateTextSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('rejects a missing apiToken', () => {
    const { apiToken: _omit, ...body } = valid;
    expect(generateTextSchema.safeParse(body).success).toBe(false);
  });
});

describe('translateWordSchema', () => {
  const valid = { word: 'apple', targetLanguage: 'Azərbaycan dili', languageCode: 'az' };

  it('accepts the minimal body (token and provider are optional in the schema)', () => {
    expect(translateWordSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const body = { ...valid, contextSentence: 'I ate an apple.', aiToken: 't', provider: 'gemini', model: 'm' };
    expect(translateWordSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['empty word', { word: '' }],
    ['word over 200 chars', { word: 'x'.repeat(201) }],
    ['empty targetLanguage', { targetLanguage: '' }],
    ['languageCode shorter than 2', { languageCode: 'a' }],
    ['languageCode longer than 10', { languageCode: 'x'.repeat(11) }],
    ['contextSentence over 1000 chars', { contextSentence: 'x'.repeat(1001) }],
    ['unknown provider', { provider: 'cohere' }],
  ])('rejects %s', (_name, override) => {
    expect(translateWordSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe.each([
  ['pronunciationSchema', pronunciationSchema],
  ['exampleSentencesSchema', exampleSentencesSchema],
])('%s', (_name, schema) => {
  it('accepts a word with optional AI fields', () => {
    expect(schema.safeParse({ word: 'apple' }).success).toBe(true);
    expect(schema.safeParse({ word: 'apple', aiToken: 't', provider: 'grok', model: 'm' }).success).toBe(true);
  });

  it.each([
    ['empty word', { word: '' }],
    ['word over 200 chars', { word: 'x'.repeat(201) }],
    ['unknown provider', { word: 'apple', provider: 'llama' }],
  ])('rejects %s', (_case, body) => {
    expect(schema.safeParse(body).success).toBe(false);
  });
});

// #28: AI endpoint-lərinin `word` sahəsi də boşluqları uzunluq yoxlamasından əvvəl silməlidir
describe.each([
  ['translateWordSchema', translateWordSchema, { targetLanguage: 'Azerbaijani', languageCode: 'az' }],
  ['pronunciationSchema', pronunciationSchema, {}],
  ['exampleSentencesSchema', exampleSentencesSchema, {}],
] as const)('%s word (#28)', (_name, schema, rest) => {
  it.each(['   ', '\t\n '])('rejects a whitespace-only word %j', (word) => {
    const result = schema.safeParse({ ...rest, word });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('word is required');
  });

  it('trims the word', () => {
    expect(schema.parse({ ...rest, word: '  bank \n' }).word).toBe('bank');
  });

  it('applies the length limit to the trimmed word', () => {
    expect(schema.safeParse({ ...rest, word: `  ${'x'.repeat(200)}  ` }).success).toBe(true);
  });
});

describe('addWordSchema', () => {
  const valid = { english: 'apple', translation: 'alma' };

  it('trims english and translation', () => {
    const result = addWordSchema.parse({ english: '  apple ', translation: ' alma  ' });
    expect(result).toMatchObject({ english: 'apple', translation: 'alma' });
  });

  it('strips unknown fields such as status (no mass assignment)', () => {
    const result = addWordSchema.parse({ ...valid, status: 'known', reviewIntervalDays: 30 });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('reviewIntervalDays');
  });

  it.each([
    ['empty english', { english: '' }],
    ['english over 300 chars', { english: 'x'.repeat(301) }],
    ['empty translation', { translation: '' }],
    ['translation over 500 chars', { translation: 'x'.repeat(501) }],
    ['pronunciation over 200 chars', { pronunciation: 'x'.repeat(201) }],
    ['referenceSentence over 1000 chars', { referenceSentence: 'x'.repeat(1001) }],
  ])('rejects %s', (_name, override) => {
    expect(addWordSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  // #27: boşluqlar uzunluq yoxlamasından ƏVVƏL silinməlidir
  it.each([
    ['english', { english: '   ', translation: 'alma' }],
    ['english with tabs and newlines', { english: '\t\n ', translation: 'alma' }],
    ['translation', { english: 'apple', translation: '   ' }],
  ])('rejects whitespace-only %s (#27)', (_name, body) => {
    const result = addWordSchema.safeParse(body);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/is required$/);
  });

  it('applies the length limit to the trimmed value (#27)', () => {
    const padded = `  ${'x'.repeat(300)}  `;
    expect(addWordSchema.safeParse({ english: padded, translation: 'alma' }).success).toBe(true);
  });

  describe('imageUrl', () => {
    it.each([
      '/uploads/1773770091190-854503861.jpg',
      '/uploads/a.png',
      '/uploads/file_name-1.webp',
    ])('accepts %s', (imageUrl) => {
      expect(addWordSchema.safeParse({ ...valid, imageUrl }).success).toBe(true);
    });

    it.each([
      '/uploads/../../../../tmp/x',
      '/uploads/..',
      '/uploads/.hidden',
      '/uploads/a/b.jpg',
      '/uploads/',
      'uploads/a.jpg',
      'http://evil.com/x.jpg',
      '/uploads/a.jp g',
      '/etc/passwd',
    ])('rejects %s', (imageUrl) => {
      expect(addWordSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
    });
  });
});

describe('learningStatusSchema', () => {
  it.each([true, false])('accepts known=%s', (known) => {
    expect(learningStatusSchema.parse({ known })).toEqual({ known });
  });

  it.each([['string', { known: 'true' }], ['number', { known: 1 }], ['missing', {}]])(
    'rejects %s',
    (_name, body) => {
      expect(learningStatusSchema.safeParse(body).success).toBe(false);
    },
  );
});
