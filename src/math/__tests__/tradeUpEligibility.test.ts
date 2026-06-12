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

  it('rejeita skins de coleção limitada para M4A1-S Fade', () => {
    const fade = findSkinByName('M4A1-S | Fade', false);
    const knight = findSkinByName('M4A1-S | Knight', false);
    const mjolnir = findSkinByName('Negev | Mjölnir', false);
    const wildLily = findSkinByName('MP9 | Wild Lily', false);
    const rainbowSpoon = findSkinByName('Galil AR | Rainbow Spoon', false);

    expect(fade).toBeDefined();
    expect(knight).toBeDefined();
    expect(mjolnir).toBeDefined();
    expect(wildLily).toBeDefined();
    expect(rainbowSpoon).toBeDefined();

    const collections = getCollections();
    expect(isValidTradeUpInput(knight!, fade!, collections)).toBe(false);
    expect(isValidTradeUpInput(mjolnir!, fade!, collections)).toBe(false);
    expect(isValidTradeUpInput(wildLily!, fade!, collections)).toBe(false);
    expect(isValidTradeUpInput(rainbowSpoon!, fade!, collections)).toBe(true);
  });
});
