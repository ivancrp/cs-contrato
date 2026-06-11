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

  it('retorna probabilidades vazias quando as entradas misturam raridades', () => {
    const restricted = COLLECTIONS[0].items.find((i) => i.rarity === 'restricted' && !i.stattrak)!;
    const milSpec = COLLECTIONS[0].items.find((i) => i.rarity === 'mil-spec' && !i.stattrak)!;

    const inputs: ContractInput[] = [
      ...Array.from({ length: 5 }, () => ({
        listing: {
          id: '1', itemId: restricted.id, marketHashName: 'test', marketplace: 'csfloat' as const,
          price: 10, currency: 'BRL', float: 0.05, wear: 'Factory New' as const, stattrak: false,
        },
        item: restricted,
      })),
      ...Array.from({ length: 5 }, () => ({
        listing: {
          id: '2', itemId: milSpec.id, marketHashName: 'test2', marketplace: 'csfloat' as const,
          price: 8, currency: 'BRL', float: 0.05, wear: 'Factory New' as const, stattrak: false,
        },
        item: milSpec,
      })),
    ];

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    expect(probs.size).toBe(0);
  });

  it('retorna probabilidades vazias quando StatTrak das entradas difere da saída', () => {
    const restrictedSt = COLLECTIONS[0].items.find((i) => i.id === 'rev-glock-vogue-st')!;
    const inputs: ContractInput[] = Array.from({ length: 10 }, () => ({
      listing: {
        id: '1', itemId: restrictedSt.id, marketHashName: 'test', marketplace: 'csfloat' as const,
        price: 10, currency: 'BRL', float: 0.05, wear: 'Factory New' as const, stattrak: true,
      },
      item: restrictedSt,
    }));

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    expect(probs.size).toBe(0);
  });

  it('distribui peso proporcional entre coleções (8+2)', () => {
    const revRestricted = COLLECTIONS[0].items.find((i) => i.id === 'rev-glock-vogue')!;
    const recRestricted = COLLECTIONS[1].items.find((i) => i.id === 'rec-dual-elite-tread')!;

    const inputs: ContractInput[] = [
      ...Array.from({ length: 8 }, () => ({
        listing: {
          id: '1', itemId: revRestricted.id, marketHashName: 'test', marketplace: 'csfloat' as const,
          price: 10, currency: 'BRL', float: 0.05, wear: 'Factory New' as const, stattrak: false,
        },
        item: revRestricted,
      })),
      ...Array.from({ length: 2 }, () => ({
        listing: {
          id: '2', itemId: recRestricted.id, marketHashName: 'test2', marketplace: 'csfloat' as const,
          price: 8, currency: 'BRL', float: 0.05, wear: 'Factory New' as const, stattrak: false,
        },
        item: recRestricted,
      })),
    ];

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    const revOutputs = COLLECTIONS[0].items.filter((i) => i.rarity === 'classified' && !i.stattrak);
    const recOutputs = COLLECTIONS[1].items.filter((i) => i.rarity === 'classified' && !i.stattrak);

    const revTotal = revOutputs.reduce((sum, skin) => sum + (probs.get(skin.id) ?? 0), 0);
    const recTotal = recOutputs.reduce((sum, skin) => sum + (probs.get(skin.id) ?? 0), 0);

    expect(revTotal).toBeCloseTo(0.8, 4);
    expect(recTotal).toBeCloseTo(0.2, 4);
  });
});
