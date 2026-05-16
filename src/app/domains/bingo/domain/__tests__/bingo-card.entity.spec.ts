import { describe, it, expect } from 'vitest';
import { BingoCard } from '../bingo-card.entity';
import { createCardId } from '../card-id.vo';

/** Build a 5×5 grid of numbers that respects column ranges */
function makeGrid(
  overrides?: Partial<Record<`${number}-${number}`, number>>,
): number[][] {
  const colRanges = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 },  // O
  ];

  const grid: number[][] = [];
  const used = new Set<number>();

  for (let row = 0; row < 5; row++) {
    const rowNumbers: number[] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        rowNumbers.push(0); // FREE placeholder
        continue;
      }
      const override = overrides?.[`${row}-${col}`];
      if (override !== undefined) {
        rowNumbers.push(override);
        used.add(override);
        continue;
      }
      const range = colRanges[col]!;
      let n: number;
      do {
        n = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
      } while (used.has(n));
      used.add(n);
      rowNumbers.push(n);
    }
    grid.push(rowNumbers);
  }
  return grid;
}

/** Helper: create a valid bingo card for testing */
function createTestCard(grid?: number[][]): BingoCard {
  const g = grid ?? makeGrid();
  const result = BingoCard.create(createCardId('test-1'), 'Test Card', g);
  if (!result.ok) throw new Error(`Failed to create test card: ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('BingoCard', () => {
  describe('create', () => {
    it('creates a valid card from a 5×5 grid', () => {
      const card = createTestCard();
      expect(card.id).toBeDefined();
      expect(card.code).toBe('Test Card');
      expect(card.grid).toHaveLength(25);
    });

    it('rejects grid with wrong dimensions', () => {
      const result = BingoCard.create(createCardId('bad'), 'Bad', [[1, 2, 3]]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('invalid-grid');
    });

    it('rejects grid with numbers in wrong column', () => {
      const grid = makeGrid();
      grid[0]![0] = 75; // 75 in column B (should be 1-15)
      const result = BingoCard.create(createCardId('bad'), 'Bad', grid);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('invalid-grid');
    });

    it('rejects grid with duplicate numbers', () => {
      const grid = makeGrid();
      grid[1]![0] = grid[3]![0]!; // same number in two B cells
      const result = BingoCard.create(createCardId('bad'), 'Bad', grid);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('invalid-grid');
    });

    it('FREE cell at center is always marked', () => {
      const card = createTestCard();
      const freeCell = card.getCell(2, 2);
      expect(freeCell?.isFree).toBe(true);
      expect(freeCell?.isMarked).toBe(true);
    });
  });

  describe('markNumber', () => {
    it('marks the cell containing the called number', () => {
      const grid = makeGrid();
      const targetNumber = grid[0]![0]!; // top-left B cell
      const card = createTestCard(grid);
      const result = card.markNumber(targetNumber);
      expect(result.ok).toBe(true);
      const cell = card.getCell(0, 0);
      expect(cell?.isMarked).toBe(true);
    });

    it('returns error if number not on card', () => {
      const card = createTestCard();
      const result = card.markNumber(999);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('number-not-found');
    });

    it('does not double-mark an already marked cell', () => {
      const grid = makeGrid();
      const target = grid[0]![0]!;
      const card = createTestCard(grid);
      card.markNumber(target);
      const result = card.markNumber(target);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.isMarked).toBe(true);
    });

    it('marks FREE cell — no-op (already marked)', () => {
      const card = createTestCard();
      const freeCell = card.getCell(2, 2);
      expect(freeCell?.isMarked).toBe(true);
    });
  });

  describe('voidNumber', () => {
    it('unmarks a previously marked cell', () => {
      const grid = makeGrid();
      const card = createTestCard(grid);
      const targetNumber = grid[0]![0]!;
      card.markNumber(targetNumber);
      expect(card.getCell(0, 0)?.isMarked).toBe(true);

      card.voidNumber(targetNumber);
      expect(card.getCell(0, 0)?.isMarked).toBe(false);
    });

    it('returns error for number not found on card', () => {
      const card = createTestCard();
      const result = card.voidNumber(999);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('number-not-found');
      }
    });

    it('returns ok for an already-unmarked cell (no-op)', () => {
      const grid = makeGrid();
      const card = createTestCard(grid);
      const targetNumber = grid[0]![0]!;
      // Number exists on card but is not marked
      const result = card.voidNumber(targetNumber);
      expect(result.ok).toBe(true);
    });

    it('does not affect the FREE cell', () => {
      const card = createTestCard();
      card.voidNumber(999); // doesn't exist
      const freeCell = card.getCell(2, 2);
      expect(freeCell?.isMarked).toBe(true);
    });
  });

  describe('toggleCell (card-only mode)', () => {
    it('toggles a cell from unmarked to marked', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      expect(card.getCell(0, 0)?.isMarked).toBe(true);
    });

    it('toggles a cell from marked to unmarked', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      card.toggleCell(0, 0);
      expect(card.getCell(0, 0)?.isMarked).toBe(false);
    });

    it('does not toggle FREE cell', () => {
      const card = createTestCard();
      const result = card.toggleCell(2, 2);
      expect(result.ok).toBe(true);
      expect(card.getCell(2, 2)?.isMarked).toBe(true);
    });

    it('returns error for invalid cell coordinates', () => {
      const card = createTestCard();
      const result = card.toggleCell(9, 9);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('invalid-cell');
    });
  });

  describe('win detection — single lines', () => {
    it('detects a horizontal row win', () => {
      const card = createTestCard();
      // Mark all 5 cells in row 0
      for (let col = 0; col < 5; col++) {
        card.toggleCell(0, col);
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'single-line' && p.description.includes('Row 1'))).toBe(true);
    });

    it('detects a vertical column win', () => {
      const card = createTestCard();
      // Mark all 5 cells in column B (col 0), including row 2
      for (let row = 0; row < 5; row++) {
        card.toggleCell(row, 0);
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'single-line' && p.description.includes('Column B'))).toBe(true);
    });

    it('detects diagonal win (top-left to bottom-right)', () => {
      const card = createTestCard();
      for (let i = 0; i < 5; i++) {
        if (i === 2) continue; // FREE at (2,2) already marked
        card.toggleCell(i, i);
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.description.includes('Diagonal ↘'))).toBe(true);
    });

    it('detects anti-diagonal win (top-right to bottom-left)', () => {
      const card = createTestCard();
      for (let i = 0; i < 5; i++) {
        if (i === 2) continue; // FREE center already marked
        card.toggleCell(i, 4 - i);
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.description.includes('Diagonal ↙'))).toBe(true);
    });
  });

  describe('win detection — full house', () => {
    it('detects full house when all cells are marked', () => {
      const card = createTestCard();
      // Mark all non-free cells
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          if (row === 2 && col === 2) continue;
          card.toggleCell(row, col);
        }
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'full-house')).toBe(true);
    });
  });

  describe('win detection — shapes', () => {
    it('detects four corners', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      card.toggleCell(0, 4);
      card.toggleCell(4, 0);
      card.toggleCell(4, 4);
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'four-corners')).toBe(true);
    });

    it('detects postage stamp (top-left)', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      card.toggleCell(0, 1);
      card.toggleCell(1, 0);
      card.toggleCell(1, 1);
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'postage-stamp')).toBe(true);
    });

    it('detects postage stamp (bottom-right)', () => {
      const card = createTestCard();
      card.toggleCell(3, 3);
      card.toggleCell(3, 4);
      card.toggleCell(4, 3);
      card.toggleCell(4, 4);
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'postage-stamp')).toBe(true);
    });

    it('detects letter X (both diagonals)', () => {
      const card = createTestCard();
      for (let i = 0; i < 5; i++) {
        if (i === 2) continue;
        card.toggleCell(i, i);
        card.toggleCell(i, 4 - i);
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'letter-x')).toBe(true);
    });

    it('detects letter L (row + column)', () => {
      const card = createTestCard();
      // Fill row 0 (except col 0 — will be filled by column loop)
      for (let col = 1; col < 5; col++) card.toggleCell(0, col);
      // Fill column B (all 5 rows, including row 0)
      for (let row = 0; row < 5; row++) card.toggleCell(row, 0);
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'letter-l')).toBe(true);
    });

    it('detects letter T (row + center column)', () => {
      const card = createTestCard();
      // Fill row 0 (all 5 cols)
      for (let col = 0; col < 5; col++) card.toggleCell(0, col);
      // Fill center column (col 2) — skip row 0 (already done) and row 2 (FREE)
      for (let row = 1; row < 5; row++) {
        if (row === 2) continue;
        card.toggleCell(row, 2);
      }
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'letter-t')).toBe(true);
    });

    it('detects frame (outer border)', () => {
      const card = createTestCard();
      // Mark all cells on the outer border (no double-toggles)
      for (let col = 1; col < 4; col++) {
        card.toggleCell(0, col);  // top row inner cells
        card.toggleCell(4, col);  // bottom row inner cells
      }
      // Corners
      card.toggleCell(0, 0);
      card.toggleCell(0, 4);
      card.toggleCell(4, 0);
      card.toggleCell(4, 4);
      // Left and right edges (skip corners)
      card.toggleCell(1, 0);
      card.toggleCell(2, 0);
      card.toggleCell(3, 0);
      card.toggleCell(1, 4);
      card.toggleCell(2, 4);
      card.toggleCell(3, 4);
      const patterns = card.getWinPatterns();
      expect(patterns.some(p => p.kind === 'frame')).toBe(true);
    });
  });

  describe('win detection — no false positives', () => {
    it('does not detect a win when only a partial row is marked', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      card.toggleCell(0, 1);
      card.toggleCell(0, 2);
      // Row 0 has 3/5 marked — not a win
      const patterns = card.getWinPatterns();
      expect(patterns.length).toBe(0);
    });
  });

  describe('resetGame', () => {
    it('clears all marks but keeps numbers', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      card.toggleCell(0, 1);
      card.toggleCell(0, 2);
      const originalGrid = card.grid.map(c => ({ ...c }));
      card.resetGame();
      expect(card.grid.every(c => c.isFree ? c.isMarked : !c.isMarked)).toBe(true);
      expect(card.grid.length).toBe(originalGrid.length);
    });
  });

  describe('toJSON / fromJSON', () => {
    it('serializes and deserializes without data loss', () => {
      const card = createTestCard();
      card.toggleCell(0, 0);
      card.toggleCell(3, 3);
      const json = card.toJSON();
      const restored = BingoCard.fromJSON(json);
      expect(restored.id).toBe(card.id);
      expect(restored.code).toBe(card.code);
      expect(restored.getCell(0, 0)?.isMarked).toBe(true);
      expect(restored.getCell(3, 3)?.isMarked).toBe(true);
    });
  });

  describe('hasNumber', () => {
    it('returns true if number exists on card', () => {
      const card = createTestCard();
      const firstCellNumber = card.grid[0]?.number?.value;
      if (firstCellNumber !== undefined && firstCellNumber !== null) {
        expect(card.hasNumber(firstCellNumber)).toBe(true);
      }
      expect(card.hasNumber(999)).toBe(false);
    });
  });

  describe('markedCount', () => {
    it('counts marked cells including FREE', () => {
      const card = createTestCard();
      expect(card.markedCount).toBe(1); // only FREE is marked initially
      card.toggleCell(0, 0);
      expect(card.markedCount).toBe(2);
    });
  });
});
