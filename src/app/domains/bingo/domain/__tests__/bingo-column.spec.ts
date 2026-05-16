import { describe, it, expect } from 'vitest';
import { isNumberInColumn, getColumnForNumber, COLUMN_RANGES } from '../bingo-column.type';

describe('BingoColumn', () => {
  describe('isNumberInColumn', () => {
    it('returns true for numbers within column range', () => {
      expect(isNumberInColumn(1, 'B')).toBe(true);
      expect(isNumberInColumn(15, 'B')).toBe(true);
      expect(isNumberInColumn(16, 'I')).toBe(true);
      expect(isNumberInColumn(30, 'I')).toBe(true);
      expect(isNumberInColumn(31, 'N')).toBe(true);
      expect(isNumberInColumn(45, 'N')).toBe(true);
      expect(isNumberInColumn(46, 'G')).toBe(true);
      expect(isNumberInColumn(60, 'G')).toBe(true);
      expect(isNumberInColumn(61, 'O')).toBe(true);
      expect(isNumberInColumn(75, 'O')).toBe(true);
    });

    it('returns false for numbers outside column range', () => {
      expect(isNumberInColumn(0, 'B')).toBe(false);
      expect(isNumberInColumn(16, 'B')).toBe(false);
      expect(isNumberInColumn(15, 'I')).toBe(false);
      expect(isNumberInColumn(31, 'I')).toBe(false);
    });
  });

  describe('getColumnForNumber', () => {
    it('returns correct column for each range', () => {
      expect(getColumnForNumber(1)).toBe('B');
      expect(getColumnForNumber(20)).toBe('I');
      expect(getColumnForNumber(40)).toBe('N');
      expect(getColumnForNumber(55)).toBe('G');
      expect(getColumnForNumber(70)).toBe('O');
    });

    it('returns null for out-of-range numbers', () => {
      expect(getColumnForNumber(0)).toBeNull();
      expect(getColumnForNumber(76)).toBeNull();
      expect(getColumnForNumber(-5)).toBeNull();
    });
  });

  describe('COLUMN_RANGES', () => {
    it('defines correct ranges', () => {
      expect(COLUMN_RANGES.B).toEqual({ min: 1, max: 15 });
      expect(COLUMN_RANGES.I).toEqual({ min: 16, max: 30 });
      expect(COLUMN_RANGES.N).toEqual({ min: 31, max: 45 });
      expect(COLUMN_RANGES.G).toEqual({ min: 46, max: 60 });
      expect(COLUMN_RANGES.O).toEqual({ min: 61, max: 75 });
    });
  });
});
