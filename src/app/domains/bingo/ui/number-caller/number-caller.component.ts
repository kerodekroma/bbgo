import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import type { GameMode } from '../../domain/game-mode.type';
import { LanguageService } from '../../../../shared/i18n/language.service';

@Component({
  selector: 'app-number-caller',
  standalone: true,
  imports: [
    FormsModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIconModule,
  ],
  template: `
    <div class="caller-panel">
      <div class="caller-controls">
        <div class="caller-input-area">
          <mat-form-field appearance="outline" class="caller-input" subscriptSizing="dynamic">
            <input
              matInput
              type="number"
              min="1"
              max="75"
              [placeholder]="t()('caller.placeholder')"
              [(ngModel)]="inputValue"
              (keydown.enter)="onCall()"
              [disabled]="gameMode() !== 'caller'"
            />
            <button
              mat-icon-button
              matSuffix
              (click)="onCall()"
              [disabled]="gameMode() !== 'caller'"
              [attr.aria-label]="t()('caller.callNumber')"
            >
              <mat-icon>play_arrow</mat-icon>
            </button>
          </mat-form-field>
          @if (errorMessage()) {
            <div class="error-text">{{ errorMessage() }}</div>
          }
        </div>

        <div class="caller-actions">
          <mat-slide-toggle
            [checked]="gameMode() === 'caller'"
            (toggleChange)="onToggleMode()"
            [attr.aria-label]="gameMode() === 'caller' ? t()('caller.switchToCardOnly') : t()('caller.switchToCaller')"
          >
            {{ gameMode() === 'caller' ? t()('caller.mode') : t()('caller.cardOnly') }}
          </mat-slide-toggle>

          <button
            mat-stroked-button
            color="warn"
            (click)="onReset()"
            [attr.aria-label]="t()('caller.resetGame')"
          >
            <mat-icon>refresh</mat-icon>
            {{ t()('caller.reset') }}
          </button>
        </div>
      </div>

      @if (recentCalledNumbers().length > 0) {
        <div class="called-history">
          <span class="history-label">{{ t()('caller.recentCalls') }}</span>
          <div class="history-numbers">
            @for (num of recentCalledNumbers(); track $index) {
              <div class="called-chip" role="listitem">
                <span class="chip-number">{{ num }}</span>
                <button
                  class="chip-undo"
                  (click)="onVoid(num)"
                  [attr.aria-label]="t()('caller.removeNumber', { num })"
                  type="button"
                >
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
          </div>
          @if (calledNumbers().length > 15) {
            <span class="history-total">{{ t()('caller.moreCount', { count: calledNumbers().length - 15 }) }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .caller-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #faf8f5, #f5f0e8);
      border-radius: 12px;
      border: 1px solid #d4c9b0;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .caller-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .caller-input-area {
      flex: 1;
      min-width: 200px;
    }
    .caller-input {
      width: 100%;
    }
    .caller-input ::ng-deep input {
      font-size: 1.2rem;
    }
    .caller-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      white-space: nowrap;
    }
    .error-text {
      color: #f44336;
      font-size: 0.85rem;
      margin-top: -8px;
    }
    .called-history {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding-top: 8px;
      border-top: 1px solid #e0d6c4;
    }
    .history-label {
      font-weight: 600;
      color: #666;
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .history-numbers {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .called-chip {
      display: flex;
      align-items: center;
      gap: 2px;
      background: #fff;
      border: 1px solid #d4c9b0;
      border-radius: 16px;
      padding: 2px 4px 2px 10px;
      font-size: 0.9rem;
      font-weight: 700;
      color: #333;
      transition: background 0.15s ease;
    }
    .called-chip:hover {
      background: #fff5f5;
      border-color: #e57373;
    }
    .chip-number {
      min-width: 20px;
      text-align: center;
    }
    .chip-undo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      color: #999;
      transition: all 0.15s ease;
      padding: 0;
    }
    .chip-undo:hover {
      background: #f44336;
      color: #fff;
    }
    .chip-undo .mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      line-height: 14px;
    }
    .history-total {
      font-size: 0.8rem;
      color: #999;
    }
    @media (max-width: 520px) {
      .caller-controls { flex-direction: column; align-items: stretch; gap: 8px; }
      .caller-input-area { min-width: 0; }
      .caller-actions { justify-content: space-between; }
    }
  `],
})
export class NumberCallerComponent {
  private readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;

  readonly calledNumbers = input.required<number[]>();
  readonly recentCalledNumbers = input<number[]>([]);
  readonly gameMode = input.required<GameMode>();
  readonly errorMessage = input<string | null>(null);
  readonly numberCalled = output<number>();
  readonly numberVoided = output<number>();
  readonly gameModeChanged = output<GameMode>();
  readonly resetRequested = output<void>();

  protected readonly inputValue = signal<string>('');

  protected onCall(): void {
    const val = parseInt(this.inputValue(), 10);
    if (isNaN(val) || val < 1 || val > 75) return;
    this.numberCalled.emit(val);
    this.inputValue.set('');
  }

  protected onVoid(n: number): void {
    this.numberVoided.emit(n);
  }

  protected onToggleMode(): void {
    this.gameModeChanged.emit(this.gameMode() === 'caller' ? 'card-only' : 'caller');
  }

  protected onReset(): void {
    if (confirm(this.t()('caller.resetConfirm'))) {
      this.resetRequested.emit();
    }
  }
}
