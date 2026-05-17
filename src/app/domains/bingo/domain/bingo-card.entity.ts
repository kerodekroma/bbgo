import type { GridCell } from './grid-cell.vo';
import { markCell, unmarkCell, setCellWinning, createGridCell } from './grid-cell.vo';
import { createBingoNumber, type Result } from './bingo-number.vo';
import type { WinPattern, WinPatternKind } from './win-pattern.type';
import type { CardId } from './card-id.vo';
import type { BingoColumn } from './bingo-column.type';
import { COLUMNS, COLUMN_RANGES } from './bingo-column.type';

export type DomainError = { kind: 'number-not-found'; number: number }
  | { kind: 'invalid-cell'; row: number; col: number }
  | { kind: 'invalid-grid'; message: string };

export class BingoCard {
  private constructor(
    public readonly id: CardId,
    private _code: string,
    public readonly createdAt: Date,
    private _grid: GridCell[],
  ) {}

  get code(): string {
    return this._code;
  }

  /** Rename this card */
  rename(newCode: string): void {
    this._code = newCode.trim().substring(0, 20);
  }

  get grid(): readonly GridCell[] {
    return this._grid;
  }

  /** Static factory — validates all numbers belong to correct columns */
  static create(
    id: CardId,
    code: string,
    gridNumbers: readonly (readonly number[])[],
  ): Result<BingoCard, DomainError> {
    if (gridNumbers.length !== 5 || gridNumbers.some(row => row.length !== 5)) {
      return { ok: false, error: { kind: 'invalid-grid', message: 'Grid must be 5×5' } };
    }

    const grid: GridCell[] = [];

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const isFree = row === 2 && col === 2;
        if (isFree) {
          grid.push(createGridCell(row, col, null, true));
          continue;
        }

        const num = gridNumbers[row]![col]!;
        const column = COLUMNS[col]!;
        const result = createBingoNumber(num, column);
        if (!result.ok) {
          return { ok: false, error: { kind: 'invalid-grid', message: `Cell [${row},${col}]: ${result.error.kind}` } };
        }
        grid.push(createGridCell(row, col, result.value, false));
      }
    }

    // Validate no duplicate numbers in the card
    const numbers = grid
      .filter(c => !c.isFree && c.number !== null)
      .map(c => c.number!.value);
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      return { ok: false, error: { kind: 'invalid-grid', message: 'Duplicate numbers in card' } };
    }

    return { ok: true, value: new BingoCard(id, code, new Date(), grid) };
  }

  /** Mark a called number on this card (caller mode) */
  markNumber(calledNumber: number): Result<GridCell, DomainError> {
    const cellIndex = this._grid.findIndex(
      c => !c.isFree && c.number?.value === calledNumber,
    );

    if (cellIndex === -1) {
      return { ok: false, error: { kind: 'number-not-found', number: calledNumber } };
    }

    const cell = this._grid[cellIndex]!;
    if (cell.isMarked) {
      return { ok: true, value: cell }; // already marked, no-op
    }

    this._grid = this._grid.map((c, i) =>
      i === cellIndex ? markCell(c) : c,
    );

    return { ok: true, value: this._grid[cellIndex]! };
  }

  /** Undo a called number — unmarks the cell that matched it */
  voidNumber(calledNumber: number): Result<GridCell, DomainError> {
    const cellIndex = this._grid.findIndex(
      c => !c.isFree && c.number?.value === calledNumber,
    );

    if (cellIndex === -1) {
      return { ok: false, error: { kind: 'number-not-found', number: calledNumber } };
    }

    const cell = this._grid[cellIndex]!;
    if (!cell.isMarked) {
      return { ok: true, value: cell }; // not marked, no-op
    }

    this._grid = this._grid.map((c, i) =>
      i === cellIndex ? unmarkCell(c) : c,
    );

    return { ok: true, value: this._grid[cellIndex]! };
  }

  /** Toggle a cell's marked state (card-only mode) */
  toggleCell(row: number, col: number): Result<GridCell, DomainError> {
    if (row < 0 || row > 4 || col < 0 || col > 4) {
      return { ok: false, error: { kind: 'invalid-cell', row, col } };
    }

    const cellIndex = row * 5 + col;
    const cell = this._grid[cellIndex];

    if (!cell) {
      return { ok: false, error: { kind: 'invalid-cell', row, col } };
    }

    this._grid = this._grid.map((c, i) =>
      i === cellIndex ? (cell.isMarked ? unmarkCell(c) : markCell(c)) : c,
    );

    return { ok: true, value: this._grid[cellIndex]! };
  }

  /** Change a cell's number (edit mode) — validates column range + no duplicates */
  changeNumber(row: number, col: number, newNumber: number): Result<GridCell, DomainError> {
    if (row < 0 || row > 4 || col < 0 || col > 4) {
      return { ok: false, error: { kind: 'invalid-cell', row, col } };
    }

    const cellIndex = row * 5 + col;
    const cell = this._grid[cellIndex];

    if (!cell || cell.isFree) {
      return { ok: false, error: { kind: 'invalid-cell', row, col } };
    }

    // Validate column range
    const column = COLUMNS[col]!;
    const range = COLUMN_RANGES[column];
    if (newNumber < range.min || newNumber > range.max) {
      return { ok: false, error: { kind: 'invalid-grid', message: `${newNumber} is not valid for column ${column}` } };
    }

    // Validate no duplicate on card
    const exists = this._grid.some(
      (c, i) => i !== cellIndex && !c.isFree && c.number?.value === newNumber,
    );
    if (exists) {
      return { ok: false, error: { kind: 'invalid-grid', message: `Number ${newNumber} already exists on this card` } };
    }

    const bingoNum = createBingoNumber(newNumber, column);
    if (!bingoNum.ok) {
      return { ok: false, error: { kind: 'invalid-grid', message: bingoNum.error.kind } };
    }

    this._grid = this._grid.map((c, i) =>
      i === cellIndex ? { ...c, number: bingoNum.value, isMarked: false } : c,
    );

    return { ok: true, value: this._grid[cellIndex]! };
  }

  /** Get cell at position */
  getCell(row: number, col: number): GridCell | undefined {
    return this._grid[row * 5 + col];
  }

  /** Evaluate current win patterns — detects lines, shapes, full house */
  getWinPatterns(): WinPattern[] {
    const patterns: WinPattern[] = [];
    const winningCells = new Set<number>();
    const markAll = (cells: readonly GridCell[]) => cells.forEach(c => winningCells.add(c.row * 5 + c.col));

    // ── Lines: rows, columns, diagonals ──
    const linePatterns: WinPattern[] = [];
    for (let row = 0; row < 5; row++) {
      const cells = this.getRowCells(row);
      if (cells.every(c => c.isMarked)) {
        linePatterns.push({ kind: 'single-line', cells, description: `Row ${row + 1}` });
      }
    }
    for (let col = 0; col < 5; col++) {
      const cells = this.getColumnCells(col);
      if (cells.every(c => c.isMarked)) {
        linePatterns.push({ kind: 'single-line', cells, description: `Column ${COLUMNS[col]}` });
      }
    }
    const diag = [0, 1, 2, 3, 4].map(i => this._grid[i * 5 + i]!);
    if (diag.every(c => c.isMarked)) {
      linePatterns.push({ kind: 'single-line', cells: diag, description: 'Diagonal ↘' });
    }
    const antiDiag = [0, 1, 2, 3, 4].map(i => this._grid[i * 5 + (4 - i)]!);
    if (antiDiag.every(c => c.isMarked)) {
      linePatterns.push({ kind: 'single-line', cells: antiDiag, description: 'Diagonal ↙' });
    }
    for (const lp of linePatterns) {
      patterns.push(lp);
      markAll(lp.cells);
    }

    // ── Letter X = both diagonals (as one pattern) ──
    if (diag.every(c => c.isMarked) && antiDiag.every(c => c.isMarked)) {
      // Only add if we have a line pattern for each
      const xCells = [...new Map([...diag, ...antiDiag].map(c => [c.row * 5 + c.col, c])).values()];
      patterns.push({ kind: 'letter-x', cells: xCells, description: 'Letter X' });
      markAll(xCells);
    }

    // ── Four Corners ──
    const corners = [this._grid[0]!, this._grid[4]!, this._grid[20]!, this._grid[24]!];
    if (corners.every(c => c.isMarked)) {
      patterns.push({ kind: 'four-corners', cells: corners, description: 'Four Corners' });
      markAll(corners);
    }

    // ── Postage Stamp (2×2 block in any corner) ──
    const stampCorners: [number, number][] = [[0, 0], [0, 3], [3, 0], [3, 3]];
    for (const [sr, sc] of stampCorners) {
      const block = [
        this._grid[sr * 5 + sc]!,
        this._grid[sr * 5 + sc + 1]!,
        this._grid[(sr + 1) * 5 + sc]!,
        this._grid[(sr + 1) * 5 + sc + 1]!,
      ];
      if (block.every(c => c.isMarked)) {
        const label = sr === 0 ? (sc === 0 ? 'Top-Left' : 'Top-Right') : (sc === 0 ? 'Bottom-Left' : 'Bottom-Right');
        patterns.push({ kind: 'postage-stamp', cells: block, description: `Postage Stamp (${label})` });
        markAll(block);
        break; // one stamp is enough
      }
    }

    // ── Frame (outer border) ──
    const frameCells = this._grid.filter(c => c.row === 0 || c.row === 4 || c.col === 0 || c.col === 4);
    if (frameCells.every(c => c.isMarked)) {
      patterns.push({ kind: 'frame', cells: frameCells, description: 'Frame' });
      markAll(frameCells);
    }

    // ── Letter L = any full row + any full column (non-parallel) ──
    const fullRows = [0, 1, 2, 3, 4].filter(r => this.getRowCells(r).every(c => c.isMarked));
    const fullCols = [0, 1, 2, 3, 4].filter(c => this.getColumnCells(c).every(c => c.isMarked));
    for (const r of fullRows) {
      for (const c of fullCols) {
        // Row 2 + Col 2 is a cross, not really an L — skip
        if (r === 2 && c === 2) continue;
        const lCells = [...new Map(
          [...this.getRowCells(r), ...this.getColumnCells(c)]
            .map(cell => [cell.row * 5 + cell.col, cell]),
        ).values()];
        patterns.push({ kind: 'letter-l', cells: lCells, description: `Letter L (Row ${r + 1} + Col ${COLUMNS[c]})` });
        markAll(lCells);
      }
    }
    // Deduplicate letter-l (same row+col combo might produce duplicates)
    const seenL = new Set<string>();
    for (let i = patterns.length - 1; i >= 0; i--) {
      if (patterns[i]!.kind === 'letter-l') {
        const key = patterns[i]!.description;
        if (seenL.has(key)) patterns.splice(i, 1);
        else seenL.add(key);
      }
    }

    // ── Letter T = a full row + full center column (col 2) ──
    if (this.getColumnCells(2).every(c => c.isMarked)) {
      for (const r of fullRows) {
        if (r === 2) continue; // row 2 + col 2 is a cross
        const tCells = [...new Map(
          [...this.getRowCells(r), ...this.getColumnCells(2)]
            .map(cell => [cell.row * 5 + cell.col, cell]),
        ).values()];
        patterns.push({ kind: 'letter-t', cells: tCells, description: `Letter T (Row ${r + 1})` });
        markAll(tCells);
      }
    }

    // ── Full House ──
    if (this._grid.every(c => c.isMarked)) {
      patterns.push({ kind: 'full-house', cells: [...this._grid], description: 'Full House!' });
      markAll([...this._grid]);
    }

    // ── Upgrade to multi-line if 2+ line patterns exist (no full-house) ──
    const singles = patterns.filter(p => p.kind === 'single-line');
    if (singles.length >= 2 && !patterns.some(p => p.kind === 'full-house')) {
      const allCells = [...new Map(
        singles.flatMap(p => p.cells).map(c => [c.row * 5 + c.col, c]),
      ).values()];
      patterns.push({ kind: 'multi-line', cells: allCells, description: `${singles.length} Lines!` });
    }

    // Mark winning cells on the grid
    this._grid = this._grid.map((c, i) =>
      setCellWinning(c, winningCells.has(i)),
    );

    return patterns;
  }

  /** Check if card has any winning pattern */
  hasWon(): boolean {
    return this.getWinPatterns().length > 0;
  }

  /** Reset game state (clear marks but keep numbers) */
  resetGame(): void {
    this._grid = this._grid.map(c => ({
      ...c,
      isMarked: false,
      isWinningCell: false,
    }));
  }

  /** Count total marked cells (including FREE) */
  get markedCount(): number {
    return this._grid.filter(c => c.isMarked).length;
  }

  /** Check if a specific number exists on the card */
  hasNumber(n: number): boolean {
    return this._grid.some(c => !c.isFree && c.number?.value === n);
  }

  /** Calculate progress (0-100) toward a specific win pattern */
  getPatternProgress(kind: WinPatternKind): number {
    const cells = this._grid;

    switch (kind) {
      case 'single-line': {
        let best = 0;
        for (let r = 0; r < 5; r++) {
          const line = this.getRowCells(r);
          best = Math.max(best, line.filter(c => c.isMarked).length);
        }
        for (let c = 0; c < 5; c++) {
          const line = this.getColumnCells(c);
          best = Math.max(best, line.filter(c => c.isMarked).length);
        }
        const diag = [0, 1, 2, 3, 4].map(i => cells[i * 5 + i]!);
        best = Math.max(best, diag.filter(c => c.isMarked).length);
        const antiDiag = [0, 1, 2, 3, 4].map(i => cells[i * 5 + (4 - i)]!);
        best = Math.max(best, antiDiag.filter(c => c.isMarked).length);
        return Math.round((best / 5) * 100);
      }

      case 'multi-line':
        // Fall back to single-line progress
        return this.getPatternProgress('single-line');

      case 'four-corners': {
        const corners = [cells[0]!, cells[4]!, cells[20]!, cells[24]!];
        return Math.round((corners.filter(c => c.isMarked).length / 4) * 100);
      }

      case 'postage-stamp': {
        let best = 0;
        const stampCorners: [number, number][] = [[0, 0], [0, 3], [3, 0], [3, 3]];
        for (const [sr, sc] of stampCorners) {
          const block = [
            cells[sr * 5 + sc]!,
            cells[sr * 5 + sc + 1]!,
            cells[(sr + 1) * 5 + sc]!,
            cells[(sr + 1) * 5 + sc + 1]!,
          ];
          best = Math.max(best, block.filter(c => c.isMarked).length);
        }
        return Math.round((best / 4) * 100);
      }

      case 'letter-x': {
        const idxSet = new Set<number>();
        for (let i = 0; i < 5; i++) {
          idxSet.add(i * 5 + i);
          idxSet.add(i * 5 + (4 - i));
        }
        const marked = [...idxSet].filter(i => cells[i]?.isMarked).length;
        return Math.round((marked / idxSet.size) * 100);
      }

      case 'letter-l': {
        let best = 0;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (r === 2 && c === 2) continue;
            const unique = new Set([
              ...this.getRowCells(r),
              ...this.getColumnCells(c),
            ].map(cell => cell.row * 5 + cell.col));
            const marked = [...unique].filter(i => cells[i]?.isMarked).length;
            best = Math.max(best, marked / unique.size);
          }
        }
        return Math.round(best * 100);
      }

      case 'letter-t': {
        let best = 0;
        const centerCol = this.getColumnCells(2);
        for (let r = 0; r < 5; r++) {
          if (r === 2) continue;
          const unique = new Set([
            ...this.getRowCells(r),
            ...centerCol,
          ].map(cell => cell.row * 5 + cell.col));
          const marked = [...unique].filter(i => cells[i]?.isMarked).length;
          best = Math.max(best, marked / unique.size);
        }
        return Math.round(best * 100);
      }

      case 'frame': {
        const frame = cells.filter(c => c.row === 0 || c.row === 4 || c.col === 0 || c.col === 4);
        return Math.round((frame.filter(c => c.isMarked).length / frame.length) * 100);
      }

      case 'full-house': {
        return Math.round((cells.filter(c => c.isMarked).length / 25) * 100);
      }
    }
  }

  /** Serialize to plain object for storage */
  toJSON(): BingoCardJSON {
    return {
      id: this.id,
      code: this.code,
      createdAt: this.createdAt.toISOString(),
      grid: this._grid.map(c => ({
        row: c.row,
        col: c.col,
        value: c.number?.value ?? null,
        column: c.number?.column ?? null,
        isMarked: c.isMarked,
        isFree: c.isFree,
      })),
    };
  }

  /** Deserialize from plain object */
  static fromJSON(data: BingoCardJSON): BingoCard {
    const grid: GridCell[] = data.grid.map(c => ({
      row: c.row,
      col: c.col,
      number: c.value !== null && c.column !== null ? { value: c.value, column: c.column as BingoColumn } : null,
      isMarked: c.isMarked,
      isFree: c.isFree,
      isWinningCell: false,
    }));
    return new BingoCard(
      data.id as CardId,
      data.code,
      new Date(data.createdAt),
      grid,
    );
  }

  private getRowCells(row: number): GridCell[] {
    const start = row * 5;
    return this._grid.slice(start, start + 5);
  }

  private getColumnCells(col: number): GridCell[] {
    return [0, 1, 2, 3, 4].map(row => this._grid[row * 5 + col]!);
  }
}

export interface BingoCardJSON {
  id: string;
  code: string;
  createdAt: string;
  grid: Array<{
    row: number;
    col: number;
    value: number | null;
    column: string | null;
    isMarked: boolean;
    isFree: boolean;
  }>;
}
