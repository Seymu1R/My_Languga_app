import { describe, it, expect, afterEach } from 'vitest';
import { getStorageMode, setStorageMode } from '../src/config/storage';

describe('storage mode', () => {
  afterEach(() => setStorageMode('in-memory'));

  it('starts in in-memory mode', () => {
    expect(getStorageMode()).toBe('in-memory');
  });

  it('can be switched to mongodb', () => {
    setStorageMode('mongodb');
    expect(getStorageMode()).toBe('mongodb');
  });
});
