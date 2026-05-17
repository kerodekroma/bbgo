import type { BingoCard } from './bingo-card.entity';
import type { CardId } from './card-id.vo';

export interface CardRepository {
  findAll(): Promise<BingoCard[]>;
  findById(id: CardId): Promise<BingoCard | null>;
  save(card: BingoCard): Promise<void>;
  delete(id: CardId): Promise<void>;
  clearAll(): Promise<void>;
}
