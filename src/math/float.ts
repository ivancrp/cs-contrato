import type { ContractInput, SkinItem } from '../models/types';
import { floatToWear } from './wear';

/**
 * Calcula o float médio das entradas do contrato.
 * @param inputs - Lista de entradas (10 skins)
 */
export function calculateAverageInputFloat(inputs: ContractInput[]): number {
  if (inputs.length === 0) return 0;
  const sum = inputs.reduce((acc, input) => acc + input.listing.float, 0);
  return sum / inputs.length;
}

/**
 * Fórmula oficial do CS2 para float de saída:
 * OutputFloat = MinFloat + (MediaFloatEntradas × (MaxFloat - MinFloat))
 *
 * @param averageInputFloat - Média dos floats de entrada
 * @param outputSkin - Skin de saída
 */
export function calculateOutputFloat(
  averageInputFloat: number,
  outputSkin: SkinItem,
): number {
  const range = outputSkin.maxFloat - outputSkin.minFloat;
  const result =
    outputSkin.minFloat + averageInputFloat * range;
  return Math.min(Math.max(result, outputSkin.minFloat), outputSkin.maxFloat);
}

/**
 * Calcula float esperado para uma skin de saída dado o contrato.
 */
export function calculateExpectedFloatForOutput(
  inputs: ContractInput[],
  outputSkin: SkinItem,
): number {
  const avgFloat = calculateAverageInputFloat(inputs);
  return calculateOutputFloat(avgFloat, outputSkin);
}

/**
 * Float mínimo e máximo possíveis para uma saída dado o range das entradas.
 */
export function calculateOutputFloatRange(
  inputs: ContractInput[],
  outputSkin: SkinItem,
): { min: number; max: number } {
  const inputFloats = inputs.map((i) => i.listing.float);
  const minInput = Math.min(...inputFloats);
  const maxInput = Math.max(...inputFloats);
  return {
    min: calculateOutputFloat(minInput, outputSkin),
    max: calculateOutputFloat(maxInput, outputSkin),
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
  const expected = calculateOutputFloat(avg, targetSkin);
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
