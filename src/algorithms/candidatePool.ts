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
  return merged.length >= 10 ? merged : [...targetPool, ...otherPool].slice(0, limit);
}

/** Pool econômico: prioriza skins baratas com float aceitável. */
export function buildCheapCandidatePool(
  candidates: CandidateListing[],
  limit = 45,
): CandidateListing[] {
  const cap = computePriceCap(candidates);

  const targetPool = candidates
    .filter((candidate) => candidate.isTargetCollection && candidate.price <= cap * 1.8)
    .sort((a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore);

  const otherPool = candidates
    .filter((candidate) => !candidate.isTargetCollection && candidate.price <= cap)
    .sort((a, b) => a.price - b.price || a.floatFitScore - b.floatFitScore);

  return mergePools(targetPool, otherPool, limit);
}

/** Pool focado em atingir o desgate com menor custo possível. */
export function buildFloatFocusedPool(
  candidates: CandidateListing[],
  limit = 45,
): CandidateListing[] {
  const cap = computePriceCap(candidates);

  return [...candidates]
    .filter((candidate) => candidate.price <= cap)
    .sort((a, b) => a.floatFitScore - b.floatFitScore || a.price - b.price)
    .slice(0, limit);
}

/** Pool completo, mas sem outliers de preço. */
export function buildBalancedCandidatePool(
  candidates: CandidateListing[],
  limit = 55,
): CandidateListing[] {
  const cap = computePriceCap(candidates) * 1.4;

  const targetPool = candidates
    .filter((candidate) => candidate.isTargetCollection && candidate.price <= cap)
    .sort((a, b) => a.floatFitScore - b.floatFitScore || a.price - b.price);

  const otherPool = candidates
    .filter((candidate) => !candidate.isTargetCollection && candidate.price <= cap)
    .sort((a, b) => a.floatFitScore - b.floatFitScore || a.price - b.price);

  return mergePools(targetPool, otherPool, limit);
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
