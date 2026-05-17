import { Component, inject, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { BingoCard } from '../../domain/bingo-card.entity';
import type { CardId } from '../../domain/card-id.vo';
import type { GameMode } from '../../domain/game-mode.type';
import type { WinPattern, WinPatternKind } from '../../domain/win-pattern.type';
import { BingoCardComponent } from '../bingo-card/bingo-card.component';
import { LanguageService } from '../../../../shared/i18n/language.service';

@Component({
  selector: 'app-card-tabs',
  standalone: true,
  imports: [
    NgClass,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatTooltipModule,
    BingoCardComponent,
  ],
  template: `
    @if (cards().length === 0) {
      <div class="empty-state">
        <mat-icon class="empty-icon">grid_view</mat-icon>
        <h2>{{ t()('card.noCards') }}</h2>
        <p>{{ t()('card.addFirst') }}</p>
        <button mat-raised-button color="primary" (click)="addCard.emit()">
          <mat-icon>add</mat-icon>
          {{ t()('card.add') }}
        </button>
      </div>
    } @else {
      <div class="cards-container">
        <mat-accordion class="cards-accordion" multi>
          @for (card of cards(); track card.id) {
            <mat-expansion-panel
              class="card-panel"
              [expanded]="card.id === activeCardId()"
              (opened)="onCardSelected(card.id)"
            >
              <mat-expansion-panel-header>
                <mat-panel-title class="panel-title">
                  @if (renamingCard() === card.id) {
                    <input
                      #renameInput
                      class="card-code-input"
                      type="text"
                      [value]="card.code"
                      (input)="renameDraft.set($any($event.target).value)"
                      (keydown)="onRenameKeydown($event, card.id)"
                      (blur)="onRenameCommit(card.id)"
                      maxlength="20"
                      autofocus
                    />
                  } @else {
                    <span
                      class="card-code"
                      (click)="onRenameStart(card.id)"
                      [attr.aria-label]="t()('card.renameAria', { code: card.code })"
                      [title]="t()('card.clickToRename')"
                    >{{ card.code }}</span>
                  }
                  @if (winResults().has(card.id)) {
                    <mat-icon class="win-icon" [matTooltip]="t()('card.winner')">emoji_events</mat-icon>
                  }
                </mat-panel-title>
                <mat-panel-description class="panel-description">
                  @let p = getBestProgress(card);
                  <span class="card-pattern-label">{{ p.label }}</span>
                  <span class="card-percentage">{{ p.pct }}%</span>
                  <mat-progress-bar
                    class="card-progress"
                    mode="determinate"
                    [value]="p.pct"
                    [ngClass]="getProgressClass(p.pct)"
                  />
                </mat-panel-description>
              </mat-expansion-panel-header>

              <div class="card-content">
                <div class="card-actions">
                  <button
                    mat-icon-button
                    (click)="onToggleEdit(card.id)"
                    [attr.aria-label]="t()('card.editCard', { code: card.code })"
                    [matTooltip]="editModes()[card.id] ? t()('card.doneEditing') : t()('card.editNumbers')"
                  >
                    <mat-icon>{{ editModes()[card.id] ? 'check_circle' : 'edit' }}</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    (click)="onResetCard(card.id)"
                    [attr.aria-label]="t()('card.resetCard', { code: card.code })"
                    [matTooltip]="t()('card.clearMarks')"
                  >
                    <mat-icon>replay</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    color="warn"
                    (click)="onDeleteCard(card.id)"
                    [attr.aria-label]="t()('card.deleteCard', { code: card.code })"
                    [matTooltip]="t()('card.deleteTitle')"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>

                <app-bingo-card
                  [card]="card"
                  [gameMode]="gameMode()"
                  [calledNumbers]="calledNumbers()"
                  [editMode]="editModes()[card.id] ?? false"
                  (cellToggled)="onCellToggled(card.id, $event)"
                  (numberChanged)="onNumberChanged(card.id, $event)"
                />
              </div>
            </mat-expansion-panel>
          }
        </mat-accordion>

        <button
          mat-raised-button
          color="primary"
          class="add-card-btn"
          (click)="addCard.emit()"
        >
          <mat-icon>add</mat-icon>
          {{ t()('card.add') }}
        </button>
      </div>
    }
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      text-align: center;
      color: #666;
    }
    .empty-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.4;
    }
    .cards-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cards-accordion {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card-panel {
      border-radius: 12px !important;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
    }
    .card-panel.mat-expansion-panel {
      margin: 0 !important;
    }
    /* Force dark text on header for contrast against white panel bg */
    .card-panel ::ng-deep .mat-expansion-panel-header {
      color: #1a1a1a !important;
      background: #fff;
      min-height: 56px !important;
    }
    .card-panel ::ng-deep .mat-expansion-panel-header:hover {
      background: #f5f0e8;
    }
    .card-panel ::ng-deep .mat-expansion-panel-header-title {
      margin: 0 !important;
      color: #1a1a1a !important;
      flex: 0 0 auto !important;
      min-width: 0;
    }
    .card-panel ::ng-deep .mat-expansion-panel-header-description {
      color: #1a1a1a !important;
      flex: 1 1 auto !important;
      margin-right: 16px !important;
      align-items: center;
    }
    .card-panel ::ng-deep .mat-expansion-indicator::after {
      color: #1a1a1a !important;
    }
    .card-panel ::ng-deep .mat-expansion-panel-body {
      background: #fff;
    }
    .panel-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 1rem;
    }
    .card-code {
      white-space: nowrap;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      transition: background 0.15s ease;
    }
    .card-code:hover {
      background: #f5f0e8;
    }
    .card-code-input {
      font: inherit;
      font-weight: 700;
      font-size: 1rem;
      border: 1px solid #c62828;
      border-radius: 4px;
      padding: 2px 6px;
      width: 120px;
      outline: none;
      color: #1a1a1a;
      background: #fff;
    }
    .win-icon {
      color: #ffd700;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .panel-description {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-content: flex-end;
    }
    .card-pattern-label {
      font-size: 0.72rem;
      color: #888;
      margin-right: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100px;
    }
    .card-percentage {
      font-weight: 700;
      font-size: 0.85rem;
      color: #555;
      min-width: 32px;
      text-align: right;
    }
    .card-progress {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      min-width: 80px;
    }
    .card-progress ::ng-deep .mat-mdc-progress-bar-fill {
      border-radius: 4px;
    }
    .card-progress.progress-low ::ng-deep .mat-mdc-progress-bar-fill {
      background: #e57373;
    }
    .card-progress.progress-mid ::ng-deep .mat-mdc-progress-bar-fill {
      background: #ffb74d;
    }
    .card-progress.progress-high ::ng-deep .mat-mdc-progress-bar-fill {
      background: #81c784;
    }
    .card-progress.progress-complete ::ng-deep .mat-mdc-progress-bar-fill {
      background: #c62828;
    }
    .card-content {
      padding: 8px 0 16px;
    }
    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-bottom: 8px;
    }
    .add-card-btn {
      width: 100%;
      margin-top: 4px;
    }
  `],
})
export class CardTabsComponent {
  private readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;

  readonly cards = input.required<BingoCard[]>();
  readonly activeCardId = input<CardId | null>(null);
  readonly gameMode = input.required<GameMode>();
  readonly calledNumbers = input<number[]>([]);
  readonly winResults = input<Map<string, WinPattern[]>>(new Map());
  readonly enabledPatterns = input<WinPatternKind[]>([]);
  readonly cardSelected = output<CardId>();
  readonly addCard = output<void>();
  readonly deleteCard = output<CardId>();
  readonly resetCard = output<CardId>();
  readonly cellToggleOn = output<{ cardId: CardId; row: number; col: number }>();
  readonly numberChanged = output<{ cardId: CardId; row: number; col: number; newNumber: number }>();
  readonly cardRenamed = output<{ cardId: CardId; newCode: string }>();

  /** Per-card edit mode state */
  protected readonly editModes = signal<Record<string, boolean>>({});

  /** Inline rename state */
  protected readonly renamingCard = signal<CardId | null>(null);
  protected readonly renameDraft = signal<string>('');

  /**
   * Returns the best pattern progress for a card — picks the enabled pattern
   * with the highest completion percentage. Falls back to overall progress
   * if no patterns are enabled.
   */
  protected getBestProgress(card: BingoCard): { pct: number; label: string } {
    const enabled = this.enabledPatterns();
    if (enabled.length === 0) {
      // Fallback: overall non-free progress
      const cells = card.grid.filter(c => !c.isFree);
      const marked = cells.filter(c => c.isMarked).length;
      const pct = cells.length > 0 ? Math.round((marked / cells.length) * 100) : 0;
      return { pct, label: this.t()('card.marked') };
    }

    let bestKind: WinPatternKind = enabled[0]!;
    let bestPct = -1;

    for (const kind of enabled) {
      const pct = card.getPatternProgress(kind);
      if (pct > bestPct) {
        bestPct = pct;
        bestKind = kind;
      }
    }

    return { pct: bestPct, label: this.t()('pattern.' + bestKind) };
  }

  protected getProgressClass(pct: number): string {
    if (pct >= 100) return 'progress-complete';
    if (pct >= 75) return 'progress-high';
    if (pct >= 50) return 'progress-mid';
    return 'progress-low';
  }

  protected onCardSelected(id: CardId): void {
    this.cardSelected.emit(id);
  }

  protected onDeleteCard(id: CardId): void {
    if (confirm(this.t()('card.deleteConfirm'))) {
      this.deleteCard.emit(id);
    }
  }

  protected onResetCard(id: CardId): void {
    this.resetCard.emit(id);
  }

  protected onToggleEdit(id: CardId): void {
    this.editModes.update(modes => ({
      ...modes,
      [id]: !modes[id],
    }));
  }

  protected onCellToggled(cardId: CardId, event: { row: number; col: number }): void {
    this.cellToggleOn.emit({ cardId, ...event });
  }

  protected onNumberChanged(cardId: CardId, event: { row: number; col: number; newNumber: number }): void {
    this.numberChanged.emit({ cardId, ...event });
  }

  protected onRenameStart(id: CardId): void {
    const card = this.cards().find(c => c.id === id);
    if (!card) return;
    this.renamingCard.set(id);
    this.renameDraft.set(card.code);
    // Focus the input on next tick
    setTimeout(() => {
      const input = document.querySelector('.card-code-input') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected onRenameKeydown(event: KeyboardEvent, id: CardId): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.onRenameCommit(id);
    } else if (event.key === 'Escape') {
      this.renamingCard.set(null);
    }
  }

  protected onRenameCommit(id: CardId): void {
    const newCode = this.renameDraft().trim();
    if (newCode.length > 0) {
      this.cardRenamed.emit({ cardId: id, newCode });
    }
    this.renamingCard.set(null);
  }
}
