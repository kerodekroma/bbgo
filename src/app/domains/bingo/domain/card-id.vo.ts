export type CardId = string & { readonly __brand: 'CardId' };

export function createCardId(id: string): CardId {
  return id as CardId;
}
