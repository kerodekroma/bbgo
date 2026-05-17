import { describe, it, expect } from 'vitest';
import { createGridCell, markCell, unmarkCell, setCellWinning, createCellGrid } from '../grid-cell.vo';

describe('GridCell', () => {
  it('creates a regular cell unmarked', () => {
    const cell = createGridCell(0, 0, { value: 5, column: 'B' }, false);
    expect(cell.row).toBe(0);
    expect(cell.col).toBe(0);
    expect(cell.isMarked).toBe(false);
    expect(cell.isFree).toBe(false);
    expect(cell.isWinningCell).toBe(false);
    expect(cell.number?.value).toBe(5);
  });

  it('creates FREE cell unmarked (manually toggleable)', () => {
    const cell = createGridCell(2, 2, null, true);
    expect(cell.isFree).toBe(true);
    expect(cell.isMarked).toBe(false);
    expect(cell.number).toBeNull();
  });

  describe('markCell', () => {
    it('returns new cell with isMarked=true (immutability)', () => {
      const cell = createGridCell(1, 1, { value: 10, column: 'B' }, false);
      const marked = markCell(cell);
      expect(cell.isMarked).toBe(false); // original unchanged
      expect(marked.isMarked).toBe(true);
      expect(marked).not.toBe(cell); // new reference
    });

    it('marks FREE cell (no longer a no-op)', () => {
      const free = createGridCell(2, 2, null, true);
      const marked = markCell(free);
      expect(marked.isMarked).toBe(true);
      expect(marked).not.toBe(free);
    });
  });

  describe('unmarkCell', () => {
    it('returns new cell with isMarked=false', () => {
      const cell = createGridCell(1, 1, { value: 10, column: 'B' }, false);
      const marked = markCell(cell);
      const unmarked = unmarkCell(marked);
      expect(unmarked.isMarked).toBe(false);
      expect(unmarked).not.toBe(marked);
    });

    it('unmarks FREE cell (no longer a no-op)', () => {
      const free = createGridCell(2, 2, null, true);
      const unmarked = unmarkCell(free);
      expect(unmarked.isMarked).toBe(false);
      expect(unmarked).not.toBe(free);
    });
  });

  describe('setCellWinning', () => {
    it('marks a cell as winning', () => {
      const cell = createGridCell(0, 0, { value: 1, column: 'B' }, false);
      const winning = setCellWinning(cell, true);
      expect(winning.isWinningCell).toBe(true);
      expect(cell.isWinningCell).toBe(false);
    });
  });

  describe('createCellGrid', () => {
    it('creates 5x5 grid with FREE center unmarked', () => {
      const numbers = Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          if (row === 2 && col === 2) return null;
          return row * 5 + col + 1;
        }),
      );
      const cells = createCellGrid(numbers.map(r => r.map(n => n)));
      expect(cells).toHaveLength(25);
      const freeCell = cells.find(c => c.row === 2 && c.col === 2);
      expect(freeCell?.isFree).toBe(true);
      expect(freeCell?.isMarked).toBe(false);
    });
  });
});
