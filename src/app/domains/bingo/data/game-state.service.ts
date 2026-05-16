import { Injectable } from '@angular/core';
import type { GameStateDto } from './dtos/game-state.dto';

const STORAGE_KEY = 'bbgo_game_state';

@Injectable({ providedIn: 'root' })
export class GameStateService {
  getState(): GameStateDto | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as GameStateDto) : null;
    } catch {
      return null;
    }
  }

  saveState(state: GameStateDto): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save game state:', e);
    }
  }

  clearState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear game state:', e);
    }
  }
}
