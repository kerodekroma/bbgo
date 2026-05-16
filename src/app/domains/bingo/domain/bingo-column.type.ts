export type BingoColumn = 'B' | 'I' | 'N' | 'G' | 'O';

export const COLUMN_RANGES: Record<BingoColumn, { min: number; max: number }> = {
  B: { min: 1, max: 15 },
  I: { min: 16, max: 30 },
  N: { min: 31, max: 45 },
  G: { min: 46, max: 60 },
  O: { min: 61, max: 75 },
} as const;

export const COLUMNS: readonly BingoColumn[] = ['B', 'I', 'N', 'G', 'O'] as const;

export function isNumberInColumn(n: number, column: BingoColumn): boolean {
  const range = COLUMN_RANGES[column];
  return n >= range.min && n <= range.max;
}

export function getColumnForNumber(n: number): BingoColumn | null {
  for (const col of COLUMNS) {
    if (isNumberInColumn(n, col)) return col;
  }
  return null;
}
