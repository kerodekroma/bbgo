import { describe, it, expect } from 'vitest';
import { createBingoNumber } from '../bingo-number.vo';

describe('BingoNumber', () => {
  it('creates a valid B-number', () => {
    const result = createBingoNumber(7, 'B');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe(7);
      expect(result.value.column).toBe('B');
    }
  });

  it('creates a valid O-number', () => {
    const result = createBingoNumber(75, 'O');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe(75);
      expect(result.value.column).toBe('O');
    }
  });

  it('rejects number out of column range', () => {
    const result = createBingoNumber(20, 'B');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('out-of-range');
    }
  });

  it('rejects number too low', () => {
    const result = createBingoNumber(0, 'B');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-value');
    }
  });

  it('rejects number too high', () => {
    const result = createBingoNumber(76, 'O');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-value');
    }
  });

  it('rejects non-integer values', () => {
    const result = createBingoNumber(3.5, 'B');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-value');
    }
  });
});
