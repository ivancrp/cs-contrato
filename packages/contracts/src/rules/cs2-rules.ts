import type { ContractRule } from '@ct/types';

/**
 * Regra padrão CS2 para trade-up de armas (10 entradas).
 * Referência: https://counterstrike.fandom.com/wiki/Trade_Up_Contract
 */
export const CS2_WEAPON_TRADE_UP_RULE: ContractRule = {
  id: 'cs2_weapon_10',
  name: 'CS2 Weapon Trade Up (10 inputs)',
  description: 'Contrato oficial de 10 skins da mesma raridade, um tier abaixo da saída.',
  inputCount: 10,
  rarityRules: {
    inputTierOffset: -1,
    uniformInputRarity: true,
  },
  collectionRules: {
    blockedCollectionIds: [],
    requireOutputInSameCollection: true,
    proportionalByCollectionCount: true,
  },
  floatRules: {
    useOfficialFormula: true,
  },
  outputRules: {
    matchStatTrak: true,
    matchSouvenir: true,
    uniformWithinTier: true,
  },
};

/**
 * Regra configurável para contratos de 5 itens (extensível).
 * Parâmetros idênticos ao CS2 exceto quantidade — regras de jogo devem ser validadas externamente.
 */
export function createCustomTradeUpRule(inputCount: number, overrides?: Partial<ContractRule>): ContractRule {
  return {
    ...CS2_WEAPON_TRADE_UP_RULE,
    id: overrides?.id ?? `custom_${inputCount}`,
    name: overrides?.name ?? `Custom Trade Up (${inputCount} inputs)`,
    inputCount,
    ...overrides,
    rarityRules: { ...CS2_WEAPON_TRADE_UP_RULE.rarityRules, ...overrides?.rarityRules },
    collectionRules: { ...CS2_WEAPON_TRADE_UP_RULE.collectionRules, ...overrides?.collectionRules },
    floatRules: { ...CS2_WEAPON_TRADE_UP_RULE.floatRules, ...overrides?.floatRules },
    outputRules: { ...CS2_WEAPON_TRADE_UP_RULE.outputRules, ...overrides?.outputRules },
  };
}

/** Registry de regras — Strategy/Factory pattern */
export class ContractRuleRegistry {
  private rules = new Map<string, ContractRule>();

  constructor(initialRules: ContractRule[] = [CS2_WEAPON_TRADE_UP_RULE]) {
    for (const rule of initialRules) {
      this.rules.set(rule.id, rule);
    }
  }

  register(rule: ContractRule): void {
    this.rules.set(rule.id, rule);
  }

  get(id: string): ContractRule | undefined {
    return this.rules.get(id);
  }

  getOrThrow(id: string): ContractRule {
    const rule = this.rules.get(id);
    if (!rule) throw new Error(`ContractRule não encontrada: ${id}`);
    return rule;
  }

  list(): ContractRule[] {
    return [...this.rules.values()];
  }
}

export const defaultRuleRegistry = new ContractRuleRegistry();
