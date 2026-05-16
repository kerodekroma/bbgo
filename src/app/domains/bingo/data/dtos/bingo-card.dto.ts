import type { BingoCard } from '../../domain/bingo-card.entity';
import { BingoCard as BingoCardEntity } from '../../domain/bingo-card.entity';

export interface GridCellDto {
  row: number;
  col: number;
  value: number | null;
  column: string | null;
  isMarked: boolean;
  isFree: boolean;
}

export interface BingoCardDto {
  id: string;
  code: string;
  createdAt: string;
  grid: GridCellDto[];
}

export function domainToDto(card: BingoCard): BingoCardDto {
  return card.toJSON();
}

export function dtoToDomain(dto: BingoCardDto): BingoCard {
  return BingoCardEntity.fromJSON(dto);
}
