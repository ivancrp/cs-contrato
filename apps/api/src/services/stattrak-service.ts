import { createDefaultPriceAggregator } from '@ct/pricing';
import type { SkinItem, WearTier } from '@ct/types';
import type { AppContext } from '../app-context.js';
import { buildMarketHashName } from './trade-up-helpers.js';

const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.5);
const DEFAULT_WEAR: WearTier = 'Field-Tested';

export interface StatTrakComparisonRow {
  skinName: string;
  weapon: string;
  rarity: string;
  wear: WearTier;
  normalPrice: number;
  stattrakPrice: number;
  premium: number;
  premiumPercent: number;
  normalSource: string;
  stattrakSource: string;
}

function toBrl(price: number, currency: string): number {
  if (currency === 'USD') return Math.round(price * USD_TO_BRL * 100) / 100;
  return Math.round(price * 100) / 100;
}

async function fetchWearPrice(
  skinName: string,
  stattrak: boolean,
  wear: WearTier,
  ctx: AppContext,
): Promise<{ price: number; source: string } | null> {
  const aggregator = createDefaultPriceAggregator(ctx.cache);
  const marketHashName = buildMarketHashName(skinName, stattrak, wear);
  const result = await aggregator.getPrice({ marketHashName, wear });
  if (!result?.quote?.price) return null;

  return {
    price: toBrl(result.quote.price, result.quote.currency),
    source: result.provider,
  };
}

function buildPairs(skins: SkinItem[]): Array<{ normal: SkinItem; st: SkinItem }> {
  const byName = new Map<string, SkinItem[]>();
  for (const skin of skins) {
    if (skin.souvenir) continue;
    if (!byName.has(skin.name)) byName.set(skin.name, []);
    byName.get(skin.name)!.push(skin);
  }

  const pairs: Array<{ normal: SkinItem; st: SkinItem }> = [];
  for (const variants of byName.values()) {
    const normal = variants.find((s) => !s.stattrak);
    const st = variants.find((s) => s.stattrak);
    if (normal && st) pairs.push({ normal, st });
  }

  return pairs;
}

export async function getStatTrakComparisons(
  ctx: AppContext,
  options: { limit?: number; wear?: WearTier; batchSize?: number } = {},
): Promise<StatTrakComparisonRow[]> {
  const limit = Math.min(options.limit ?? 100, 200);
  const wear = options.wear ?? DEFAULT_WEAR;
  const batchSize = options.batchSize ?? 8;

  const pairs = buildPairs(ctx.skins);
  const comparisons: StatTrakComparisonRow[] = [];

  for (let i = 0; i < pairs.length && comparisons.length < limit; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async ({ normal, st }) => {
        const [normalQuote, stQuote] = await Promise.all([
          fetchWearPrice(normal.name, false, wear, ctx),
          fetchWearPrice(st.name, true, wear, ctx),
        ]);

        if (!normalQuote || !stQuote) return null;

        const premium = stQuote.price - normalQuote.price;
        const premiumPercent =
          normalQuote.price > 0 ? (premium / normalQuote.price) * 100 : 0;

        return {
          skinName: normal.name,
          weapon: normal.weapon,
          rarity: normal.rarity,
          wear,
          normalPrice: normalQuote.price,
          stattrakPrice: stQuote.price,
          premium: Math.round(premium * 100) / 100,
          premiumPercent: Math.round(premiumPercent * 10) / 10,
          normalSource: normalQuote.source,
          stattrakSource: stQuote.source,
        } satisfies StatTrakComparisonRow;
      }),
    );

    for (const row of results) {
      if (row) comparisons.push(row);
    }
  }

  comparisons.sort(
    (a, b) => Math.abs(b.premiumPercent) - Math.abs(a.premiumPercent) || b.premium - a.premium,
  );

  return comparisons.slice(0, limit);
}
