import { describe, it, expect } from 'vitest';
import { Word } from '../src/models/Word';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Word model', () => {
  it('fills defaults: UUID id, learning status, 7-day interval, no review date', () => {
    const word = new Word({ english: 'apple', translation: 'alma' });

    expect(word._id).toMatch(UUID_PATTERN);
    expect(word.status).toBe('learning');
    expect(word.nextReviewDate).toBeNull();
    expect(word.reviewIntervalDays).toBe(7);
    expect(word.dateAdded).toBeInstanceOf(Date);
  });

  it('generates a different id for each word', () => {
    const a = new Word({ english: 'a', translation: 'a' });
    const b = new Word({ english: 'b', translation: 'b' });
    expect(a._id).not.toBe(b._id);
  });

  it('trims string fields', () => {
    const word = new Word({
      english: '  apple ',
      translation: ' alma ',
      pronunciation: ' /ˈæp.əl/ ',
      referenceSentence: ' An apple. ',
      imageUrl: ' /uploads/a.png ',
    });

    expect(word.english).toBe('apple');
    expect(word.translation).toBe('alma');
    expect(word.pronunciation).toBe('/ˈæp.əl/');
    expect(word.referenceSentence).toBe('An apple.');
    expect(word.imageUrl).toBe('/uploads/a.png');
  });

  it('serialises _id as id and hides _id and __v', () => {
    const json = new Word({ english: 'apple', translation: 'alma' }).toJSON() as any;

    expect(json.id).toMatch(UUID_PATTERN);
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('requires english and translation', () => {
    const errors = new Word({}).validateSync()?.errors ?? {};
    expect(Object.keys(errors).sort()).toEqual(['english', 'translation']);
  });

  it('rejects an unknown status', () => {
    const error = new Word({ english: 'a', translation: 'b', status: 'mastered' }).validateSync();
    expect(error?.errors.status).toBeDefined();
  });

  it('rejects a review interval below 1 day', () => {
    const error = new Word({ english: 'a', translation: 'b', reviewIntervalDays: 0 }).validateSync();
    expect(error?.errors.reviewIntervalDays).toBeDefined();
  });

  it('declares the lookup and learning-queue indexes', () => {
    const indexes = Word.schema.indexes().map(([fields]) => fields);
    expect(indexes).toContainEqual({ english: 1 });
    expect(indexes).toContainEqual({ status: 1, nextReviewDate: 1 });
  });
});
