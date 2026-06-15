import { describe, it, expect } from 'vitest';
import { CS2_WEAPON_TRADE_UP_RULE, createCustomTradeUpRule } from '../rules/cs2-rules.js';

describe('ContractRule', () => {
  it('CS2 padrão usa 10 inputs', () => {
    expect(CS2_WEAPON_TRADE_UP_RULE.inputCount).toBe(10);
    expect(CS2_WEAPON_TRADE_UP_RULE.floatRules.useOfficialFormula).toBe(true);
  });

  it('createCustomTradeUpRule suporta 5 inputs', () => {
    const rule = createCustomTradeUpRule(5);
    expect(rule.inputCount).toBe(5);
    expect(rule.id).toBe('custom_5');
  });
});
