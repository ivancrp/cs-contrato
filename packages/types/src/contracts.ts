import type { Rarity } from './rarity.js';

/** Regras de raridade configuráveis por tipo de contrato */
export interface RarityRules {
  /** Raridade exigida para todas as entradas (ou derivada da alvo) */
  requiredInputRarity?: Rarity;
  /** Raridade da saída alvo */
  targetOutputRarity?: Rarity;
  /** Offset de tier: -1 = um tier abaixo da saída (padrão CS2 armas) */
  inputTierOffset: number;
  /** Todas entradas devem ter mesma raridade */
  uniformInputRarity: boolean;
}

/** Regras de coleção */
export interface CollectionRules {
  /** Coleções limitadas (mapas/operações) não elegíveis como entrada */
  blockedCollectionIds: string[];
  /** Cada coleção presente deve ter saída no tier alvo */
  requireOutputInSameCollection: boolean;
  /** Probabilidade proporcional ao count de inputs por coleção */
  proportionalByCollectionCount: boolean;
}

/** Regras de float */
export interface FloatRules {
  /** Usar fórmula oficial: min + avgNorm * (max - min) */
  useOfficialFormula: boolean;
}

/** Regras de saída */
export interface OutputRules {
  /** StatTrak entrada deve coincidir com saída */
  matchStatTrak: boolean;
  /** Souvenir entrada deve coincidir com saída */
  matchSouvenir: boolean;
  /** Distribuição uniforme entre skins do mesmo tier na coleção */
  uniformWithinTier: boolean;
}

/**
 * Contrato genérico configurável — a engine nunca assume valores fixos.
 * CS2 padrão (10 skins) é uma implementação via Cs2WeaponTradeUpRule.
 */
export interface ContractRule {
  id: string;
  name: string;
  description: string;
  inputCount: number;
  rarityRules: RarityRules;
  collectionRules: CollectionRules;
  floatRules: FloatRules;
  outputRules: OutputRules;
}

export interface ContractValidationResult {
  valid: boolean;
  reason?: string;
  ruleId: string;
}

/** Parâmetros de taxas financeiras */
export interface FeeConfig {
  steamFeePercent: number;
  csfloatFeePercent: number;
  customFeePercent?: number;
  slippagePercent?: number;
}

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  steamFeePercent: 15,
  csfloatFeePercent: 2,
  slippagePercent: 0,
};
