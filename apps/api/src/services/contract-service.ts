import { analyzeScenarios, buildTradeUpContract, calculateEVMetrics } from '@ct/engine';
import type { PriceAggregator } from '@ct/pricing';
import type {
  Collection,
  ContractInput,
  ContractRule,
  SkinItem,
  TradeUpContract,
} from '@ct/types';

export async function buildContractWithMarketPrices(params: {
  inputs: ContractInput[];
  targetSkin: SkinItem;
  rule: ContractRule;
  collections: Collection[];
  priceAggregator: PriceAggregator;
}): Promise<TradeUpContract> {
  const contract = buildTradeUpContract({
    ...params,
    priceLookup: () => 0,
  });

  const totalCost = params.inputs.reduce((sum, input) => sum + input.listing.price, 0);

  await Promise.all(
    contract.outputs.map(async (output) => {
      const result = await params.priceAggregator.getPrice({
        marketHashName: output.item.name,
        itemId: output.item.id,
        wear: output.expectedWear,
        float: output.expectedFloat,
        stattrak: output.item.stattrak,
      });

      if (result) {
        output.price = result.quote.price;
        output.priceSource = result.provider;
      }
    }),
  );

  contract.evMetrics = calculateEVMetrics(
    contract.outputs,
    totalCost,
    params.targetSkin.id,
  );

  const scenarios = analyzeScenarios(contract.outputs, totalCost);
  contract.worstCase = scenarios.worstCase;
  contract.bestCase = scenarios.bestCase;

  return contract;
}
