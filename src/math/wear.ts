import type { WearTier } from '../models/types';

/** Limites oficiais de wear do CS2 (limite superior inclusivo por tier). */
export const WEAR_BOUNDS: Record<WearTier, { min: number; max: number }> = {
  'Factory New': { min: 0, max: 0.07 },
  'Minimal Wear': { min: 0.07, max: 0.15 },
  'Field-Tested': { min: 0.15, max: 0.38 },
  'Well-Worn': { min: 0.38, max: 0.45 },
  'Battle-Scarred': { min: 0.45, max: 1 },
};

/**
 * Determina o tier de wear a partir do float.
 * Factory New inclui o limite superior 0.07 (padrão Steam / filtro FN).
 */
export function floatToWear(float: number): WearTier {
  const value = Math.min(Math.max(float, 0), 1);

  if (value <= WEAR_BOUNDS['Factory New'].max) return 'Factory New';
  if (value <= WEAR_BOUNDS['Minimal Wear'].max) return 'Minimal Wear';
  if (value <= WEAR_BOUNDS['Field-Tested'].max) return 'Field-Tested';
  if (value <= WEAR_BOUNDS['Well-Worn'].max) return 'Well-Worn';
  return 'Battle-Scarred';
}

/**
 * Verifica se o float está dentro do wear desejado.
 */
export function isFloatInWear(float: number, wear: WearTier): boolean {
  return floatToWear(float) === wear;
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
