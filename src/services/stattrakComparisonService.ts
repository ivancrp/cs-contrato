import { getAllSkins } from '../data/collections';
import type { Rarity, WearTier } from '../models/types';
import { priceService } from './priceService';

const WEAR_TIERS: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

export interface StatTrakComparison {
  skinName: string;
  wear: WearTier;
  rarity: Rarity;
  normalPrice: number;
  stattrakPrice: number;
  /** Positivo quando StatTrak é mais barato que a versão normal. */
  savings: number;
  savingsPercent: number;
  stattrakCheaper: boolean;
}

function getStatTrakEligibleSkins() {
  const all = getAllSkins();
  const namesWithStatTrak = new Set(all.filter((skin) => skin.stattrak).map((skin) => skin.name));
  return all.filter((skin) => !skin.stattrak && namesWithStatTrak.has(skin.name));
}

export function buildStatTrakComparisons(): StatTrakComparison[] {
  const comparisons: StatTrakComparison[] = [];

  for (const skin of getStatTrakEligibleSkins()) {
    for (const wear of WEAR_TIERS) {
      const normalPrice = priceService.getPriceSync(skin.name, false, wear);
      const stattrakPrice = priceService.getPriceSync(skin.name, true, wear);

      if (normalPrice <= 0 || stattrakPrice <= 0) continue;

      const savings = normalPrice - stattrakPrice;
      const savingsPercent = (savings / normalPrice) * 100;

      comparisons.push({
        skinName: skin.name,
        wear,
        rarity: skin.rarity,
        normalPrice,
        stattrakPrice,
        savings,
        savingsPercent,
        stattrakCheaper: savings > 0,
      });
    }
  }

  return comparisons;
}

export function getStatTrakDeals(comparisons: StatTrakComparison[]): StatTrakComparison[] {
  return comparisons
    .filter((row) => row.stattrakCheaper)
    .sort((a, b) => b.savingsPercent - a.savingsPercent);
}

export { WEAR_TIERS };
