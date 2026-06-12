import type { ContractInput, SkinItem } from '../models/types';
import { floatToWear } from './wear';

/** Skin com range de float completo (0 → 1). */
export function hasFullFloatRange(skin: SkinItem): boolean {
  return skin.minFloat <= 0.001 && skin.maxFloat >= 0.99;
}

/**
 * Normaliza o float absoluto para wear factor (0–1) dentro do range da skin.
 */
export function normalizeFloat(float: number, skin: SkinItem): number {
  const range = skin.maxFloat - skin.minFloat;
  if (range <= 0) return 0;
  return Math.min(Math.max((float - skin.minFloat) / range, 0), 1);
}

/**
 * Converte wear factor normalizado em float absoluto da skin.
 */
export function denormalizeFloat(normalized: number, skin: SkinItem): number {
  const range = skin.maxFloat - skin.minFloat;
  const value = skin.minFloat + normalized * range;
  return Math.min(Math.max(value, skin.minFloat), skin.maxFloat);
}

/**
 * Calcula o float médio absoluto das entradas (exibição).
 */
export function calculateAverageInputFloat(inputs: ContractInput[]): number {
  if (inputs.length === 0) return 0;
  const sum = inputs.reduce((acc, input) => acc + input.listing.float, 0);
  return sum / inputs.length;
}

/**
 * Média dos wears normalizados — base da fórmula oficial do CS2.
 */
export function calculateAverageNormalizedFloat(inputs: ContractInput[]): number {
  if (inputs.length === 0) return 0;
  const sum = inputs.reduce(
    (acc, input) => acc + normalizeFloat(input.listing.float, input.item),
    0,
  );
  return sum / inputs.length;
}

/**
 * Fórmula oficial do CS2 para float de saída:
 * OutputFloat = MinFloat + (MédiaWearNormalizado × (MaxFloat - MinFloat))
 */
export function calculateOutputFloat(
  averageNormalizedFloat: number,
  outputSkin: SkinItem,
): number {
  const range = outputSkin.maxFloat - outputSkin.minFloat;
  const result = outputSkin.minFloat + averageNormalizedFloat * range;
  return Math.min(Math.max(result, outputSkin.minFloat), outputSkin.maxFloat);
}

/**
 * Calcula float esperado para uma skin de saída dado o contrato.
 */
export function calculateExpectedFloatForOutput(
  inputs: ContractInput[],
  outputSkin: SkinItem,
): number {
  const avgNormalized = calculateAverageNormalizedFloat(inputs);
  return calculateOutputFloat(avgNormalized, outputSkin);
}

/**
 * Float mínimo e máximo possíveis para uma saída dado o range das entradas.
 */
export function calculateOutputFloatRange(
  inputs: ContractInput[],
  outputSkin: SkinItem,
): { min: number; max: number } {
  const normalized = inputs.map((i) => normalizeFloat(i.listing.float, i.item));
  const minNorm = Math.min(...normalized);
  const maxNorm = Math.max(...normalized);
  return {
    min: calculateOutputFloat(minNorm, outputSkin),
    max: calculateOutputFloat(maxNorm, outputSkin),
  };
}

/**
 * Métricas agregadas de float para o contrato em relação à skin alvo.
 */
export function calculateFloatMetrics(
  inputs: ContractInput[],
  targetSkin: SkinItem,
) {
  const avg = calculateAverageInputFloat(inputs);
  const avgNormalized = calculateAverageNormalizedFloat(inputs);
  const expected = calculateOutputFloat(avgNormalized, targetSkin);
  const minPossible = calculateOutputFloat(0, targetSkin);
  const maxPossible = calculateOutputFloat(1, targetSkin);

  return {
    averageInputFloat: avg,
    expectedOutputFloat: expected,
    expectedWear: floatToWear(expected),
    minPossibleFloat: minPossible,
    maxPossibleFloat: maxPossible,
  };
}
