import { getWearTiersInRange } from '@ct/engine';
import type { SkinItem } from '@ct/types';
import { buildMarketHashName, maxAllowedInputFloat, type SearchCandidate } from './trade-up-helpers.js';

/** Faixa float completa (0.00–1.00) — ideal para fillers flexíveis em trade-ups. */
export function hasFullFloatRange(item: SkinItem): boolean {
  return item.minFloat <= 0.01 && item.maxFloat >= 0.99;
}

/** Quanto a faixa float da skin é ampla (0–1). Skins com range curto limitam o trade-up. */
export function floatRangeScore(item: SkinItem): number {
  const span = item.maxFloat - item.minFloat;
  if (span >= 0.95) return 1;
  if (span >= 0.75) return 0.6;
  if (span >= 0.5) return 0.3;
  return 0;
}

/**
 * Preço mínimo estimado da skin nos wears compatíveis com o float alvo.
 * Fillers baratos devem ser ranqueados pelo preço no wear que realmente importa.
 */
export function minCompatiblePrice(
  item: SkinItem,
  targetSkin: SkinItem,
  targetMaxFloat: number,
  catalogPrices: Map<string, number>,
): number {
  const maxAllowed = maxAllowedInputFloat(targetSkin, targetMaxFloat, item);
  if (maxAllowed < item.minFloat) return Infinity;

  const wears = getWearTiersInRange(item.minFloat, maxAllowed);
  let min = Infinity;

  for (const wear of wears) {
    const hash = buildMarketHashName(item.name, item.stattrak, wear);
    const price = catalogPrices.get(hash);
    if (price && price > 0 && price < min) min = price;
  }

  return Number.isFinite(min) ? min : Infinity;
}

export interface FillerRankOptions {
  targetSkin: SkinItem;
  targetMaxFloat: number;
  idealNorm: number;
  catalogPrices: Map<string, number>;
  /** Contagem de listings live por skin (liquidez CSFloat). */
  liveListingCounts?: Map<string, number>;
}

/**
 * Score composto para fillers — menor = melhor.
 * Prioriza: preço baixo, float compatível, faixa ampla, liquidez.
 */
export function computeFillerRankScore(item: SkinItem, options: FillerRankOptions): number {
  const price = minCompatiblePrice(
    item,
    options.targetSkin,
    options.targetMaxFloat,
    options.catalogPrices,
  );
  if (!Number.isFinite(price)) return Infinity;

  const rangeBonus = floatRangeScore(item) * -25;
  const liquidity = options.liveListingCounts?.get(item.id) ?? 0;
  const liquidityBonus = liquidity >= 5 ? -12 : liquidity >= 2 ? -6 : 0;
  const fullRangeBonus = hasFullFloatRange(item) ? -18 : 0;

  return price * 100 + rangeBonus + liquidityBonus + fullRangeBonus;
}

export function rankFillerSkins(
  fillers: SkinItem[],
  options: FillerRankOptions,
): SkinItem[] {
  return [...fillers].sort(
    (a, b) => computeFillerRankScore(a, options) - computeFillerRankScore(b, options),
  );
}

export function computeCandidateFillerScore(candidate: SearchCandidate, item: SkinItem): number {
  const rangeBonus = floatRangeScore(item) * -20;
  const liveBonus = candidate.marketplace === 'csfloat' ? -8 : 0;
  const fullRangeBonus = hasFullFloatRange(item) ? -15 : 0;

  return candidate.price * 90 + candidate.floatFitScore * 35 + rangeBonus + liveBonus + fullRangeBonus;
}

export function sortFillerCandidates(
  candidates: SearchCandidate[],
  skinsById: Map<string, SkinItem>,
): SearchCandidate[] {
  return [...candidates].sort((a, b) => {
    const itemA = skinsById.get(a.itemId);
    const itemB = skinsById.get(b.itemId);
    const scoreA = itemA ? computeCandidateFillerScore(a, itemA) : a.price * 90;
    const scoreB = itemB ? computeCandidateFillerScore(b, itemB) : b.price * 90;
    return scoreA - scoreB;
  });
}
