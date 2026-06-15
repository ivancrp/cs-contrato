import { clamp } from '@ct/common';
import type { ContractInput, SkinItem } from '@ct/types';

/**
 * Normaliza float absoluto para wear factor (0–1) dentro do range da skin.
 * Referência: fórmula oficial CS2 trade-up output float.
 */
export function normalizeFloat(float: number, skin: SkinItem): number {
  const range = skin.maxFloat - skin.minFloat;
  if (range <= 0) return 0;
  return clamp((float - skin.minFloat) / range, 0, 1);
}

export function denormalizeFloat(normalized: number, skin: SkinItem): number {
  const range = skin.maxFloat - skin.minFloat;
  return clamp(skin.minFloat + normalized * range, skin.minFloat, skin.maxFloat);
}

export function calculateAverageInputFloat(inputs: ContractInput[]): number {
  if (inputs.length === 0) return 0;
  return inputs.reduce((acc, input) => acc + input.listing.float, 0) / inputs.length;
}

/** Média dos wears normalizados — base da fórmula oficial do CS2 */
export function calculateAverageNormalizedFloat(inputs: ContractInput[]): number {
  if (inputs.length === 0) return 0;
  const sum = inputs.reduce(
    (acc, input) => acc + normalizeFloat(input.listing.float, input.item),
    0,
  );
  return sum / inputs.length;
}

/**
 * Fórmula oficial CS2:
 * outputFloat = minFloat + avgNormalized × (maxFloat - minFloat)
 *
 * @see https://counterstrike.fandom.com/wiki/Trade_Up_Contract
 */
export function calculateOutputFloat(
  averageNormalizedFloat: number,
  outputSkin: SkinItem,
): number {
  const range = outputSkin.maxFloat - outputSkin.minFloat;
  return clamp(
    outputSkin.minFloat + averageNormalizedFloat * range,
    outputSkin.minFloat,
    outputSkin.maxFloat,
  );
}

export function calculateExpectedFloatForOutput(
  inputs: ContractInput[],
  outputSkin: SkinItem,
): number {
  return calculateOutputFloat(calculateAverageNormalizedFloat(inputs), outputSkin);
}

export function calculateOutputFloatRange(
  inputs: ContractInput[],
  outputSkin: SkinItem,
): { min: number; max: number } {
  const normalized = inputs.map((i) => normalizeFloat(i.listing.float, i.item));
  return {
    min: calculateOutputFloat(Math.min(...normalized), outputSkin),
    max: calculateOutputFloat(Math.max(...normalized), outputSkin),
  };
}
