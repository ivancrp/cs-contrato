import { describe, it, expect } from 'vitest';
import { TIER_CONFIGS } from '../optimizer';

describe('TIER_CONFIGS', () => {
  it('tier de baixo investimento prioriza skins da coleção alvo', () => {
    const lowCost = TIER_CONFIGS.find((config) => config.mode === 'low_cost');
    expect(lowCost?.minTargetCount).toBeGreaterThanOrEqual(4);
    expect(lowCost?.targetRatio).toBe(0.4);
  });
});
