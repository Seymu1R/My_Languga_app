import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiContentService } from '../src/services/aiContentService';
import { PROFICIENCY_LEVELS } from '../src/schemas';

// AIService mock olunur: hər çağırışın config və parametrlərini yazırıq
const mocks = vi.hoisted(() => ({ configs: [] as any[], generateText: vi.fn(), validateKey: vi.fn() }));

vi.mock('../src/services/aiService', () => ({
  AIService: class {
    constructor(config: any) {
      mocks.configs.push(config);
    }
    generateText(params: any) {
      return mocks.generateText(params);
    }
    validateKey() {
      return mocks.validateKey();
    }
  },
}));

const config = { provider: 'openai' as const, apiToken: 'sk-test', model: 'gpt-4o' };
const lastParams = () => mocks.generateText.mock.calls.at(-1)![0];
const lastPrompt = (): string => lastParams().prompt;

const fetchMock = vi.fn();
const dictionaryApiResponse = (meanings: unknown[]) => ({ ok: true, json: async () => [{ meanings }] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configs.length = 0;
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateReadingText', () => {
  it('passes the user AI config to AIService', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'Story' });

    await aiContentService.generateReadingText(config, 'Elementary');

    expect(mocks.configs).toEqual([{ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' }]);
  });

  it('returns the AIService response unchanged', async () => {
    mocks.generateText.mockResolvedValue({ success: false, error: 'quota' });
    expect(await aiContentService.generateReadingText(config, 'Elementary')).toEqual({ success: false, error: 'quota' });
  });

  it.each([
    ['Elementary', 170, 190, 500],
    ['Pre-Intermediate', 210, 230, 600],
    ['Intermediate', 250, 270, 700],
    ['Upper-Intermediate', 310, 330, 880],
    ['Advanced', 420, 440, 1200],
  ] as const)('sizes a %s text to %i-%i words with %i tokens', async (level, min, max, maxTokens) => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'Story' });

    await aiContentService.generateReadingText(config, level);

    expect(lastParams()).toMatchObject({ level, maxTokens, temperature: 0.55 });
    expect(lastPrompt()).toContain(`between ${min} and ${max} words`);
    expect(lastPrompt()).toContain(`${level} English learners`);
  });

  it('covers every proficiency level', () => {
    expect(PROFICIENCY_LEVELS).toHaveLength(5);
  });

  it('builds the prompt around a trimmed custom task', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'Story' });

    await aiContentService.generateReadingText(config, 'Advanced', '  A story about space  ');

    expect(lastPrompt()).toMatch(/^Task: A story about space\n/);
    expect(lastPrompt()).toContain('Audience: Advanced English learner.');
  });

  it('ignores a whitespace-only custom prompt', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'Story' });

    await aiContentService.generateReadingText(config, 'Advanced', '   ');

    expect(lastPrompt()).toMatch(/^Write one original reading passage/);
  });
});

describe('translateWord', () => {
  const translate = (contextSentence?: string) =>
    aiContentService.translateWord(config, { word: 'bank', targetLanguage: 'Azerbaijani', contextSentence });

  it('uses a short, low-temperature request', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'bank' });
    await translate();
    expect(lastParams()).toMatchObject({ maxTokens: 24, temperature: 0.1 });
  });

  it('looks the word up in the Free Dictionary API with an encoded URL', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'x' });

    await aiContentService.translateWord(config, { word: 'ice cream', targetLanguage: 'Azerbaijani' });

    expect(fetchMock).toHaveBeenCalledWith('https://api.dictionaryapi.dev/api/v2/entries/en/ice%20cream');
  });

  describe('prompt layers', () => {
    const meanings = [
      { partOfSpeech: 'noun', definitions: [{ definition: 'A financial institution.' }, { definition: 'The land beside a river.' }] },
      { partOfSpeech: 'verb', definitions: [{ definition: 'To deposit money.' }, { definition: 'To tilt an aircraft.' }] },
    ];

    it('context + dictionary definitions: asks for the meaning used in the sentence', async () => {
      fetchMock.mockResolvedValue(dictionaryApiResponse(meanings));
      mocks.generateText.mockResolvedValue({ success: true, text: 'sahil' });

      await translate('We sat on the river bank.');

      const prompt = lastPrompt();
      expect(prompt).toContain('Sentence: "We sat on the river bank."');
      expect(prompt).toContain('1. (noun) A financial institution.');
      expect(prompt).toContain('3. (verb) To deposit money.');
      expect(prompt).toContain('Using the definition that matches the sentence');
    });

    it('uses at most three definitions', async () => {
      fetchMock.mockResolvedValue(dictionaryApiResponse(meanings));
      mocks.generateText.mockResolvedValue({ success: true, text: 'x' });

      await translate('We sat on the river bank.');

      expect(lastPrompt()).not.toContain('To tilt an aircraft.');
    });

    it('dictionary definitions without context: asks for the most common translation', async () => {
      fetchMock.mockResolvedValue(dictionaryApiResponse(meanings));
      mocks.generateText.mockResolvedValue({ success: true, text: 'bank' });

      await translate();

      expect(lastPrompt()).toMatch(/^Translate the English word "bank" to Azerbaijani\.\nEnglish dictionary definitions:/);
      expect(lastPrompt()).toContain('most common translation');
    });

    it('context without dictionary data: translates from the sentence alone', async () => {
      mocks.generateText.mockResolvedValue({ success: true, text: 'sahil' });

      await translate('We sat on the river bank.');

      expect(lastPrompt()).toBe(
        [
          'Translate the English word "bank" to Azerbaijani based on its meaning in this sentence.',
          'Sentence: "We sat on the river bank."',
          'Return only the translated word or very short phrase (max 3 words), no explanation.',
        ].join('\n'),
      );
    });

    it('no context and no dictionary data: plain translation', async () => {
      mocks.generateText.mockResolvedValue({ success: true, text: 'bank' });

      await translate();

      expect(lastPrompt()).toBe('Translate "bank" from English to Azerbaijani. Return only the translation, no explanation.');
    });

    it('treats a whitespace-only context as no context', async () => {
      mocks.generateText.mockResolvedValue({ success: true, text: 'bank' });
      await translate('   ');
      expect(lastPrompt()).toMatch(/^Translate "bank" from English/);
    });

    it('continues without definitions when the dictionary request throws', async () => {
      fetchMock.mockRejectedValue(new Error('ENOTFOUND'));
      mocks.generateText.mockResolvedValue({ success: true, text: 'bank' });

      expect(await translate()).toEqual({ success: true, translation: 'bank' });
    });
  });

  it.each([
    ['surrounding quotes', '"sahil"', 'sahil'],
    ['single quotes and spaces', "  'sahil'  ", 'sahil'],
    ['a trailing full stop', 'sahil.', 'sahil'],
    ['trailing ! and ?', 'sahil!?', 'sahil'],
    ['an ideographic full stop', '銀行。', '銀行'],
    ['extra lines', 'sahil\nExplanation: river side', 'sahil'],
  ])('cleans %s from the AI answer', async (_case, raw, expected) => {
    mocks.generateText.mockResolvedValue({ success: true, text: raw });
    expect(await translate()).toEqual({ success: true, translation: expected });
  });

  it('reports an AI failure with the word', async () => {
    mocks.generateText.mockResolvedValue({ success: false, error: 'Invalid key' });
    expect(await translate()).toEqual({ success: false, error: 'Unable to translate "bank". Invalid key' });
  });

  it('reports an unexpected exception', async () => {
    mocks.generateText.mockRejectedValue(new Error('boom'));
    expect(await translate()).toEqual({ success: false, error: 'Translation error: boom' });
  });
});

describe('getPronunciation', () => {
  it('asks for IPA and returns the trimmed answer', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: '  /əˈpɑːrt/ \n' });

    expect(await aiContentService.getPronunciation(config, 'apart')).toEqual({
      success: true,
      pronunciation: '/əˈpɑːrt/',
    });
    expect(lastPrompt()).toBe('Give IPA for "apart". Return only one value in /slashes/.');
    expect(lastParams()).toMatchObject({ maxTokens: 24, temperature: 0.1 });
  });

  it('reports an AI failure', async () => {
    mocks.generateText.mockResolvedValue({ success: false, error: 'quota' });
    expect(await aiContentService.getPronunciation(config, 'apart')).toEqual({
      success: false,
      error: 'Unable to get pronunciation for "apart". quota',
    });
  });

  it('reports an unexpected exception', async () => {
    mocks.generateText.mockRejectedValue(new Error('boom'));
    expect(await aiContentService.getPronunciation(config, 'apart')).toEqual({
      success: false,
      error: 'Pronunciation error: boom',
    });
  });
});

describe('generateExampleSentences', () => {
  it('asks for three sentences at the given level', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'The bank is open.' });

    await aiContentService.generateExampleSentences(config, 'bank', 'Advanced');

    expect(lastPrompt()).toContain('Write exactly 3 short natural sentences using "bank".');
    expect(lastPrompt()).toContain('Level: Advanced.');
    expect(lastParams()).toMatchObject({ level: 'Advanced', maxTokens: 110, temperature: 0.35 });
  });

  it('defaults to Intermediate', async () => {
    mocks.generateText.mockResolvedValue({ success: true, text: 'The bank is open.' });
    await aiContentService.generateExampleSentences(config, 'bank');
    expect(lastParams().level).toBe('Intermediate');
  });

  it('keeps up to three lines that contain the word, case-insensitively', async () => {
    mocks.generateText.mockResolvedValue({
      success: true,
      text: 'Here are sentences:\nThe Bank opens at nine.\n\nI went to the bank.\nThe bank was closed.\nBanks lend money.',
    });

    expect(await aiContentService.generateExampleSentences(config, 'bank')).toEqual({
      success: true,
      sentences: ['The Bank opens at nine.', 'I went to the bank.', 'The bank was closed.'],
    });
  });

  it('falls back to cleaned lines when no line contains the word', async () => {
    mocks.generateText.mockResolvedValue({
      success: true,
      text: '1. She deposited money there.\n2) It closes early.\nok\n3- They lend money.\n4. Extra line.',
    });

    expect(await aiContentService.generateExampleSentences(config, 'bank')).toEqual({
      success: true,
      sentences: ['She deposited money there.', 'It closes early.', 'They lend money.'],
    });
  });

  it('reports an AI failure', async () => {
    mocks.generateText.mockResolvedValue({ success: false, error: 'quota' });
    expect(await aiContentService.generateExampleSentences(config, 'bank')).toEqual({
      success: false,
      error: 'Unable to generate example sentences for "bank". quota',
    });
  });

  it('reports an unexpected exception', async () => {
    mocks.generateText.mockRejectedValue(new Error('boom'));
    expect(await aiContentService.generateExampleSentences(config, 'bank')).toEqual({
      success: false,
      error: 'Example sentences error: boom',
    });
  });
});

describe('validateKey (#9)', () => {
  it('checks the key with the user AI config and returns the result unchanged', async () => {
    mocks.validateKey.mockResolvedValue({ success: false, error: 'Invalid key' });

    expect(await aiContentService.validateKey(config)).toEqual({ success: false, error: 'Invalid key' });

    expect(mocks.configs).toEqual([{ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' }]);
  });

  it('does not generate any text', async () => {
    mocks.validateKey.mockResolvedValue({ success: true });

    expect(await aiContentService.validateKey(config)).toEqual({ success: true });

    expect(mocks.generateText).not.toHaveBeenCalled();
  });
});
