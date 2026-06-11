import { describe, it, expect } from 'vitest';
import { COLLECTIONS } from '../../data/collections';
import { validateContractInputs, CONTRACT_INPUT_SIZE } from '../contractRules';
import type { ContractInput } from '../../models/types';

function makeInput(itemId: string, rarity: ContractInput['item']['rarity'], stattrak = false): ContractInput {
  const item = COLLECTIONS.flatMap((c) => c.items).find((i) => i.id === itemId)!;
  return {
    listing: {
      id: `${itemId}-listing`,
      itemId,
      marketHashName: item.name,
      marketplace: 'csfloat',
      price: 10,
      currency: 'BRL',
      float: 0.05,
      wear: 'Factory New',
      stattrak,
    },
    item: { ...item, rarity, stattrak },
  };
}

describe('validateContractInputs', () => {
  const target = COLLECTIONS[0].items.find((i) => i.id === 'rev-m4a1s-black-lotus-st')!;

  it('aceita 10 entradas da mesma raridade exigida', () => {
    const inputs = Array.from({ length: CONTRACT_INPUT_SIZE }, () =>
      makeInput('rev-glock-vogue-st', 'restricted', true),
    );

    expect(validateContractInputs(inputs, target)).toEqual({ valid: true });
  });

  it('rejeita entradas com raridades misturadas', () => {
    const inputs = [
      ...Array.from({ length: 5 }, () => makeInput('rev-glock-vogue-st', 'restricted', true)),
      ...Array.from({ length: 5 }, () => makeInput('rev-ump45-motorized', 'mil-spec', true)),
    ];

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mesma raridade');
  });

  it('rejeita entradas com raridade acima do tier exigido', () => {
    const inputs = Array.from({ length: CONTRACT_INPUT_SIZE }, () =>
      makeInput('rev-m4a1s-black-lotus-st', 'classified', true),
    );

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('restricted');
  });
});
