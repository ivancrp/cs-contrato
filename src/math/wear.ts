import type { WearTier } from '../models/types';

/** Limites oficiais de wear do CS2 */
export const WEAR_BOUNDS: Record<WearTier, { min: number; max: number }> = {
  'Factory New': { min: 0, max: 0.07 },
  'Minimal Wear': { min: 0.07, max: 0.15 },
  'Field-Tested': { min: 0.15, max: 0.38 },
  'Well-Worn': { min: 0.38, max: 0.45 },
  'Battle-Scarred': { min: 0.45, max: 1 },
};

/**
 * Determina o tier de wear a partir do float.
 * @param float - Float value entre 0 e 1
 */
export function floatToWear(float: number): WearTier {
  if (float < 0.07) return 'Factory New';
  if (float < 0.15) return 'Minimal Wear';
  if (float < 0.38) return 'Field-Tested';
  if (float < 0.45) return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Verifica se o float está dentro do wear desejado.
 */
export function isFloatInWear(float: number, wear: WearTier): boolean {
  const bounds = WEAR_BOUNDS[wear];
  return float >= bounds.min && float <= bounds.max;
}

/**
 * Calcula o float máximo de entrada necessário para atingir um float de saída alvo.
 * Derivado da fórmula oficial invertida.
 */
export function maxInputFloatForTarget(
  targetOutputFloat: number,
  skinMinFloat: number,
  skinMaxFloat: number,
): number {
  const range = skinMaxFloat - skinMinFloat;
  if (range <= 0) return 0;
  return (targetOutputFloat - skinMinFloat) / range;
}
