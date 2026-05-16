import { Component, input, output } from '@angular/core';
import { COLUMNS } from '../../domain/bingo-column.type';

@Component({
  selector: 'app-number-board',
  standalone: true,
  template: `
    <div class="number-board">
      <div class="board-header">
        @for (col of columns; track col) {
          <div class="board-header-cell">{{ col }}</div>
        }
      </div>
      @for (row of rows; track row) {
        <div class="board-row">
          @for (col of columns; track col; let ci = $index) {
            @let num = row + ci * 15;
            @if (num <= 75) {
              <div
                class="board-cell"
                [class.is-called]="isCalled(num)"
                [class.is-latest]="num === latestCalled()"
                (click)="onCellClick(num)"
                role="button"
                tabindex="0"
                [attr.aria-label]="num + (isCalled(num) ? ', called' : ', not called')"
                (keydown.enter)="onCellClick(num)"
                (keydown.space)="onCellClick(num); $event.preventDefault()"
              >
                {{ num }}
              </div>
            } @else {
              <div class="board-cell is-empty"></div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .number-board {
      background: linear-gradient(135deg, #faf8f5, #f5f0e8);
      border-radius: 12px;
      border: 1px solid #d4c9b0;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .board-header {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3px;
      margin-bottom: 3px;
    }
    .board-header-cell {
      background: linear-gradient(180deg, #c62828, #b71c1c);
      color: #fff;
      font-weight: 900;
      font-size: 1.1rem;
      text-align: center;
      padding: 6px 0;
      border-radius: 6px;
      letter-spacing: 2px;
    }
    .board-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 3px;
    }
    .board-cell {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e0d6c4;
      border-radius: 4px;
      background: #fff;
      font-size: 0.85rem;
      font-weight: 600;
      color: #999;
      transition: all 0.2s ease;
      min-height: 32px;
      cursor: pointer;
    }
    .board-cell:hover {
      transform: scale(1.08);
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      z-index: 1;
      position: relative;
    }
    .board-cell:focus-visible {
      outline: 2px solid #c62828;
      outline-offset: 2px;
    }
    .board-cell.is-called {
      background: linear-gradient(180deg, #c8e6c9, #a5d6a7);
      border-color: #81c784;
      color: #1b5e20;
      font-weight: 700;
    }
    .board-cell.is-called:hover {
      background: linear-gradient(180deg, #ffcdd2, #ef9a9a);
      border-color: #e57373;
      color: #b71c1c;
    }
    .board-cell.is-latest {
      background: linear-gradient(180deg, #fff8e1, #ffecb3);
      border-color: #ffd54f;
      color: #e65100;
      animation: pulse-gold 1.5s ease-in-out infinite;
      box-shadow: 0 0 8px rgba(255,215,0,0.4);
    }
    .board-cell.is-latest:hover {
      background: linear-gradient(180deg, #ffcdd2, #ef9a9a);
      border-color: #e57373;
      color: #b71c1c;
      animation: none;
    }
    .board-cell.is-empty {
      background: transparent;
      border-color: transparent;
      cursor: default;
    }
    @keyframes pulse-gold {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.5); }
      50% { box-shadow: 0 0 0 4px rgba(255,215,0,0.15); }
    }
  `],
})
export class NumberBoardComponent {
  readonly calledNumbers = input.required<number[]>();
  readonly numberToggled = output<number>();

  protected readonly columns = COLUMNS;
  protected readonly rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  protected isCalled(n: number): boolean {
    return this.calledNumbers().includes(n);
  }

  protected latestCalled(): number | null {
    const nums = this.calledNumbers();
    return nums.length > 0 ? nums[nums.length - 1]! : null;
  }

  protected onCellClick(n: number): void {
    this.numberToggled.emit(n);
  }
}
