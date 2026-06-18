import type { ContractOutput } from '@ct/types';
import type { CandidateListing } from './scoring.js';

export function computeFloorCost(candidates: CandidateListing[]): number {
  const sorted = [...candidates].sort((a, b) => a.listing.price - b.listing.price);
  if (sorted.length === 0) return 100;
  const pick = sorted.slice(0, Math.min(10, sorted.length));
  return pick.reduce((sum, candidate) => sum + candidate.listing.price, 0);
}

export function computePriceCap(candidates: CandidateListing[]): number {
  const sorted = [...candidates].sort((a, b) => a.listing.price - b.listing.price);
  if (sorted.length === 0) return 50;

  const prices = sorted.map((candidate) => candidate.listing.price);
  const median = prices[Math.floor(prices.length / 2)] ?? 20;
  const cheapAvg =
    prices.slice(0, Math.min(12, prices.length)).reduce((sum, price) => sum + price, 0) /
    Math.min(12, prices.length);

  return Math.max(median * 2.2, cheapAvg * 3.5, 15);
}

export function extractTargetCollectionPool(candidates: CandidateListing[]): CandidateListing[] {
  return candidates
    .filter((candidate) => candidate.isTargetCollection)
    .sort(
      (a, b) =>
        a.listing.price - b.listing.price ||
        (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0),
    );
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
    .filter(
      (candidate) =>
        !candidate.isTargetCollection && candidate.listing.price <= cap * otherCapMultiplier,
    )
    .sort(sortOthers);

  return mergePools(targetPool, otherPool, limit);
}

export function buildTargetHeavyPool(
  candidates: CandidateListing[],
  collectionId: string,
  limit = 50,
): CandidateListing[] {
  const collectionPool = candidates
    .filter((candidate) => candidate.item.collectionId === collectionId)
    .sort(
      (a, b) =>
        (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0) ||
        a.listing.price - b.listing.price,
    );

  const fillerPool = candidates
    .filter(
      (candidate) =>
        candidate.item.collectionId !== collectionId && !candidate.isTargetCollection,
    )
    .sort(
      (a, b) =>
        a.listing.price - b.listing.price ||
        (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0),
    );

  return mergePools(collectionPool, fillerPool, limit);
}

export function buildCheapCandidatePool(
  candidates: CandidateListing[],
  limit = 45,
): CandidateListing[] {
  return buildPool(
    candidates,
    1,
    (a, b) =>
      a.listing.price - b.listing.price ||
      (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0),
    limit,
  );
}

export function buildFloatFocusedPool(
  candidates: CandidateListing[],
  limit = 45,
): CandidateListing[] {
  return buildPool(
    candidates,
    1,
    (a, b) =>
      (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0) ||
      a.listing.price - b.listing.price,
    limit,
  );
}

export function buildBalancedCandidatePool(
  candidates: CandidateListing[],
  limit = 55,
): CandidateListing[] {
  return buildPool(
    candidates,
    1.4,
    (a, b) =>
      (a.floatFitScore ?? 0) - (b.floatFitScore ?? 0) ||
      a.listing.price - b.listing.price,
    limit,
  );
}

export function isFeasibleContract(
  outputs: ContractOutput[],
  totalCost: number,
  budget: number,
  floorCost: number,
  maxCostMultiplier: number,
  minEvRatio: number,
): boolean {
  if (!Number.isFinite(totalCost) || totalCost > budget) return false;
  if (totalCost > floorCost * maxCostMultiplier) return false;

  const ev = outputs.reduce((sum, output) => sum + output.probability * output.price, 0);
  if (ev < totalCost * minEvRatio) return false;

  return true;
}
