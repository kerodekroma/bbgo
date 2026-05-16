import { Injectable, inject } from '@angular/core';
import type { CardRepository } from '../domain/card-repository.interface';
import type { BingoCard } from '../domain/bingo-card.entity';
import type { CardId } from '../domain/card-id.vo';
import { CardStorageService } from './card-storage.service';
import { domainToDto, dtoToDomain } from './dtos/bingo-card.dto';

@Injectable({ providedIn: 'root' })
export class CardRepositoryImpl implements CardRepository {
  private readonly storage = inject(CardStorageService);

  async findAll(): Promise<BingoCard[]> {
    const dtos = this.storage.getAll();
    return dtos.map(dto => dtoToDomain(dto));
  }

  async findById(id: CardId): Promise<BingoCard | null> {
    const dto = this.storage.getById(id);
    return dto ? dtoToDomain(dto) : null;
  }

  async save(card: BingoCard): Promise<void> {
    const dto = domainToDto(card);
    this.storage.save(dto);
  }

  async delete(id: CardId): Promise<void> {
    this.storage.delete(id);
  }
}
