import { Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LanguageService } from '../../../../shared/i18n/language.service';
export interface ClearDialogResult {
  resetGame: boolean;
  deleteCards: boolean;
}

@Component({
  selector: 'app-clear-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="title-icon">delete_sweep</mat-icon>
      {{ t()('clearDialog.title') }}
    </h2>

    <mat-dialog-content>
      <p class="description">{{ t()('clearDialog.description') }}</p>

      <div class="options">
        <label class="option-row" (click)="resetGame.set(!resetGame())">
          <mat-checkbox [checked]="resetGame()" (click)="$event.stopPropagation()" (change)="resetGame.set($event.checked)" />
          <span class="option-text">
            <strong>{{ t()('clearDialog.clearNumbers') }}</strong>
            <span class="option-hint">{{ t()('clearDialog.clearNumbersHint') }}</span>
          </span>
        </label>

        <label class="option-row" (click)="deleteCards.set(!deleteCards())">
          <mat-checkbox [checked]="deleteCards()" (click)="$event.stopPropagation()" (change)="deleteCards.set($event.checked)" />
          <span class="option-text">
            <strong>{{ t()('clearDialog.deleteCards') }}</strong>
            <span class="option-hint">{{ t()('clearDialog.deleteCardsHint') }}</span>
          </span>
        </label>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">{{ t()('common.cancel') }}</button>
      <button
        mat-raised-button
        color="warn"
        [disabled]="!resetGame() && !deleteCards()"
        (click)="onClear()"
      >
        <mat-icon>delete</mat-icon>
        {{ t()('clearDialog.clear') }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .title-icon {
      font-size: 22px; width: 22px; height: 22px;
      vertical-align: middle; margin-right: 4px;
    }
    .description {
      color: #666;
      font-size: 0.9rem;
      margin: 0 0 12px;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .option-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .option-row:hover {
      background: #f5f0e8;
    }
    .option-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .option-hint {
      font-size: 0.8rem;
      color: #888;
    }
  `],
})
export class ClearDialogComponent {
  private readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;

  readonly dialogRef = inject(MatDialogRef<ClearDialogComponent, ClearDialogResult>);

  protected readonly resetGame = signal(false);
  protected readonly deleteCards = signal(false);

  protected onClear(): void {
    this.dialogRef.close({
      resetGame: this.resetGame(),
      deleteCards: this.deleteCards(),
    });
  }
}
