import { analyzeScenarios, buildTradeUpContract, calculateEVMetrics } from '@ct/engine';
import { loadBulkSteamPricesBrl, type PriceAggregator } from '@ct/pricing';
import type {
  Collection,
  ContractInput,
  ContractRule,
  SkinItem,
  TradeUpContract,
} from '@ct/types';
import { buildMarketHashName } from './trade-up-helpers.js';

const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.5);

function toBrl(price: number, currency: string): number {
  if (currency === 'BRL') return price;
  if (currency === 'USD') return Math.round(price * USD_TO_BRL * 100) / 100;
  return price;
}

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
  const catalog = await loadBulkSteamPricesBrl();

  await Promise.all(
    contract.outputs.map(async (output) => {
      const hash = buildMarketHashName(
        output.item.name,
        output.item.stattrak,
        output.expectedWear,
      );

      const catalogPrice = catalog.get(hash);
      if (catalogPrice && catalogPrice > 0) {
        output.price = catalogPrice;
        output.priceSource = 'bymykel';
        return;
      }

      const result = await params.priceAggregator.getPrice({
        marketHashName: hash,
        itemId: output.item.id,
        wear: output.expectedWear,
        float: output.expectedFloat,
        stattrak: output.item.stattrak,
      });

      if (result) {
        output.price = toBrl(result.quote.price, result.quote.currency);
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
