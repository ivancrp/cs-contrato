import { describe, it, expect } from 'vitest';
import { isTradeUpEligibleInputCollection } from '../tradeUpCollections';

describe('isTradeUpEligibleInputCollection', () => {
  const fadeCollection = new Set(['collection-set-realism-camo']);

  it('permite coleção da skin alvo mesmo sem weapon case', () => {
    expect(
      isTradeUpEligibleInputCollection('collection-set-realism-camo', fadeCollection),
    ).toBe(true);
  });

  it('bloqueia coleções mapa/operação conhecidas', () => {
    expect(
      isTradeUpEligibleInputCollection('collection-set-cobblestone', fadeCollection),
    ).toBe(false);
    expect(
      isTradeUpEligibleInputCollection('collection-set-norse', fadeCollection),
    ).toBe(false);
    expect(
      isTradeUpEligibleInputCollection('collection-set-stmarc', fadeCollection),
    ).toBe(false);
  });

  it('permite coleções de case padrão', () => {
    expect(
      isTradeUpEligibleInputCollection('collection-set-community-33', fadeCollection),
    ).toBe(true);
  });
});
