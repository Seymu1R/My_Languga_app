import { describe, it, expect } from 'vitest';
import { Writable } from 'stream';
import pino from 'pino';
import { loggerOptions } from '../src/utils/logger';

// loggerOptions ilə (redaction daxil) yaddaşdakı stream-ə yazan logger
const capture = () => {
  const lines: any[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  return { log: pino({ ...loggerOptions, level: 'info' }, stream), lines };
};

describe('logger redaction', () => {
  it.each(['apiToken', 'aiToken', 'apiKey'])('masks a top-level %s', (field) => {
    const { log, lines } = capture();
    log.info({ [field]: 'sk-secret', word: 'apple' }, 'request');

    expect(lines[0][field]).toBe('[REDACTED]');
    expect(lines[0].word).toBe('apple');
  });

  it.each(['apiToken', 'aiToken', 'apiKey'])('masks %s one level deep', (field) => {
    const { log, lines } = capture();
    log.info({ body: { [field]: 'sk-secret', provider: 'openai' } }, 'request');

    expect(lines[0].body[field]).toBe('[REDACTED]');
    expect(lines[0].body.provider).toBe('openai');
  });

  it('never writes the secret value anywhere in the line', () => {
    const { log, lines } = capture();
    log.info({ apiToken: 'sk-top', config: { apiKey: 'sk-nested' } }, 'request');

    const raw = JSON.stringify(lines[0]);
    expect(raw).not.toContain('sk-top');
    expect(raw).not.toContain('sk-nested');
  });

  it('uses LOG_LEVEL for the level', () => {
    expect(loggerOptions.level).toBe('silent'); // tests/setup.ts
  });
});
