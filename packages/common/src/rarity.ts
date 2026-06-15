import type { Rarity } from '@ct/types';

/** Ordem crescente de raridade CS2 */
export const RARITY_ORDER: Rarity[] = [
  'consumer',
  'industrial',
  'mil-spec',
  'restricted',
  'classified',
  'covert',
  'extraordinary',
];

export function getRarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

/**
 * Retorna raridade deslocada por offset de tier.
 * offset -1 = um tier abaixo (entrada para trade up de armas CS2).
 */
export function getRarityByOffset(rarity: Rarity, offset: number): Rarity | null {
  const index = getRarityIndex(rarity) + offset;
  if (index < 0 || index >= RARITY_ORDER.length) return null;
  return RARITY_ORDER[index];
}

export function getNextRarity(rarity: Rarity, direction: 1 | -1): Rarity | null {
  return getRarityByOffset(rarity, direction);
}
