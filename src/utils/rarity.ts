import type { Rarity } from '../models/types';

export const RARITY_ORDER: Rarity[] = [
  'consumer',
  'industrial',
  'mil-spec',
  'restricted',
  'classified',
  'covert',
  'extraordinary',
];

const RARITY_LABELS: Record<Rarity, string> = {
  consumer: 'Consumer Grade',
  industrial: 'Industrial Grade',
  'mil-spec': 'Mil-Spec',
  restricted: 'Restricted',
  classified: 'Classified',
  covert: 'Covert',
  extraordinary: 'Extraordinary',
};

/**
 * Retorna raridade adjacente (direction: 1 = próximo tier, -1 = tier anterior).
 */
export function getNextRarity(rarity: Rarity, direction: 1 | -1): Rarity | null {
  const index = RARITY_ORDER.indexOf(rarity);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= RARITY_ORDER.length) return null;
  return RARITY_ORDER[nextIndex];
}

export function getRarityLabel(rarity: Rarity): string {
  return RARITY_LABELS[rarity];
}

export function getRarityColor(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    consumer: '#b0c3d9',
    industrial: '#5e98d9',
    'mil-spec': '#4b69ff',
    restricted: '#8847ff',
    classified: '#d32ce6',
    covert: '#eb4b4b',
    extraordinary: '#e4ae39',
  };
  return colors[rarity];
}
