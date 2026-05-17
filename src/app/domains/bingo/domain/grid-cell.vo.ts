import type { BingoColumn } from './bingo-column.type';
import type { BingoNumber } from './bingo-number.vo';

export interface GridCell {
  readonly row: number;
  readonly col: number;
  readonly number: BingoNumber | null;
  readonly isMarked: boolean;
  readonly isFree: boolean;
  readonly isWinningCell: boolean;
}

export function createGridCell(
  row: number,
  col: number,
  number: BingoNumber | null,
  isFree: boolean = false,
): GridCell {
  return {
    row,
    col,
    number,
    isMarked: false, // FREE cell starts unmarked — manually toggleable
    isFree,
    isWinningCell: false,
  };
}

export function markCell(cell: GridCell): GridCell {
  return { ...cell, isMarked: true };
}

export function unmarkCell(cell: GridCell): GridCell {
  return { ...cell, isMarked: false };
}

export function setCellWinning(cell: GridCell, winning: boolean): GridCell {
  return { ...cell, isWinningCell: winning };
}

/** Create a 5×5 grid of cells with per-column number validation (for manual entry) */
export function createCellGrid(
  numbers: (number | null)[][],
): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const num = numbers[row]?.[col];
      const isFree = row === 2 && col === 2;
      // Numbers are pre-validated in the form, so we store raw values
      cells.push(createGridCell(row, col, num !== null && num !== undefined ? { value: num, column: 'B' as BingoColumn } : null, isFree));
    }
  }
  return cells;
}
