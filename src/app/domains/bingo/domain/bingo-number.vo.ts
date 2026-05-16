import type { BingoColumn } from './bingo-column.type';
import { isNumberInColumn } from './bingo-column.type';

export interface BingoNumber {
  readonly value: number;
  readonly column: BingoColumn;
}

export type BingoNumberError = { kind: 'out-of-range'; value: number; column: BingoColumn }
  | { kind: 'invalid-value'; message: string };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function createBingoNumber(value: number, column: BingoColumn): Result<BingoNumber, BingoNumberError> {
  if (!Number.isInteger(value) || value < 1 || value > 75) {
    return { ok: false, error: { kind: 'invalid-value', message: `Value must be an integer between 1 and 75, got ${value}` } };
  }
  if (!isNumberInColumn(value, column)) {
    return { ok: false, error: { kind: 'out-of-range', value, column } };
  }
  return { ok: true, value: { value, column } };
}
