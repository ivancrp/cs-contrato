import { describe, expect, it } from 'vitest';
import {
  isTradeUpEligibleInputCollection,
  resetTradeUpCollectionEligibilityForTests,
} from '../trade-up-collections.js';

describe('isTradeUpEligibleInputCollection', () => {
  it('sempre permite coleção da skin alvo', () => {
    const targetIds = new Set(['collection-set-bravo']);
    expect(isTradeUpEligibleInputCollection('collection-set-bravo', targetIds)).toBe(true);
  });

  it('bloqueia coleções limitadas conhecidas', () => {
    resetTradeUpCollectionEligibilityForTests();
    expect(
      isTradeUpEligibleInputCollection('collection-set-cobblestone', new Set()),
    ).toBe(false);
  });
});
