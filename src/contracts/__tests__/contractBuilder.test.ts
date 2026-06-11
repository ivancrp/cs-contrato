import { describe, it, expect, beforeAll } from 'vitest';
import { buildThreeContracts, resolveTargetSkin } from '../contractBuilder';
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

    expect(contracts.length).toBeGreaterThanOrEqual(1);

    const costs = contracts.map((c) => c.evMetrics.totalCost);
    const chances = contracts.map((c) => c.evMetrics.targetChance);

    expect(costs.every((cost) => cost > 0)).toBe(true);
    expect(chances.every((chance) => chance >= 0 && chance <= 1)).toBe(true);

    for (const contract of contracts) {
      const rarities = new Set(contract.inputs.map((input) => input.item.rarity));
      expect(rarities.size).toBe(1);
      expect(rarities.has('restricted')).toBe(true);
      expect(contract.inputs.every((input) => input.item.stattrak)).toBe(true);
    }

    const params = {
      skinName: 'M4A1-S | Black Lotus',
      stattrak: true,
      wear: 'Factory New' as const,
      maxFloat: 0.07,
      budget: 100,
      marketplace: 'all' as const,
      mode: 'balanced' as const,
    };
    const targetSkin = resolveTargetSkin(params);
    const budgetContract = contracts.find((contract) => contract.tier === 'budget');

    if (budgetContract) {
      const targetCollectionInputs = budgetContract.inputs.filter(
        (input) => input.item.collectionId === targetSkin.collectionId,
      ).length;
      expect(targetCollectionInputs).toBeGreaterThanOrEqual(1);
      expect(budgetContract.evMetrics.targetChance).toBeGreaterThan(0);
    }
  }, 30_000);
});
