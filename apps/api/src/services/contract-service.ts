import { analyzeScenarios, buildTradeUpContract, calculateEVMetrics } from '@ct/engine';
import { loadBulkSteamPricesBrl, type PriceAggregator } from '@ct/pricing';
import type {
  Collection,
  ContractInput,
  ContractRule,
  Marketplace,
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
  preferredMarketplace?: Marketplace;
  poolPriceLookup?: (itemId: string, expectedFloat: number) => number;
}): Promise<TradeUpContract> {
  const contract = buildTradeUpContract({
    inputs: params.inputs,
    targetSkin: params.targetSkin,
    rule: params.rule,
    collections: params.collections,
    priceLookup: params.poolPriceLookup ?? (() => 0),
  });

  const totalCost = params.inputs.reduce((sum, input) => sum + input.listing.price, 0);
  const catalog = await loadBulkSteamPricesBrl();
  const preferLive = params.preferredMarketplace === 'csfloat';

  await Promise.all(
    contract.outputs.map(async (output) => {
      const hash = buildMarketHashName(
        output.item.name,
        output.item.stattrak,
        output.expectedWear,
      );

      if (params.poolPriceLookup) {
        const poolPrice = params.poolPriceLookup(output.item.id, output.expectedFloat);
        if (poolPrice > 0) {
          output.price = poolPrice;
          output.priceSource = preferLive ? 'csfloat' : 'bymykel';
        }
      }

      if (preferLive) {
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
          return;
        }

        if (output.price > 0) return;
      }

      if (output.price <= 0) {
        const catalogPrice = catalog.get(hash);
        if (catalogPrice && catalogPrice > 0) {
          output.price = catalogPrice;
          output.priceSource = 'bymykel';
          return;
        }
      }

      if (output.price <= 0) {
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
