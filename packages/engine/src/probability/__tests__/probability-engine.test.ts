import { describe, it, expect } from 'vitest';
import { calculateOutputProbabilities } from '../probability-engine.js';
import { CS2_WEAPON_TRADE_UP_RULE } from '@ct/contracts';
import type { Collection, ContractInput, SkinItem } from '@ct/types';

const skinA: SkinItem = {
  id: 'skin-a',
  name: 'AK-47 | Test A',
  weapon: 'AK-47',
  collectionId: 'col-1',
  rarity: 'restricted',
  minFloat: 0,
  maxFloat: 1,
  stattrak: false,
};

const skinB: SkinItem = {
  id: 'skin-b',
  name: 'M4A4 | Test B',
  weapon: 'M4A4',
  collectionId: 'col-1',
  rarity: 'classified',
  minFloat: 0,
  maxFloat: 1,
  stattrak: false,
};

const skinC: SkinItem = {
  id: 'skin-c',
  name: 'AWP | Test C',
  weapon: 'AWP',
  collectionId: 'col-2',
  rarity: 'restricted',
  minFloat: 0,
  maxFloat: 1,
  stattrak: false,
};

const skinD: SkinItem = {
  id: 'skin-d',
  name: 'AWP | Test D',
  weapon: 'AWP',
  collectionId: 'col-2',
  rarity: 'classified',
  minFloat: 0,
  maxFloat: 1,
  stattrak: false,
};

const collections: Collection[] = [
  { id: 'col-1', name: 'Collection 1', items: [skinA, skinB] },
  { id: 'col-2', name: 'Collection 2', items: [skinC, skinD] },
];

function makeInput(skin: SkinItem): ContractInput {
  return {
    listing: {
      id: `${skin.id}-l`,
      itemId: skin.id,
      marketHashName: skin.name,
      marketplace: 'csfloat',
      price: 10,
      currency: 'USD',
      float: 0.1,
      wear: 'Minimal Wear',
      stattrak: false,
    },
    item: skin,
  };
}

describe('calculateOutputProbabilities', () => {
  it('soma probabilidades a 1 na mesma coleção', () => {
    const inputs = Array.from({ length: 10 }, () => makeInput(skinA));
    const probs = calculateOutputProbabilities(
      inputs,
      collections,
      'classified',
      false,
      CS2_WEAPON_TRADE_UP_RULE,
    );
    const total = [...probs.values()].reduce((s, m) => s + m.probability, 0);
    expect(total).toBeCloseTo(1, 4);
    expect(probs.get('skin-b')?.source).toBe('community');
  });

  it('distribui 80/20 entre coleções', () => {
    const inputs: ContractInput[] = [
      ...Array.from({ length: 8 }, () => makeInput(skinA)),
      ...Array.from({ length: 2 }, () => makeInput(skinC)),
    ];

    const probs = calculateOutputProbabilities(
      inputs,
      collections,
      'classified',
      false,
      CS2_WEAPON_TRADE_UP_RULE,
    );

    expect(probs.get('skin-b')?.probability).toBeCloseTo(0.8, 4);
    expect(probs.get('skin-d')?.probability).toBeCloseTo(0.2, 4);
  });
});
