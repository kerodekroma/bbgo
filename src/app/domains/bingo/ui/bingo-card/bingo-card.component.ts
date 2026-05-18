import { Component, input, output, signal, effect, inject, ChangeDetectorRef, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { BingoCard } from '../../domain/bingo-card.entity';
import type { GameMode } from '../../domain/game-mode.type';
import type { WinPatternKind } from '../../domain/win-pattern.type';
import { PATTERN_VISUAL_CELLS } from '../../domain/win-pattern.type';
import { COLUMNS, COLUMN_RANGES } from '../../domain/bingo-column.type';
import { LanguageService } from '../../../../shared/i18n/language.service';

@Component({
  selector: 'app-bingo-card',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="bingo-card" role="grid" [attr.aria-label]="t()('bingoCard.gridAria')">
      <div class="bingo-header" role="row">
        @for (col of columns(); track col) {
          <div class="bingo-header-cell" role="columnheader">{{ col }}</div>
        }
      </div>
      @for (row of rowIndices(); track row) {
        <div class="bingo-row" role="row">
          @for (col of colIndices(); track col) {
            @let cell = getCell(row, col);
            @if (cell?.isFree) {
              <div
                class="bingo-cell is-free"
                [class.is-marked]="cell?.isMarked"
                [class.is-highlighted]="isCellHighlighted(row, col)"
                [class.is-clickable]="gameMode() === 'card-only'"
                (click)="onFreeCellClick(row, col)"
                (keydown)="onCellKeydown($event, row, col)"
                role="gridcell"
                [attr.aria-label]="getAriaLabel(cell, row, col)"
                [attr.tabindex]="gameMode() === 'card-only' ? 0 : -1"
              >
                <span class="free-text">{{ cell?.isMarked ? '✓' : 'FREE' }}</span>
              </div>
            } @else if (editMode()) {
              <input
                class="bingo-cell edit-cell"
                type="number"
                [min]="getMin(col)"
                [max]="getMax(col)"
                [ngModel]="cell?.number?.value ?? ''"
                (ngModelChange)="onNumberChange(row, col, $event)"
                (blur)="onNumberBlur(row, col)"
                role="gridcell"
                [attr.aria-label]="t()('bingoCard.editCellAria', { row: row + 1, col: columns()[col] ?? '' })"
              />
            } @else {
              <div
                class="bingo-cell"
                [class.is-marked]="cell?.isMarked"
                [class.is-winning]="cell?.isWinningCell"
                [class.is-highlighted]="isCellHighlighted(row, col) && !cell?.isWinningCell"
                [class.is-clickable]="gameMode() === 'card-only'"
                (click)="onCellClick(row, col)"
                (keydown)="onCellKeydown($event, row, col)"
                role="gridcell"
                [attr.aria-label]="getAriaLabel(cell, row, col)"
                [attr.tabindex]="gameMode() === 'card-only' ? 0 : -1"
              >
                <span class="cell-number">{{ cell?.number?.value }}</span>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .bingo-card {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 12px;
      background:
        linear-gradient(135deg, #faf8f5 0%, #f5f0e8 50%, #f0e8d8 100%);
      border-radius: 12px;
      box-shadow:
        0 2px 12px rgba(0,0,0,0.12),
        0 1px 3px rgba(0,0,0,0.08),
        inset 0 1px 0 rgba(255,255,255,0.6);
      max-width: 420px;
      margin: 0 auto;
      border: 1px solid #d4c9b0;
    }
    .bingo-header {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3px;
      margin-bottom: 2px;
    }
    .bingo-header-cell {
      background: linear-gradient(180deg, #c62828, #b71c1c);
      color: #fff;
      font-weight: 900;
      font-size: 1.6rem;
      text-align: center;
      padding: 10px 0;
      border-radius: 6px;
      letter-spacing: 2px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
    }
    .bingo-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 2px;
    }
    .bingo-cell {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #d4c9b0;
      border-radius: 6px;
      background: linear-gradient(180deg, #fff, #fcf9f5);
      cursor: default;
      transition: background 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--bingo-cell-text);
      min-width: 52px;
      min-height: 52px;
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.04);
    }
    .bingo-cell.is-clickable {
      cursor: pointer;
    }
    .bingo-cell.is-clickable:hover {
      background: linear-gradient(180deg, #e8f5e9, #c8e6c9);
      transform: scale(1.05);
      box-shadow: 0 2px 8px rgba(76,175,80,0.25);
    }
    .bingo-cell.is-clickable:focus-visible {
      outline: 3px solid #c62828;
      outline-offset: 2px;
    }
    .bingo-cell.is-marked {
      background: linear-gradient(180deg, #c8e6c9, #a5d6a7);
      border-color: #81c784;
      color: #1b5e20;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
    }
    .bingo-cell.is-winning {
      background: linear-gradient(180deg, #fff8e1, #ffecb3);
      border-color: #ffd54f;
      color: #e65100;
      animation: pulse-gold 1s ease-in-out infinite;
      box-shadow: 0 0 12px rgba(255,215,0,0.5);
    }
    .bingo-cell.is-highlighted {
      border-color: #5c6bc0;
      box-shadow: inset 0 0 0 2px rgba(92,107,192,0.3), 0 0 6px rgba(92,107,192,0.15);
    }
    .bingo-cell.is-free {
      background: linear-gradient(180deg, #fff3e0, #ffe0b2);
      border-style: dashed;
      border-color: #ffb74d;
    }
    .bingo-cell.is-free.is-marked {
      background: linear-gradient(180deg, #c8e6c9, #a5d6a7);
      border-style: solid;
      border-color: #81c784;
    }
    .free-text {
      font-size: 0.75rem;
      font-weight: 800;
      color: #e65100;
      text-transform: uppercase;
    }
    .is-free.is-marked .free-text {
      color: #1b5e20;
    }
    .free-text {
      font-size: 0.75rem;
      font-weight: 800;
      color: #e65100;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .cell-number {
      font-size: 1.2rem;
    }
    /* Edit mode input cells */
    .bingo-cell.edit-cell {
      padding: 0;
      text-align: center;
      font-family: inherit;
      cursor: text;
    }
    .bingo-cell.edit-cell:focus {
      border-color: #c62828;
      box-shadow: 0 0 0 3px rgba(198,40,40,0.2);
      outline: none;
    }
    .bingo-cell.edit-cell.is-invalid {
      border-color: #f44336;
      background: #fff5f5;
    }
    @keyframes pulse-gold {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.6); }
      50% { box-shadow: 0 0 0 6px rgba(255, 215, 0, 0.2); }
    }
    @media (max-width: 520px) {
      .bingo-card { max-width: 100%; padding: 6px; }
      .bingo-header-cell { font-size: 1.2rem; padding: 6px 0; border-radius: 4px; }
      .bingo-cell { min-width: 44px; min-height: 44px; font-size: 0.95rem; }
      .cell-number { font-size: 1rem; }
    }
    @media (max-width: 380px) {
      .bingo-card { padding: 3px; gap: 2px; }
      .bingo-header { gap: 2px; }
      .bingo-row { gap: 1px; }
      .bingo-header-cell { font-size: 1rem; padding: 3px 0; min-width: 0; }
      .bingo-cell { min-width: 32px; min-height: 32px; font-size: 0.8rem; border-width: 1px; border-radius: 3px; }
      .cell-number { font-size: 0.85rem; }
      .free-text { font-size: 0.6rem; }
    }
  `],
})
export class BingoCardComponent {
  readonly card = input.required<BingoCard>();
  readonly gameMode = input.required<GameMode>();
  readonly calledNumbers = input<number[]>([]);
  readonly editMode = input<boolean>(false);
  readonly highlightedPattern = input<WinPatternKind | null>(null);
  readonly cellToggled = output<{ row: number; col: number }>();
  readonly numberChanged = output<{ row: number; col: number; newNumber: number }>();

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;

  constructor() {
    // OnPush doesn't detect deep mutations on the card entity,
    // so we manually trigger change detection when calledNumbers change
    effect(() => {
      this.calledNumbers();
      this.cdr.markForCheck();
    });
  }

  protected readonly columns = () => COLUMNS;
  protected readonly rowIndices = () => [0, 1, 2, 3, 4];
  protected readonly colIndices = () => [0, 1, 2, 3, 4];

  /** Current set of cell indices that belong to the highlighted pattern */
  protected readonly highlightedCells = computed<Set<number>>(() => {
    const pattern = this.highlightedPattern();
    if (!pattern) return new Set();
    return new Set(PATTERN_VISUAL_CELLS[pattern]);
  });

  /** Track invalid inputs per cell for visual feedback */
  private readonly invalidCells = signal<Set<string>>(new Set());

  protected getCell(row: number, col: number) {
    return this.card().getCell(row, col);
  }

  protected isCellHighlighted(row: number, col: number): boolean {
    return this.highlightedCells().has(row * 5 + col);
  }

  protected getMin(col: number): number {
    const column = COLUMNS[col];
    return column ? COLUMN_RANGES[column].min : 1;
  }

  protected getMax(col: number): number {
    const column = COLUMNS[col];
    return column ? COLUMN_RANGES[column].max : 75;
  }

  protected onNumberChange(row: number, col: number, value: number | string): void {
    if (typeof value === 'string') return;
    const column = COLUMNS[col];
    const range = column ? COLUMN_RANGES[column] : undefined;
    const isValid = range !== undefined && value >= range.min && value <= range.max;
    const key = `${row}-${col}`;
    this.invalidCells.update(s => {
      const next = new Set(s);
      if (!isValid) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected onNumberBlur(row: number, col: number): void {
    const cell = this.getCell(row, col);
    const input = document.querySelector(`.bingo-row:nth-child(${row + 2}) .edit-cell:nth-child(${col + 1})`) as HTMLInputElement | null;
    if (!input || !cell) return;

    const val = parseInt(input.value, 10);
    if (isNaN(val)) {
      // Restore original value
      input.value = String(cell.number?.value ?? '');
      return;
    }

    const column = COLUMNS[col];
    const range = column ? COLUMN_RANGES[column] : undefined;
    if (!range || val < range.min || val > range.max) {
      input.value = String(cell.number?.value ?? '');
      return;
    }

    this.numberChanged.emit({ row, col, newNumber: val });
    input.value = String(val);
  }

  protected onCellClick(row: number, col: number): void {
    if (this.gameMode() !== 'card-only') return;
    this.cellToggled.emit({ row, col });
  }

  protected onFreeCellClick(row: number, col: number): void {
    if (this.gameMode() !== 'card-only') return;
    this.cellToggled.emit({ row, col });
  }

  protected onCellKeydown(event: KeyboardEvent, row: number, col: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onCellClick(row, col);
      return;
    }

    let targetRow = row;
    let targetCol = col;
    const step = (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowRight')) ? 3 : 1;

    switch (event.key) {
      case 'ArrowUp':    targetRow = Math.max(0, row - step); break;
      case 'ArrowDown':  targetRow = Math.min(4, row + step); break;
      case 'ArrowLeft':  targetCol = Math.max(0, col - step); break;
      case 'ArrowRight': targetCol = Math.min(4, col + step); break;
      default: return;
    }

    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const grid = target.closest('.bingo-card') as HTMLElement | null;
    if (!grid) return;
    const cells = grid.querySelectorAll('.bingo-cell:not(.edit-cell)') as NodeListOf<HTMLElement>;
    const idx = targetRow * 5 + targetCol;
    cells[idx]?.focus();
  }

  protected getAriaLabel(cell: { isFree?: boolean; isMarked?: boolean; isWinningCell?: boolean; number?: { value: number } | null } | undefined, row: number, col: number): string {
    const colLabel = COLUMNS[col] ?? '';
    if (!cell) return this.t()('bingoCard.cellAria', { row: row + 1, col: colLabel });
    if (cell.isFree) return this.t()('bingoCard.freeCellAria', { row: row + 1, col: colLabel });
    const state = cell.isMarked ? this.t()('bingoCard.marked') : this.t()('bingoCard.unmarked');
    const win = cell.isWinningCell ? ', winning' : '';
    const value = cell.number?.value ?? 0;
    return this.t()('bingoCard.markedCellAria', { row: row + 1, col: colLabel, value, state }) + win;
  }
}
