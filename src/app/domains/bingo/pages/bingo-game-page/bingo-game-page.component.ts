import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import type { CardId } from '../../domain/card-id.vo';
import type { WinPattern } from '../../domain/win-pattern.type';
import { BingoFacade } from '../../application/bingo.facade';
import { APP_VERSION } from '../../../../shared/lib/version';
import { LanguageService } from '../../../../shared/i18n/language.service';
import { NumberCallerComponent } from '../../ui/number-caller/number-caller.component';
import { NumberBoardComponent } from '../../ui/number-board/number-board.component';
import { CardTabsComponent } from '../../ui/card-tabs/card-tabs.component';
import { AddCardDialogComponent } from '../../ui/add-card-dialog/add-card-dialog.component';
import { SettingsDialogComponent } from '../../ui/settings-dialog/settings-dialog.component';
import { ClearDialogComponent } from '../../ui/clear-dialog/clear-dialog.component';
import type { ClearDialogResult } from '../../ui/clear-dialog/clear-dialog.component';

interface WinEntry {
  cardId: string;
  cardCode: string;
  patterns: WinPattern[];
}

@Component({
  selector: 'app-bingo-game-page',
  standalone: true,
  imports: [
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatButtonToggleModule,
    NumberCallerComponent,
    NumberBoardComponent,
    CardTabsComponent,
  ],
  template: `
    <div class="game-page">
      <header class="game-header">
        <h1 class="game-title">
          <mat-icon class="title-icon">casino</mat-icon>
          {{ t()('app.title') }}
          <span class="version-badge">{{ t()('app.version', { version: APP_VERSION }) }}</span>
        </h1>
        <div class="header-actions">
          <button
            mat-stroked-button
            class="save-btn"
            (click)="onSaveSession()"
            [disabled]="!facade.dirty()"
            type="button"
          >
            <mat-icon class="save-btn-icon">{{ facade.dirty() ? 'save' : 'cloud_done' }}</mat-icon>
            <span class="save-btn-label">{{ facade.dirty() ? t()('app.saveSession') : t()('app.saved') }}</span>
          </button>

          <div class="desktop-buttons">
            <button
              mat-icon-button
              class="clear-btn"
              (click)="onOpenClearDialog()"
              [attr.aria-label]="t()('app.clearData')"
              type="button"
            >
              <mat-icon>delete_sweep</mat-icon>
            </button>
            <button
              mat-icon-button
              class="settings-btn"
              (click)="onOpenSettings()"
              [attr.aria-label]="t()('app.patternSettings')"
              type="button"
            >
              <mat-icon>tune</mat-icon>
            </button>
            <button
              mat-icon-button
              class="language-btn"
              (click)="onSwitchLanguage()"
              [attr.aria-label]="t()('app.switchLanguage')"
              type="button"
            >
              <mat-icon>translate</mat-icon>
            </button>
          </div>

          <button
            mat-icon-button
            class="mobile-menu-btn"
            [matMenuTriggerFor]="headerMenu"
            [attr.aria-label]="t()('app.more')"
            type="button"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #headerMenu="matMenu" xPosition="before">
            <button mat-menu-item (click)="onSwitchLanguage()">
              <mat-icon>translate</mat-icon>
              <span>{{ t()('app.switchLanguage') }}</span>
              <span class="menu-locale-hint">{{ locale() === 'es' ? 'EN' : 'ES' }}</span>
            </button>
            <button mat-menu-item (click)="onOpenSettings()">
              <mat-icon>tune</mat-icon>
              <span>{{ t()('app.patternSettings') }}</span>
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item class="menu-clear-btn" (click)="onOpenClearDialog()">
              <mat-icon color="warn">delete_sweep</mat-icon>
              <span class="menu-clear-text">{{ t()('app.clearData') }}</span>
            </button>
          </mat-menu>
        </div>
      </header>

      @if (winEntries().length > 0) {
        <div class="win-banner">
          @for (win of winEntries(); track win.cardId) {
            <div class="win-item">
              <mat-icon class="win-icon">emoji_events</mat-icon>
              <span>
                <strong>{{ win.cardCode }}</strong> — {{ formatWinPatterns(win.patterns) }}
              </span>
            </div>
          }
        </div>
      }

      @if (facade.isGameOver() && !facade.hasAnyWinner()) {
        <div class="gameover-banner">
          <mat-icon>info</mat-icon>
          <span>All 75 numbers called — no winner. <button mat-button color="warn" (click)="onReset()">New Game</button></span>
        </div>
      }

      <main class="game-content">
        <div class="caller-section">
          <div class="caller-toggle">
            <mat-button-toggle-group
              [value]="showBoard() ? 'board' : 'caller'"
              (change)="onToggleView($event.value)"
              appearance="standard"
            >
              <mat-button-toggle value="caller">
                <mat-icon>mic</mat-icon>
                Caller
              </mat-button-toggle>
              <mat-button-toggle value="board">
                <mat-icon>grid_on</mat-icon>
                Board
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          @if (!showBoard()) {
            <app-number-caller
              [calledNumbers]="facade.calledNumbers()"
              [recentCalledNumbers]="facade.recentCalledNumbers()"
              [gameMode]="facade.gameMode()"
              [errorMessage]="facade.error()"
              (numberCalled)="onNumberCalled($event)"
              (numberVoided)="onNumberVoided($event)"
              (gameModeChanged)="onGameModeChanged($event)"
              (resetRequested)="onReset()"
            />
          } @else {
            <app-number-board
              [calledNumbers]="facade.calledNumbers()"
              (numberToggled)="onBoardToggle($event)"
            />
          }
        </div>

        <app-card-tabs
          [cards]="facade.cards()"
          [activeCardId]="facade.activeCardId()"
          [gameMode]="facade.gameMode()"
          [calledNumbers]="facade.calledNumbers()"
          [winResults]="facade.winResults()"
          [enabledPatterns]="facade.patternSettings().enabled"
          [fulfillAll]="facade.patternSettings().fulfillAll"
          (cardSelected)="onCardSelected($event)"
          (addCard)="onAddCard()"
          (deleteCard)="onDeleteCard($event)"
          (resetCard)="onResetCard($event)"
          (cellToggleOn)="onCellToggle($event)"
          (numberChanged)="onNumberChanged($event)"
          (cardRenamed)="onCardRenamed($event)"
        />
      </main>
    </div>
  `,
  styles: [`
    .game-page { max-width: 600px; margin: 0 auto; padding: 16px; min-height: 100vh; }
    .game-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 8px; }
    .game-title {
      font-size: 1.8rem; font-weight: 800; color: var(--bingo-header-bg);
      margin: 0; display: flex; align-items: center;
      gap: 8px; letter-spacing: 4px; flex-shrink: 0;
    }
    .title-icon { font-size: 32px; width: 32px; height: 32px; }
    .version-badge {
      font-size: 0.65rem; font-weight: 600; letter-spacing: 1px;
      color: #999; align-self: flex-end; margin-bottom: 3px;
    }
    .header-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .desktop-buttons { display: flex; align-items: center; gap: 4px; }
    .mobile-menu-btn { display: none; }
    .menu-locale-hint { margin-left: auto; font-size: 0.75rem; color: #999; font-weight: 600; }
    .menu-clear-text { color: #d32f2f; }
    .save-btn { height: 36px; font-size: 0.8rem; border-radius: 18px; padding: 0 12px; display: flex; align-items: center; justify-content: center; }
    .save-btn ::ng-deep .mdc-button__label { display: flex; align-items: center; justify-content: center; gap: 4px; }
    .save-btn-icon { font-size: 16px; width: 16px; height: 16px; line-height: 1; vertical-align: middle; }
    .save-btn-label { display: inline; }
    .clear-btn { color: #999; }
    .clear-btn:hover { color: #d32f2f; }
    .game-content { display: flex; flex-direction: column; gap: 16px; }
    .caller-section { display: flex; flex-direction: column; gap: 8px; }
    .caller-toggle { display: flex; justify-content: center; }
    .caller-toggle ::ng-deep .mat-button-toggle-group {
      border-radius: 8px;
      overflow: hidden;
    }
    .caller-toggle ::ng-deep .mat-button-toggle {
      font-size: 0.85rem;
    }
    .caller-toggle ::ng-deep .mat-button-toggle .mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
    }
    .win-banner {
      background: linear-gradient(135deg, #ffd700, #ffed4a);
      border-radius: 8px; padding: 12px 16px;
      box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
      animation: slideDown 0.3s ease-out;
    }
    .win-item { display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 500; }
    .win-item + .win-item { margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.1); }
    .win-icon { color: #c8a415; }
    .gameover-banner {
      background: #e3f2fd; border-radius: 8px; padding: 12px 16px;
      display: flex; align-items: center; gap: 8px; font-weight: 500;
      animation: slideDown 0.3s ease-out;
    }
    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (max-width: 520px) {
      .game-title { font-size: 1.3rem; letter-spacing: 2px; gap: 4px; }
      .title-icon { font-size: 24px; width: 24px; height: 24px; }
      .version-badge { font-size: 0.55rem; margin-bottom: 2px; }
      .save-btn-label { display: none; }
      .save-btn { min-width: 36px; width: 36px; height: 36px; padding: 0; border-radius: 50%; }
      .save-btn .save-btn-icon { margin: 0; }
      .desktop-buttons { display: none; }
      .mobile-menu-btn { display: inline-flex; }
      .header-actions { gap: 2px; }
    }
    @media (max-width: 380px) {
      .game-title { font-size: 1.0rem; letter-spacing: 1px; }
      .title-icon { font-size: 20px; width: 20px; height: 20px; }
      .game-header { gap: 4px; }
      .game-page { padding: 6px; }
    }
  `],
})
export class BingoGamePageComponent {
  protected readonly facade = inject(BingoFacade);
  protected readonly i18n = inject(LanguageService);
  protected readonly t = this.i18n.t;
  protected readonly locale = this.i18n.locale;
  protected readonly APP_VERSION = APP_VERSION;
  private readonly dialog = inject(MatDialog);

  /** Toggle between caller input and master board view */
  protected readonly showBoard = signal(false);

  protected readonly winEntries = computed<WinEntry[]>(() => {
    const results = this.facade.winResults();
    const cards = this.facade.cards();
    const entries: WinEntry[] = [];
    for (const [cardId, patterns] of results) {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        entries.push({ cardId, cardCode: card.code, patterns });
      }
    }
    return entries;
  });

  constructor() {
    this.facade.loadFromStorage();
  }

  /** Auto-save session when the user closes or reloads the tab */
  @HostListener('window.beforeunload')
  protected onBeforeUnload(): void {
    if (this.facade.dirty()) {
      this.facade.saveSession();
    }
  }

  protected formatWinPatterns(patterns: WinPattern[]): string {
    return patterns.map(p => p.description).join(', ');
  }

  protected onSaveSession(): void {
    this.facade.saveSession();
  }

  protected onToggleView(value: 'caller' | 'board'): void {
    this.showBoard.set(value === 'board');
  }

  protected onNumberCalled(n: number): void {
    this.facade.callNumber(n);
  }

  protected onNumberVoided(n: number): void {
    this.facade.voidCalledNumber(n);
  }

  protected onBoardToggle(n: number): void {
    if (this.facade.calledNumbers().includes(n)) {
      this.facade.voidCalledNumber(n);
    } else {
      this.facade.callNumber(n);
    }
  }

  protected async onOpenClearDialog(): Promise<void> {
    const result = await this.dialog.open(ClearDialogComponent, {
      width: '400px',
    }).afterClosed().toPromise() as ClearDialogResult | undefined;

    if (!result) return; // cancelled

    if (result.resetGame) {
      this.facade.resetGame();
    }
    if (result.deleteCards) {
      this.facade.deleteAllCards();
    }

    // Persist the cleared state to localStorage immediately
    this.facade.saveSession();
  }

  protected onOpenSettings(): void {
    this.dialog.open(SettingsDialogComponent, {
      width: '400px',
    });
  }

  protected onSwitchLanguage(): void {
    this.i18n.switchLanguage(this.locale() === 'en' ? 'es' : 'en');
  }

  protected onGameModeChanged(mode: 'caller' | 'card-only'): void {
    this.facade.setGameMode(mode);
  }

  protected onReset(): void {
    this.facade.resetGame();
  }

  protected onCardSelected(id: CardId): void {
    this.facade.selectCard(id);
  }

  protected onAddCard(): void {
    this.dialog.open(AddCardDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
    });
  }

  protected onDeleteCard(id: CardId): void {
    this.facade.deleteCard(id);
  }

  protected onResetCard(id: CardId): void {
    this.facade.resetCard(id);
  }

  protected onCellToggle(event: { cardId: CardId; row: number; col: number }): void {
    this.facade.toggleCell(event.cardId, event.row, event.col);
  }

  protected onNumberChanged(event: { cardId: CardId; row: number; col: number; newNumber: number }): void {
    this.facade.changeCardNumber(event.cardId, event.row, event.col, event.newNumber);
  }

  protected onCardRenamed(event: { cardId: CardId; newCode: string }): void {
    this.facade.renameCard(event.cardId, event.newCode);
  }
}
