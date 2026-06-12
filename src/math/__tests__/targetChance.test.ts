import { describe, it, expect } from 'vitest';
import type { Collection, SkinItem } from '../../models/types';
import {
  maxAchievableTargetChance,
  planInputsForTargetChance,
} from '../targetChance';

const targetSkin: SkinItem = {
  id: 'skin-target',
  name: 'AK-47 | Alvo',
  weapon: 'AK-47',
  collectionId: 'col-a',
  rarity: 'covert',
  stattrak: false,
  minFloat: 0,
  maxFloat: 1,
};

const collections: Collection[] = [
  {
    id: 'col-a',
    name: 'Coleção A',
    items: [
      targetSkin,
      {
        id: 'skin-other-a',
        name: 'M4A4 | Outra A',
        weapon: 'M4A4',
        collectionId: 'col-a',
        rarity: 'covert',
        stattrak: false,
        minFloat: 0,
        maxFloat: 1,
      },
      {
        id: 'skin-input-a',
        name: 'Entrada A',
        weapon: 'AK-47',
        collectionId: 'col-a',
        rarity: 'classified',
        stattrak: false,
        minFloat: 0,
        maxFloat: 1,
      },
    ],
  },
  {
    id: 'col-b',
    name: 'Coleção B',
    items: [
      {
        id: 'skin-target-b',
        name: 'AK-47 | Alvo B',
        weapon: 'AK-47',
        collectionId: 'col-b',
        rarity: 'covert',
        stattrak: false,
        minFloat: 0,
        maxFloat: 1,
      },
      {
        id: 'skin-input-b',
        name: 'Entrada B',
        weapon: 'AK-47',
        collectionId: 'col-b',
        rarity: 'classified',
        stattrak: false,
        minFloat: 0,
        maxFloat: 1,
      },
    ],
  },
];

describe('targetChance', () => {
  it('calcula chance máxima com base no menor número de skins no tier', () => {
    expect(maxAchievableTargetChance(targetSkin, collections)).toBeCloseTo(0.5);
  });

  it('retorna null quando 60% é impossível', () => {
    expect(planInputsForTargetChance(targetSkin, collections, 0.6)).toBeNull();
  });

  it('planeja 6 entradas quando a coleção tem skin única no tier', () => {
    const soloTarget: SkinItem = {
      ...targetSkin,
      id: 'skin-solo',
      collectionId: 'col-solo',
    };

    const soloCollections: Collection[] = [
      {
        id: 'col-solo',
        name: 'Solo',
        items: [
          soloTarget,
          {
            id: 'skin-input-solo',
            name: 'Entrada Solo',
            weapon: 'AK-47',
            collectionId: 'col-solo',
            rarity: 'classified',
            stattrak: false,
            minFloat: 0,
            maxFloat: 1,
          },
        ],
      },
    ];

    const plan = planInputsForTargetChance(soloTarget, soloCollections, 0.6);
    expect(plan).toEqual({
      collectionId: 'col-solo',
      inputCount: 6,
      expectedChance: 0.6,
      outputSkinCount: 1,
    });
  });
});
