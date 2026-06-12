import { calculateEV } from '../math/ev';
import type { CandidateListing, OptimizationResult } from './types';

/** Custo das 10 skins mais baratas do pool. */
export function computeFloorCost(candidates: CandidateListing[]): number {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  if (sorted.length === 0) return 100;
  const pick = sorted.slice(0, Math.min(10, sorted.length));
  return pick.reduce((sum, candidate) => sum + candidate.price, 0);
}

/** Exclui listings com preço desproporcional (ex.: FN caríssimo fora do orçamento). */
export function computePriceCap(candidates: CandidateListing[]): number {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  if (sorted.length === 0) return 50;

  const prices = sorted.map((candidate) => candidate.price);
  const median = prices[Math.floor(prices.length / 2)] ?? 20;
  const cheapAvg =
    prices.slice(0, Math.min(12, prices.length)).reduce((sum, price) => sum + price, 0) /
    Math.min(12, prices.length);

  return Math.max(median * 2.2, cheapAvg * 3.5, 15);
}

/** Skins da coleção alvo — nunca filtradas por preço. */
export function extractTargetCollectionPool(candidates: CandidateListing[]): CandidateListing[] {
  return candidates
    .filter((candidate) => candidate.isTargetCollection)
    .sort((a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore);
}

export function hasTargetCollectionCandidates(candidates: CandidateListing[]): boolean {
  return candidates.some((candidate) => candidate.isTargetCollection);
}

function mergePools(
  targetPool: CandidateListing[],
  otherPool: CandidateListing[],
  limit: number,
): CandidateListing[] {
  const merged = [...targetPool];
  for (const candidate of otherPool) {
    if (merged.length >= limit) break;
    merged.push(candidate);
  }

  if (merged.length >= 10) return merged.slice(0, limit);

  for (const candidate of otherPool) {
    if (merged.length >= limit) break;
    if (!merged.includes(candidate)) merged.push(candidate);
  }

  return merged.length >= 10 ? merged.slice(0, limit) : merged;
}

function buildPool(
  candidates: CandidateListing[],
  otherCapMultiplier: number,
  sortOthers: (a: CandidateListing, b: CandidateListing) => number,
  limit: number,
): CandidateListing[] {
  const cap = computePriceCap(candidates);
  const targetPool = extractTargetCollectionPool(candidates);
  const otherPool = candidates
    .filter((candidate) => !candidate.isTargetCollection && candidate.price <= cap * otherCapMultiplier)
    .sort(sortOthers);

  return mergePools(targetPool, otherPool, limit);
}

/** Pool focado em uma coleção específica + fillers baratos de outras coleções. */
export function buildTargetHeavyPool(
  candidates: CandidateListing[],
  collectionId: string,
  limit = 50,
): CandidateListing[] {
  const collectionPool = candidates
    .filter((candidate) => candidate.collectionId === collectionId)
    .sort((a, b) => a.floatFitScore - b.floatFitScore || a.price - b.price);

  const fillerPool = candidates
    .filter((candidate) => candidate.collectionId !== collectionId && !candidate.isTargetCollection)
    .sort((a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore);

  return mergePools(collectionPool, fillerPool, limit);
}

/** Pool econômico: prioriza skins baratas com float aceitável. */
export function buildCheapCandidatePool(
  candidates: CandidateListing[],
  limit = 45,
): CandidateListing[] {
  return buildPool(
    candidates,
    1,
    (a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore,
    limit,
  );
}

/** Pool focado em atingir o desgate com menor custo possível. */
export function buildFloatFocusedPool(
  candidates: CandidateListing[],
  limit = 45,
): CandidateListing[] {
  return buildPool(
    candidates,
    1,
    (a, b) => a.floatFitScore - b.floatFitScore || a.price - b.price,
    limit,
  );
}

/** Pool completo, mas sem outliers de preço nas fillers. */
export function buildBalancedCandidatePool(
  candidates: CandidateListing[],
  limit = 55,
): CandidateListing[] {
  return buildPool(
    candidates,
    1.4,
    (a, b) => a.floatFitScore - b.floatFitScore || a.price - b.price,
    limit,
  );
}

export function isFeasibleContract(
  result: OptimizationResult,
  budget: number,
  floorCost: number,
  maxCostMultiplier: number,
  minEvRatio: number,
): boolean {
  if (!Number.isFinite(result.totalCost) || result.totalCost > budget) return false;
  if (result.totalCost > floorCost * maxCostMultiplier) return false;

  const ev = calculateEV(result.outputs);
  if (ev < result.totalCost * minEvRatio) return false;

  return true;
}
