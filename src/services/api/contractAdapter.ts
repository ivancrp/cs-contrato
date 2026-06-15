import { analyzeMinLossScenario } from '../../math/ev';
import type { TradeUpContract, WearTier } from '../../models/types';

/** Adapta contrato legado para o schema da API @ct */
export function toApiContract(contract: TradeUpContract) {
  const totalCost = contract.evMetrics.totalCost;
  const targetId = contract.outputs.find((o) => o.isTarget)?.item.id ?? '';
  const analysis = analyzeMinLossScenario(contract.outputs, totalCost, targetId);

  const findOutput = (skinName: string) =>
    contract.outputs.find((o) => o.item.name === skinName);

  return {
    id: contract.id,
    ruleId: 'cs2_weapon_10',
    inputs: contract.inputs,
    outputs: contract.outputs,
    floatMetrics: {
      averageInputFloat: contract.floatMetrics.averageInputFloat,
      averageNormalizedFloat:
        (contract.floatMetrics as { averageNormalizedFloat?: number }).averageNormalizedFloat ??
        contract.floatMetrics.averageInputFloat,
      expectedOutputFloat: contract.floatMetrics.expectedOutputFloat,
      expectedWear: contract.floatMetrics.expectedWear,
      minPossibleFloat: contract.floatMetrics.minPossibleFloat,
      maxPossibleFloat: contract.floatMetrics.maxPossibleFloat,
    },
    evMetrics: {
      ...contract.evMetrics,
      lossChance:
        (contract.evMetrics as { lossChance?: number }).lossChance ??
        contract.outputs
          .filter((o) => o.price < totalCost)
          .reduce((s, o) => s + o.probability, 0),
    },
    worstCase: toScenarioCase(findOutput(analysis.worstCase.skin), analysis.worstCase, totalCost),
    bestCase: toScenarioCase(findOutput(analysis.bestCase.skin), analysis.bestCase, totalCost, true),
    collectionsUsed: contract.collectionsUsed,
  };
}

function toScenarioCase(
  output: TradeUpContract['outputs'][0] | undefined,
  legacy: { skin: string; value: number; loss?: number; gain?: number },
  totalCost: number,
  isGain = false,
) {
  const profitOrLoss = isGain
    ? (legacy.gain ?? 0)
    : -(legacy.loss ?? 0);

  return {
    skinId: output?.item.id ?? '',
    skinName: legacy.skin,
    float: output?.expectedFloat ?? 0,
    wear: (output?.expectedWear ?? 'Field-Tested') as WearTier,
    price: legacy.value,
    profitOrLoss,
    percent: totalCost > 0 ? (profitOrLoss / totalCost) * 100 : 0,
  };
}
