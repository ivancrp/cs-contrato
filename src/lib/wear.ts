import type { WearTier } from '@ct/types';

const WEAR_BOUNDS: Record<WearTier, { min: number; max: number }> = {
  'Factory New': { min: 0, max: 0.07 },
  'Minimal Wear': { min: 0.07, max: 0.15 },
  'Field-Tested': { min: 0.15, max: 0.38 },
  'Well-Worn': { min: 0.38, max: 0.45 },
  'Battle-Scarred': { min: 0.45, max: 1 },
};

const WEAR_PRIORITY: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

export const WEAR_LABELS: Record<WearTier, string> = {
  'Factory New': 'Factory New (FN)',
  'Minimal Wear': 'Minimal Wear (MW)',
  'Field-Tested': 'Field-Tested (FT)',
  'Well-Worn': 'Well-Worn (WW)',
  'Battle-Scarred': 'Battle-Scarred (BS)',
};

export function getWearTiersForSkin(minFloat: number, maxFloat: number): WearTier[] {
  return (Object.keys(WEAR_BOUNDS) as WearTier[]).filter((wear) => {
    const bounds = WEAR_BOUNDS[wear];
    return bounds.min <= maxFloat && bounds.max >= minFloat;
  });
}

export function defaultWearForSkin(minFloat: number, maxFloat: number): WearTier {
  const valid = getWearTiersForSkin(minFloat, maxFloat);
  return WEAR_PRIORITY.find((wear) => valid.includes(wear)) ?? valid[0] ?? 'Factory New';
}

export function isWearValidForSkin(minFloat: number, maxFloat: number, wear: WearTier): boolean {
  return getWearTiersForSkin(minFloat, maxFloat).includes(wear);
}
