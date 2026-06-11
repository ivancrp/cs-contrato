import { describe, it, expect, beforeAll } from 'vitest';
import { buildThreeContracts } from '../contractBuilder';
import { priceService } from '../../services/priceService';

describe('buildThreeContracts', () => {
  beforeAll(async () => {
    await priceService.preload();
  });

  it('gera tiers com métricas distintas usando preços reais', async () => {
    const contracts = await buildThreeContracts({
      skinName: 'M4A1-S | Black Lotus',
      stattrak: true,
      wear: 'Factory New',
      maxFloat: 0.07,
      budget: 100,
      marketplace: 'all',
      mode: 'balanced',
    });

    expect(contracts).toHaveLength(3);

    const costs = contracts.map((c) => c.evMetrics.totalCost);
    const chances = contracts.map((c) => c.evMetrics.targetChance);

    const uniqueCosts = new Set(costs.map((c) => c.toFixed(2)));
    const uniqueChances = new Set(chances.map((c) => c.toFixed(4)));

    expect(uniqueCosts.size).toBeGreaterThan(1);
    expect(uniqueChances.size).toBeGreaterThan(1);

    expect(contracts[0].evMetrics.totalCost).toBeLessThanOrEqual(contracts[2].evMetrics.totalCost);
    expect(contracts[0].evMetrics.targetChance).toBeLessThanOrEqual(contracts[2].evMetrics.targetChance);
  }, 30_000);
});
