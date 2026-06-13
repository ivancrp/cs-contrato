import { describe, it, expect } from 'vitest';
import {
  buildCheapCandidatePool,
  computeFloorCost,
  computePriceCap,
  isFeasibleContract,
} from '../candidatePool';
import type { CandidateListing } from '../types';

function listing(price: number, target = false): CandidateListing {
  return {
    listingId: `id-${price}`,
    itemId: `skin-${price}`,
    collectionId: 'col',
    rarity: 'restricted',
    stattrak: false,
    price,
    float: 0.15,
    normalizedFloat: 0.15,
    floatFitScore: 0.05,
    isTargetCollection: target,
    marketVerified: true,
  };
}

describe('candidatePool', () => {
  it('calcula floor cost com as 10 skins mais baratas', () => {
    const pool = Array.from({ length: 15 }, (_, i) => listing(5 + i));
    expect(computeFloorCost(pool)).toBe(5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14);
  });

  it('exclui outliers caros do pool econômico', () => {
    const pool = [
      ...Array.from({ length: 12 }, (_, i) => listing(8 + i)),
      listing(545, true),
      listing(600),
    ];
    const cheap = buildCheapCandidatePool(pool);
    expect(cheap.filter((candidate) => !candidate.isTargetCollection).every(
      (candidate) => candidate.price <= computePriceCap(pool),
    )).toBe(true);
    expect(cheap.some((candidate) => candidate.isTargetCollection && candidate.price >= 500)).toBe(true);
  });

  it('rejeita contrato com EV muito abaixo do custo', () => {
    const floor = 100;
    const result = {
      combination: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      candidatePool: [],
      inputs: [],
      outputs: [{ probability: 1, price: 40 } as never],
      totalCost: 5000,
      expectedFloat: 0.07,
      score: 10,
    };

    expect(isFeasibleContract(result, 6000, floor, 2, 0.45)).toBe(false);
  });
});
