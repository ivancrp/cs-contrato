import { describe, it, expect } from 'vitest';
import { TIER_CONFIGS } from '../optimizer';

describe('TIER_CONFIGS', () => {
  it('inclui tier dedicado a 60% de chance na skin alvo', () => {
    const target60 = TIER_CONFIGS.find((config) => config.tierId === 'target_60');
    expect(target60?.minTargetChance).toBe(0.6);
    expect(target60?.poolType).toBe('target_heavy');
  });
});
