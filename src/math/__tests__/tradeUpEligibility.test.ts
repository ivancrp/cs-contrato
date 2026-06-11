import { describe, it, expect } from 'vitest';
import { findSkinByName, getCollections } from '../../data/collections';
import { isValidTradeUpInput } from '../probability';

describe('isValidTradeUpInput', () => {
  it('rejeita R8 Amber Fade para alvo Covert (coleção Dust 2 sem covert)', () => {
    const amberFade = findSkinByName('R8 Revolver | Amber Fade', false);
    const searingRage = findSkinByName('AK-47 | Searing Rage', false);
    expect(amberFade).toBeDefined();
    expect(searingRage).toBeDefined();

    const covertTarget = getCollections()
      .find((collection) => collection.id === searingRage!.collectionId)
      ?.items.find((item) => item.rarity === 'covert' && !item.stattrak);

    expect(covertTarget).toBeDefined();
    expect(
      isValidTradeUpInput(amberFade!, covertTarget!, getCollections()),
    ).toBe(false);
  });

  it('aceita Searing Rage para alvo Covert da mesma coleção', () => {
    const searingRage = findSkinByName('AK-47 | Searing Rage', false);
    expect(searingRage).toBeDefined();

    const covertTarget = getCollections()
      .find((collection) => collection.id === searingRage!.collectionId)
      ?.items.find((item) => item.rarity === 'covert' && !item.stattrak);

    expect(covertTarget).toBeDefined();
    expect(
      isValidTradeUpInput(searingRage!, covertTarget!, getCollections()),
    ).toBe(true);
  });
});
