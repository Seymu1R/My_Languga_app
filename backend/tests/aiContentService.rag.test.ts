import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { aiContentService } from '../src/services/aiContentService';
import { dictionaryService } from '../src/services/dictionaryService';
import { startMongo, stopMongo, clearMongo } from './helpers/mongo';

// RAG layer 1: istifadəçinin MongoDB-dəki əvvəlki tərcümələri
const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));

vi.mock('../src/services/aiService', () => ({
  AIService: class {
    generateText(params: any) {
      return mocks.generateText(params);
    }
  },
}));

const config = { provider: 'openai' as const, apiToken: 'sk-test' };
const fetchMock = vi.fn();
const lastPrompt = (): string => mocks.generateText.mock.calls.at(-1)![0].prompt;

const translate = (word: string, contextSentence?: string) =>
  aiContentService.translateWord(config, { word, targetLanguage: 'Azerbaijani', contextSentence });

describe('translateWord with saved translations (MongoDB)', () => {
  beforeAll(startMongo);
  afterAll(stopMongo);

  beforeEach(async () => {
    await clearMongo();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    mocks.generateText.mockResolvedValue({ success: true, text: 'sahil' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers the student's saved translations and skips the dictionary API", async () => {
    await dictionaryService.addWord({ english: 'Bank', translation: 'bank' });

    await translate('bank', 'We sat on the river bank.');

    expect(lastPrompt()).toContain("Known Azerbaijani translations from the student's dictionary: 1. bank.");
    expect(lastPrompt()).toContain('Select the translation that matches');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('matches the saved word case-insensitively and as a whole word only', async () => {
    await dictionaryService.addWord({ english: 'BANK', translation: 'bank' });
    await dictionaryService.addWord({ english: 'banker', translation: 'bankir' });

    await translate('bank', 'I went to the bank.');

    expect(lastPrompt()).toContain(': 1. bank.');
    expect(lastPrompt()).not.toContain('bankir');
  });

  it('escapes regex characters in the clicked word', async () => {
    await dictionaryService.addWord({ english: 'abc', translation: 'wrong' });

    await translate('a.c', 'Is a.c valid?');

    expect(lastPrompt()).not.toContain('wrong');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('falls back to the dictionary API when nothing is saved', async () => {
    await translate('bank', 'I went to the bank.');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  // Mövcud davranış: kontekst yoxdursa saxlanmış tərcümələr promptda istifadə olunmur,
  // lakin onlar tapıldığı üçün lüğət API-si də çağırılmır
  it('without context, ignores saved translations and does not call the dictionary API', async () => {
    await dictionaryService.addWord({ english: 'bank', translation: 'bank' });

    await translate('bank');

    expect(lastPrompt()).toBe('Translate "bank" from English to Azerbaijani. Return only the translation, no explanation.');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
