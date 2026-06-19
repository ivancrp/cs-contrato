import type { ContractInput, FloatMetrics, SkinItem, WearTier } from '@ct/types';
import {
  calculateAverageInputFloat,
  calculateAverageNormalizedFloat,
  calculateOutputFloat,
} from './float-engine.js';

/** Limites oficiais de wear CS2 (limite superior inclusivo por tier) */
export const WEAR_BOUNDS: Record<WearTier, { min: number; max: number }> = {
  'Factory New': { min: 0, max: 0.07 },
  'Minimal Wear': { min: 0.07, max: 0.15 },
  'Field-Tested': { min: 0.15, max: 0.38 },
  'Well-Worn': { min: 0.38, max: 0.45 },
  'Battle-Scarred': { min: 0.45, max: 1 },
};

export function floatToWear(float: number): WearTier {
  const value = Math.min(Math.max(float, 0), 1);
  if (value <= WEAR_BOUNDS['Factory New'].max) return 'Factory New';
  if (value <= WEAR_BOUNDS['Minimal Wear'].max) return 'Minimal Wear';
  if (value <= WEAR_BOUNDS['Field-Tested'].max) return 'Field-Tested';
  if (value <= WEAR_BOUNDS['Well-Worn'].max) return 'Well-Worn';
  return 'Battle-Scarred';
}

export function wearToMaxFloat(wear: WearTier): number {
  return WEAR_BOUNDS[wear].max;
}

export function getWearTiersInRange(minFloat: number, maxFloat: number): WearTier[] {
  const tiers = Object.keys(WEAR_BOUNDS) as WearTier[];
  return tiers.filter((wear) => {
    const bounds = WEAR_BOUNDS[wear];
    return bounds.min <= maxFloat && bounds.max >= minFloat;
  });
}

export function getWearTiersForSkin(skin: Pick<SkinItem, 'minFloat' | 'maxFloat'>): WearTier[] {
  return getWearTiersInRange(skin.minFloat, skin.maxFloat);
}

export function isWearValidForSkin(
  skin: Pick<SkinItem, 'minFloat' | 'maxFloat'>,
  wear: WearTier,
): boolean {
  return getWearTiersForSkin(skin).includes(wear);
}

const WEAR_PRIORITY: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

/** Melhor wear que a skin pode ter (prioriza FN). */
export function defaultWearForSkin(skin: Pick<SkinItem, 'minFloat' | 'maxFloat'>): WearTier {
  const valid = getWearTiersForSkin(skin);
  return WEAR_PRIORITY.find((wear) => valid.includes(wear)) ?? floatToWear(skin.maxFloat);
}

export function resolveTargetMaxFloat(
  skin: Pick<SkinItem, 'minFloat' | 'maxFloat'>,
  wear: WearTier,
): number {
  return Math.min(wearToMaxFloat(wear), skin.maxFloat);
}

export function requiredNormalizedWear(targetOutputFloat: number, outputSkin: SkinItem): number {
  const range = outputSkin.maxFloat - outputSkin.minFloat;
  if (range <= 0) return 0;
  return Math.min(Math.max((targetOutputFloat - outputSkin.minFloat) / range, 0), 1);
}

/** Float máximo de entrada para não ultrapassar desgaste alvo na saída */
export function maxInputFloatForTargetOutput(
  targetOutputFloat: number,
  inputSkin: SkinItem,
  outputSkin: SkinItem,
): number {
  const requiredNorm = requiredNormalizedWear(targetOutputFloat, outputSkin);
  const inputRange = inputSkin.maxFloat - inputSkin.minFloat;
  return inputSkin.minFloat + requiredNorm * inputRange;
}

/** Float necessário na saída para atingir cada tier de wear */
export function calculateWearTargetFloats(outputSkin: SkinItem): Record<WearTier, number> {
  const result = {} as Record<WearTier, number>;
  for (const [wear, bounds] of Object.entries(WEAR_BOUNDS) as [WearTier, { max: number }][]) {
    result[wear] = calculateOutputFloat(
      requiredNormalizedWear(bounds.max, outputSkin),
      outputSkin,
    );
  }
  return result;
}

export function calculateFloatMetrics(
  inputs: ContractInput[],
  targetSkin: SkinItem,
): FloatMetrics {
  const avg = calculateAverageInputFloat(inputs);
  const avgNormalized = calculateAverageNormalizedFloat(inputs);
  const expected = calculateOutputFloat(avgNormalized, targetSkin);
  const wearTargets = calculateWearTargetFloats(targetSkin);

  return {
    averageInputFloat: avg,
    averageNormalizedFloat: avgNormalized,
    expectedOutputFloat: expected,
    expectedWear: floatToWear(expected),
    minPossibleFloat: calculateOutputFloat(0, targetSkin),
    maxPossibleFloat: calculateOutputFloat(1, targetSkin),
    floatForFN: wearTargets['Factory New'],
    floatForMW: wearTargets['Minimal Wear'],
    floatForFT: wearTargets['Field-Tested'],
    floatForWW: wearTargets['Well-Worn'],
    floatForBS: wearTargets['Battle-Scarred'],
  };
}
