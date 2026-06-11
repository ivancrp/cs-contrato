import { describe, it, expect } from 'vitest';
import { calculateOutputProbabilities } from '../probability';
import type { ContractInput } from '../../models/types';
import { COLLECTIONS } from '../../data/collections';

describe('calculateOutputProbabilities', () => {
  it('distribui probabilidade igualmente na mesma coleção', () => {
    const restricted = COLLECTIONS[0].items.find((i) => i.rarity === 'restricted' && !i.stattrak)!;
    const inputs: ContractInput[] = Array.from({ length: 10 }, () => ({
      listing: {
        id: '1', itemId: restricted.id, marketHashName: 'test', marketplace: 'csfloat',
        price: 10, currency: 'BRL', float: 0.05, wear: 'Factory New', stattrak: false,
      },
      item: restricted,
    }));

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    const total = [...probs.values()].reduce((s, p) => s + p, 0);
    expect(total).toBeCloseTo(1, 4);
  });
});
