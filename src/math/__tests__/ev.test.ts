import { describe, it, expect } from 'vitest';
import { calculateEV, calculateEVMetrics } from '../ev';
import type { ContractOutput } from '../../models/types';

const outputs: ContractOutput[] = [
  {
    item: { id: 'a', name: 'A', weapon: 'A', collectionId: 'c', rarity: 'classified', minFloat: 0, maxFloat: 1, stattrak: false },
    probability: 0.5,
    expectedFloat: 0.1,
    expectedWear: 'Factory New',
    price: 100,
    isTarget: true,
  },
  {
    item: { id: 'b', name: 'B', weapon: 'B', collectionId: 'c', rarity: 'classified', minFloat: 0, maxFloat: 1, stattrak: false },
    probability: 0.5,
    expectedFloat: 0.2,
    expectedWear: 'Minimal Wear',
    price: 60,
    isTarget: false,
  },
];

describe('calculateEV', () => {
  it('calcula EV = Σ(prob × preço)', () => {
    expect(calculateEV(outputs)).toBe(80);
  });
});

describe('calculateEVMetrics', () => {
  it('calcula ROI, chance alvo e break-even', () => {
    const metrics = calculateEVMetrics(outputs, 70, 'a');
    expect(metrics.expectedValue).toBe(80);
    expect(metrics.expectedProfit).toBe(10);
    expect(metrics.targetChance).toBe(0.5);
    expect(metrics.breakEvenChance).toBe(0.5);
    expect(metrics.isBreakEven).toBe(false);
    expect(metrics.roi).toBeCloseTo(14.29, 1);
  });

  it('identifica break-even quando EV igual ao custo', () => {
    const metrics = calculateEVMetrics(outputs, 80, 'a');
    expect(metrics.isBreakEven).toBe(true);
    expect(metrics.expectedProfit).toBe(0);
  });
});
