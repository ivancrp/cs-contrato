import { describe, it, expect } from 'vitest';
import { calculateOutputFloat, calculateAverageInputFloat } from '../float';
import type { ContractInput, SkinItem } from '../../models/types';

const mockSkin: SkinItem = {
  id: 'test',
  name: 'M4A1-S | Black Lotus',
  weapon: 'M4A1-S',
  collectionId: 'revolution',
  rarity: 'classified',
  minFloat: 0,
  maxFloat: 0.7,
  stattrak: true,
};

function makeInput(float: number): ContractInput {
  return {
    listing: {
      id: '1', itemId: '1', marketHashName: 'test', marketplace: 'csfloat',
      price: 10, currency: 'BRL', float, wear: 'Factory New', stattrak: true,
    },
    item: mockSkin,
  };
}

describe('calculateOutputFloat', () => {
  it('aplica fórmula oficial do CS2', () => {
    const avg = 0.1;
    const result = calculateOutputFloat(avg, mockSkin);
    expect(result).toBeCloseTo(0 + 0.1 * 0.7, 4);
  });

  it('clamp entre min e max float da skin', () => {
    expect(calculateOutputFloat(2, mockSkin)).toBeLessThanOrEqual(0.7);
    expect(calculateOutputFloat(-1, mockSkin)).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateAverageInputFloat', () => {
  it('calcula média correta de 10 entradas', () => {
    const inputs = Array.from({ length: 10 }, () => makeInput(0.05));
    expect(calculateAverageInputFloat(inputs)).toBeCloseTo(0.05, 4);
  });
});
