import { describe, it, expect } from 'vitest';
import { simulateMonteCarlo } from '../monte-carlo.js';
import type { TradeUpContract } from '@ct/types';

const mockContract: TradeUpContract = {
  id: 'test',
  ruleId: 'cs2_weapon_10',
  inputs: [],
  outputs: [
    {
      item: {
        id: 'a',
        name: 'Skin A',
        weapon: 'AK-47',
        collectionId: 'c1',
        rarity: 'covert',
        minFloat: 0,
        maxFloat: 1,
        stattrak: false,
      },
      probability: 0.5,
      expectedFloat: 0.15,
      expectedWear: 'Field-Tested',
      price: 100,
      isTarget: true,
    },
    {
      item: {
        id: 'b',
        name: 'Skin B',
        weapon: 'M4A4',
        collectionId: 'c1',
        rarity: 'covert',
        minFloat: 0,
        maxFloat: 1,
        stattrak: false,
      },
      probability: 0.5,
      expectedFloat: 0.15,
      expectedWear: 'Field-Tested',
      price: 50,
      isTarget: false,
    },
  ],
  floatMetrics: {
    averageInputFloat: 0.1,
    averageNormalizedFloat: 0.1,
    expectedOutputFloat: 0.1,
    expectedWear: 'Minimal Wear',
    minPossibleFloat: 0,
    maxPossibleFloat: 1,
  },
  evMetrics: {
    expectedValue: 75,
    totalCost: 60,
    expectedProfit: 15,
    roi: 25,
    marginPercent: 25,
    maxLoss: 10,
    averageLoss: 10,
    averageGain: 40,
    targetChance: 0.5,
    breakEvenChance: 0.5,
    lossChance: 0.5,
    isBreakEven: false,
    riskScore: 30,
  },
  worstCase: {
    skinId: 'b',
    skinName: 'Skin B',
    float: 0.15,
    wear: 'Field-Tested',
    price: 50,
    profitOrLoss: -10,
    percent: -16.67,
  },
  bestCase: {
    skinId: 'a',
    skinName: 'Skin A',
    float: 0.15,
    wear: 'Field-Tested',
    price: 100,
    profitOrLoss: 40,
    percent: 66.67,
  },
  collectionsUsed: ['c1'],
};

describe('simulateMonteCarlo', () => {
  it('executa N iterações com seed reprodutível', () => {
    const r1 = simulateMonteCarlo(mockContract, { iterations: 1000, seed: 42 });
    const r2 = simulateMonteCarlo(mockContract, { iterations: 1000, seed: 42 });
    expect(r1.targetObtained).toBe(r2.targetObtained);
    expect(r1.observedEV).toBeCloseTo(r2.observedEV, 5);
  });

  it('EV observado converge para EV teórico', () => {
    const result = simulateMonteCarlo(mockContract, { iterations: 100_000, seed: 123 });
    expect(result.observedEV).toBeCloseTo(75, 0);
    expect(result.iterations).toBe(100_000);
  });
});
