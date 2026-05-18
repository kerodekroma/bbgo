import { Component, input, computed } from '@angular/core';
import type { WinPatternKind } from '../../domain/win-pattern.type';
import { PATTERN_VISUAL_CELLS, PATTERN_CELL_COUNTS } from '../../domain/win-pattern.type';

@Component({
  selector: 'app-pattern-icon',
  standalone: true,
  template: `
    <div
      class="pattern-icon"
      role="img"
      [attr.aria-label]="ariaLabel()"
    >
      @for (row of rows; track row) {
        <div class="icon-row">
          @for (col of cols; track col) {
            @let idx = row * 5 + col;
            <div
              class="icon-cell"
              [class.is-active]="activeSet().has(idx)"
            ></div>
          }
        </div>
      }
      @if (showCount()) {
        <span class="cell-count">{{ cellCount() }}</span>
      }
    </div>
  `,
  styles: [`
    .pattern-icon {
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: relative;
      width: fit-content;
    }
    .icon-row {
      display: flex;
      gap: 2px;
    }
    .icon-cell {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background: #e8e0d4;
      border: 1px solid #d4c9b0;
      transition: background 0.15s ease;
    }
    .is-active {
      background: #c62828;
      border-color: #b71c1c;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
    }
    .cell-count {
      position: absolute;
      bottom: -2px;
      right: -2px;
      font-size: 0.6rem;
      font-weight: 700;
      color: #999;
      line-height: 1;
    }
  `],
})
export class PatternIconComponent {
  readonly pattern = input.required<WinPatternKind>();
  readonly showCount = input(false);

  protected readonly rows = [0, 1, 2, 3, 4];
  protected readonly cols = [0, 1, 2, 3, 4];

  protected readonly activeSet = computed<Set<number>>(() => {
    return new Set(PATTERN_VISUAL_CELLS[this.pattern()]);
  });

  protected readonly cellCount = computed(() => PATTERN_CELL_COUNTS[this.pattern()]);

  protected readonly ariaLabel = computed(() => {
    return `Pattern icon for ${this.pattern()}, ${this.cellCount()} cells`;
  });
}
