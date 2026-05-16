import { Injectable } from '@angular/core';
import type { BingoCardDto } from './dtos/bingo-card.dto';

const STORAGE_KEY_PREFIX = 'bbgo_card_';

@Injectable({ providedIn: 'root' })
export class CardStorageService {
  getAll(): BingoCardDto[] {
    try {
      const cards: BingoCardDto[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as BingoCardDto;
            cards.push(parsed);
          }
        }
      }
      return cards;
    } catch {
      return [];
    }
  }

  getById(id: string): BingoCardDto | null {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
      return raw ? (JSON.parse(raw) as BingoCardDto) : null;
    } catch {
      return null;
    }
  }

  save(card: BingoCardDto): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${card.id}`, JSON.stringify(card));
    } catch (e) {
      console.error('Failed to save card to localStorage:', e);
    }
  }

  delete(id: string): void {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    } catch (e) {
      console.error('Failed to delete card from localStorage:', e);
    }
  }

  clearAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error('Failed to clear cards from localStorage:', e);
    }
  }
}
