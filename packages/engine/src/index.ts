import { validateContractInputs } from '@ct/contracts';
import type {
  Collection,
  ContractInput,
  ContractRule,
  SkinItem,
  TradeUpContract,
} from '@ct/types';
import { createId } from '@ct/common';
import { calculateFloatMetrics } from './float/wear-engine.js';
import { buildContractOutputs } from './probability/probability-engine.js';
import { analyzeScenarios, calculateEVMetrics } from './financial/financial-engine.js';

export interface BuildContractParams {
  inputs: ContractInput[];
  targetSkin: SkinItem;
  rule: ContractRule;
  collections: Collection[];
  priceLookup: (itemId: string, expectedFloat: number) => number;
}

/**
 * Orquestrador principal da engine — monta contrato completo com validação.
 */
export function buildTradeUpContract(params: BuildContractParams): TradeUpContract {
  const { inputs, targetSkin, rule, collections, priceLookup } = params;

  const validation = validateContractInputs(inputs, targetSkin, rule, collections);
  if (!validation.valid) {
    throw new Error(validation.reason ?? 'Contrato inválido');
  }

  const totalCost = inputs.reduce((sum, input) => sum + input.listing.price, 0);
  const outputs = buildContractOutputs(
    inputs,
    collections,
    targetSkin.rarity,
    targetSkin.stattrak,
    targetSkin.id,
    rule,
    priceLookup,
  );

  const floatMetrics = calculateFloatMetrics(inputs, targetSkin);
  const evMetrics = calculateEVMetrics(outputs, totalCost, targetSkin.id);
  const { worstCase, bestCase } = analyzeScenarios(outputs, totalCost);

  const collectionsUsed = [...new Set(inputs.map((i) => i.item.collectionId))];

  return {
    id: createId('contract'),
    ruleId: rule.id,
    inputs,
    outputs,
    floatMetrics,
    evMetrics,
    worstCase,
    bestCase,
    collectionsUsed,
  };
}

export * from './float/float-engine.js';
export * from './float/wear-engine.js';
export * from './probability/probability-engine.js';
export * from './financial/financial-engine.js';
