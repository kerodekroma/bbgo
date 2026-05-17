import { Injectable, inject, signal, computed } from '@angular/core';
import type { CardId } from '../domain/card-id.vo';
import { createCardId } from '../domain/card-id.vo';
import type { BingoCard } from '../domain/bingo-card.entity';
import type { WinPattern } from '../domain/win-pattern.type';
import type { PatternSettings } from '../domain/win-pattern.type';
import { DEFAULT_PATTERN_SETTINGS } from '../domain/win-pattern.type';
import type { WinPatternKind } from '../domain/win-pattern.type';
import type { GameMode } from '../domain/game-mode.type';
import type { GridCell } from '../domain/grid-cell.vo';
import type { Result } from '../domain/bingo-number.vo';
import type { DomainError } from '../domain/bingo-card.entity';
import { CardRepositoryImpl } from '../data/card-repository.impl';
import { GameStateService } from '../data/game-state.service';
import { OcrService } from '../data/ocr.service';
import type { OcrResult } from '../data/ocr.service';
import { generateCardCode } from '../../../shared/lib/number-utils';
import { BingoCard as BingoCardEntity } from '../domain/bingo-card.entity';

@Injectable({ providedIn: 'root' })
export class BingoFacade {
  private readonly repository = inject(CardRepositoryImpl);
  private readonly gameStateService = inject(GameStateService);
  private readonly ocrService = inject(OcrService);

  // --- State Signals ---
  private readonly cardsSignal = signal<BingoCard[]>([]);
  private readonly activeCardIdSignal = signal<CardId | null>(null);
  private readonly calledNumbersSignal = signal<number[]>([]);
  private readonly gameModeSignal = signal<GameMode>('caller');
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly patternSettingsSignal = signal<PatternSettings>(DEFAULT_PATTERN_SETTINGS);
  private readonly _dirtySignal = signal(false);

  // --- Public Readonly Signals ---
  readonly cards = this.cardsSignal.asReadonly();
  readonly activeCardId = this.activeCardIdSignal.asReadonly();
  readonly calledNumbers = this.calledNumbersSignal.asReadonly();
  readonly gameMode = this.gameModeSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly patternSettings = this.patternSettingsSignal.asReadonly();
  readonly dirty = this._dirtySignal.asReadonly();

  /** The currently active card (or null if none selected) */
  readonly activeCard = computed(() => {
    const id = this.activeCardIdSignal();
    return this.cardsSignal().find(c => c.id === id) ?? null;
  });

  /** Win results mapped by card ID — recomputed on every cards change, filtered by enabled patterns */
  readonly winResults = computed<Map<string, WinPattern[]>>(() => {
    const enabled = new Set<WinPatternKind>(this.patternSettingsSignal().enabled);
    const results = new Map<string, WinPattern[]>();
    for (const card of this.cardsSignal()) {
      let patterns = card.getWinPatterns();
      // Only include enabled patterns (multi-line and full-house are always shown if present)
      patterns = patterns.filter(p => p.kind === 'multi-line' || p.kind === 'full-house' || enabled.has(p.kind as WinPatternKind));
      if (patterns.length > 0) {
        results.set(card.id, patterns);
      }
    }
    return results;
  });

  /** True when all 75 numbers called with at least one winner */
  readonly isGameOver = computed(() => {
    return this.calledNumbersSignal().length >= 75;
  });

  /** True when any card has a winning pattern */
  readonly hasAnyWinner = computed(() => {
    return this.winResults().size > 0;
  });

  /** Last 15 called numbers (most recent first) for display */
  readonly recentCalledNumbers = computed(() => {
    return this.calledNumbersSignal().slice(-15).reverse();
  });

  // --- Actions ---

  /** Load all persisted data on app startup */
  async loadFromStorage(): Promise<void> {
    this.loadingSignal.set(true);
    try {
      const cards = await this.repository.findAll();
      this.cardsSignal.set(cards);

      const state = this.gameStateService.getState();
      if (state) {
        this.calledNumbersSignal.set(state.calledNumbers);
        this.gameModeSignal.set(state.gameMode as GameMode);
        if (state.patternSettings?.enabled) {
          this.patternSettingsSignal.set({
            enabled: state.patternSettings.enabled as WinPatternKind[],
          });
        }
      }

      // Auto-select first card if none active
      if (cards.length > 0 && !this.activeCardIdSignal()) {
        this.activeCardIdSignal.set(cards[0]!.id);
      }
    } catch (e) {
      this.errorSignal.set('Failed to load data from storage');
      console.error(e);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** Save current session to localStorage — cards, called numbers, game mode, and settings */
  saveSession(): void {
    // Clear all existing data then persist current state atomically
    this.repository.clearAll();
    this.saveCards(this.cardsSignal());
    this.saveGameState(
      this.calledNumbersSignal(),
      this.gameModeSignal(),
      this.patternSettingsSignal(),
    );
    this._dirtySignal.set(false);
  }

  /** Add a new card with manual grid entry */
  addCard(code: string | undefined, gridNumbers: readonly (readonly number[])[]): Result<CardId, DomainError> {
    const id = createCardId(crypto.randomUUID());
    const cardCode = code?.trim() || generateCardCode();

    const result = BingoCardEntity.create(id, cardCode, gridNumbers);
    if (!result.ok) return result;

    this.cardsSignal.update(cards => [...cards, result.value]);
    this.activeCardIdSignal.set(id);
    this.markDirty();
    return { ok: true, value: id };
  }

  /** Process OCR image and return extracted grid for user confirmation */
  async processOcrImage(file: File): Promise<OcrResult> {
    return this.ocrService.processImage(file);
  }

  /** Confirm and save a card from OCR results */
  addCardFromOcr(code: string, cells: GridCell[][]): Result<CardId, DomainError> {
    const gridNumbers: number[][] = cells.map(row =>
      row.map(c => c.number?.value ?? 0),
    );

    // Patch the FREE cell placeholder
    const patchedNumbers = gridNumbers.map((row, r) =>
      row.map((val, c) => (r === 2 && c === 2 ? 0 : val)),
    );

    return this.addCard(code, patchedNumbers);
  }

  /** Delete a card by ID */
  async deleteCard(id: CardId): Promise<void> {
    this.cardsSignal.update(cards => cards.filter(c => c.id !== id));
    this.markDirty();

    // If deleted the active card, switch to first remaining
    if (this.activeCardIdSignal() === id) {
      const remaining = this.cardsSignal();
      this.activeCardIdSignal.set(remaining.length > 0 ? remaining[0]!.id : null);
    }
  }

  /** Delete all cards */
  deleteAllCards(): void {
    this.cardsSignal.set([]);
    this.activeCardIdSignal.set(null);
    this.markDirty();
  }

  /** Call a number (caller mode) */
  callNumber(n: number): void {
    if (this.gameModeSignal() !== 'caller') return;

    // Block if all 75 numbers already called
    if (this.calledNumbersSignal().length >= 75) {
      this.setErrorWithAutoClear('All 75 numbers have been called. Start a new game.');
      return;
    }

    // Prevent duplicates
    if (this.calledNumbersSignal().includes(n)) {
      this.setErrorWithAutoClear(`Number ${n} has already been called`);
      return;
    }

    // Validate range
    if (n < 1 || n > 75) {
      this.setErrorWithAutoClear('Numbers must be between 1 and 75');
      return;
    }

    this.calledNumbersSignal.update(nums => [...nums, n]);

    // Mark the number on all cards
    this.cardsSignal.update(cards =>
      cards.map(card => {
        card.markNumber(n);
        return card; // BingoCard is mutable (entity pattern)
      }),
    );

    this.errorSignal.set(null);
    this.markDirty();
  }

  /** Void a previously called number — removes from history and unmarks cells */
  voidCalledNumber(n: number): void {
    const numbers = this.calledNumbersSignal();
    if (!numbers.includes(n)) return;

    // Remove from called list
    this.calledNumbersSignal.update(nums => nums.filter(v => v !== n));

    // Unmark the number on all cards
    this.cardsSignal.update(cards =>
      cards.map(card => {
        card.voidNumber(n);
        return card;
      }),
    );

    this.errorSignal.set(null);
    this.markDirty();
  }

  /** Toggle a cell on a specific card (card-only mode) */
  toggleCell(cardId: CardId, row: number, col: number): void {
    this.cardsSignal.update(cards =>
      cards.map(card => {
        if (card.id === cardId) {
          card.toggleCell(row, col);
        }
        return card;
      }),
    );
    this.markDirty();
  }

  /** Set game mode */
  setGameMode(mode: GameMode): void {
    this.gameModeSignal.set(mode);
    this.markDirty();
  }

  /** Update pattern settings — which win patterns are checked */
  setPatternSettings(settings: PatternSettings): void {
    this.patternSettingsSignal.set(settings);
    this.markDirty();
  }

  /** Select active card */
  selectCard(id: CardId): void {
    this.activeCardIdSignal.set(id);
  }

  /** Reset a single card — clears its marks only */
  resetCard(id: CardId): void {
    this.cardsSignal.update(cards =>
      cards.map(card => {
        if (card.id === id) card.resetGame();
        return card;
      }),
    );
    this.markDirty();
  }

  /** Change a number on a card (edit mode) */
  changeCardNumber(id: CardId, row: number, col: number, newNumber: number): void {
    this.cardsSignal.update(cards =>
      cards.map(card => {
        if (card.id === id) card.changeNumber(row, col, newNumber);
        return card;
      }),
    );
    this.markDirty();
  }

  /** Rename a card */
  renameCard(id: CardId, newCode: string): void {
    this.cardsSignal.update(cards =>
      cards.map(card => {
        if (card.id === id) card.rename(newCode);
        return card;
      }),
    );
    this.markDirty();
  }

  /** Reset game state — clears marks + called numbers, keeps cards */
  resetGame(): void {
    this.cardsSignal.update(cards => {
      cards.forEach(card => card.resetGame());
      return [...cards]; // trigger signal update
    });
    this.calledNumbersSignal.set([]);
    this.errorSignal.set(null);
    this.markDirty();
  }

  /** Clear error message */
  clearError(): void {
    this.errorSignal.set(null);
  }

  // --- Private Helpers ---

  /** Set an error message that auto-clears after 3 seconds */
  private setErrorWithAutoClear(message: string): void {
    this.errorSignal.set(message);
    setTimeout(() => {
      this.errorSignal.set(null);
    }, 3000);
  }

  private saveCards(cards: BingoCard[]): void {
    // Debounced save via effect
    for (const card of cards) {
      this.repository.save(card);
    }
  }

  private saveGameState(numbers: number[], mode: GameMode, settings: PatternSettings): void {
    this.gameStateService.saveState({
      calledNumbers: numbers,
      gameMode: mode,
      patternSettings: { enabled: settings.enabled },
    });
  }

  private markDirty(): void {
    this._dirtySignal.set(true);
  }
}
