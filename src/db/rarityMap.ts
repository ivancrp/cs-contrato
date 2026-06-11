import type { Rarity } from '../models/types';

const RARITY_BY_API_ID: Record<string, Rarity> = {
  rarity_common_weapon: 'consumer',
  rarity_uncommon_weapon: 'industrial',
  rarity_rare_weapon: 'mil-spec',
  rarity_mythical_weapon: 'restricted',
  rarity_legendary_weapon: 'classified',
  rarity_ancient_weapon: 'covert',
  rarity_contraband_weapon: 'extraordinary',
};

export function mapApiRarity(rarityId?: string, rarityName?: string): Rarity {
  if (rarityId && RARITY_BY_API_ID[rarityId]) {
    return RARITY_BY_API_ID[rarityId];
  }

  const normalized = (rarityName ?? '').toLowerCase();
  if (normalized.includes('consumer')) return 'consumer';
  if (normalized.includes('industrial')) return 'industrial';
  if (normalized.includes('mil-spec')) return 'mil-spec';
  if (normalized.includes('restricted')) return 'restricted';
  if (normalized.includes('classified')) return 'classified';
  if (normalized.includes('covert')) return 'covert';
  if (normalized.includes('extraordinary') || normalized.includes('contraband')) {
    return 'extraordinary';
  }

  return 'mil-spec';
}
