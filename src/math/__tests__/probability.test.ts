import { describe, it, expect } from 'vitest';
import { calculateOutputProbabilities } from '../probability';
import type { ContractInput } from '../../models/types';
import { COLLECTIONS, findSkinByName } from '../../data/collections';

function requireSkin(name: string, stattrak: boolean) {
  const skin = findSkinByName(name, stattrak);
  if (!skin) throw new Error(`Skin não encontrada: ${name}`);
  return skin;
}

function getCollection(id: string) {
  const collection = COLLECTIONS.find((entry) => entry.id === id);
  if (!collection) throw new Error(`Coleção não encontrada: ${id}`);
  return collection;
}

function makeInput(item: ReturnType<typeof requireSkin>): ContractInput {
  return {
    listing: {
      id: `${item.id}-listing`,
      itemId: item.id,
      marketHashName: item.name,
      marketplace: 'csfloat',
      price: 10,
      currency: 'BRL',
      float: 0.05,
      wear: 'Factory New',
      stattrak: item.stattrak,
    },
    item,
  };
}

describe('calculateOutputProbabilities', () => {
  it('distribui probabilidade igualmente na mesma coleção', () => {
    const restricted = getCollection('revolution').items.find(
      (item) => item.rarity === 'restricted' && !item.stattrak,
    )!;
    const inputs = Array.from({ length: 10 }, () => makeInput(restricted));

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    const total = [...probs.values()].reduce((sum, probability) => sum + probability, 0);
    expect(total).toBeCloseTo(1, 4);
  });

  it('retorna probabilidades vazias quando as entradas misturam raridades', () => {
    const restricted = getCollection('revolution').items.find(
      (item) => item.rarity === 'restricted' && !item.stattrak,
    )!;
    const milSpec = getCollection('revolution').items.find(
      (item) => item.rarity === 'mil-spec' && !item.stattrak,
    )!;

    const inputs: ContractInput[] = [
      ...Array.from({ length: 5 }, () => makeInput(restricted)),
      ...Array.from({ length: 5 }, () => makeInput(milSpec)),
    ];

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    expect(probs.size).toBe(0);
  });

  it('retorna probabilidades vazias quando StatTrak das entradas difere da saída', () => {
    const restrictedSt = requireSkin('Glock-18 | Umbral Rabbit', true);
    const inputs = Array.from({ length: 10 }, () => makeInput(restrictedSt));

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    expect(probs.size).toBe(0);
  });

  it('distribui peso proporcional entre coleções (8+2)', () => {
    const revRestricted = getCollection('revolution').items.find(
      (item) => item.rarity === 'restricted' && !item.stattrak,
    )!;
    const recRestricted = getCollection('recoil').items.find(
      (item) => item.rarity === 'restricted' && !item.stattrak,
    )!;

    const inputs: ContractInput[] = [
      ...Array.from({ length: 8 }, () => makeInput(revRestricted)),
      ...Array.from({ length: 2 }, () => makeInput(recRestricted)),
    ];

    const probs = calculateOutputProbabilities(inputs, COLLECTIONS, 'classified', false);
    const revOutputs = getCollection('revolution').items.filter(
      (item) => item.rarity === 'classified' && !item.stattrak,
    );
    const recOutputs = getCollection('recoil').items.filter(
      (item) => item.rarity === 'classified' && !item.stattrak,
    );

    const revTotal = revOutputs.reduce((sum, skin) => sum + (probs.get(skin.id) ?? 0), 0);
    const recTotal = recOutputs.reduce((sum, skin) => sum + (probs.get(skin.id) ?? 0), 0);

    expect(revTotal).toBeCloseTo(0.8, 4);
    expect(recTotal).toBeCloseTo(0.2, 4);
  });
});
