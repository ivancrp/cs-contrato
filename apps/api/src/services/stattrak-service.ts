import { loadBulkSteamPricesBrl } from '@ct/pricing';
import type { SkinItem, WearTier } from '@ct/types';
import type { AppContext } from '../app-context.js';
import { buildMarketHashName } from './trade-up-helpers.js';

const DEFAULT_WEAR: WearTier = 'Field-Tested';

export interface StatTrakComparisonRow {
  skinName: string;
  weapon: string;
  rarity: string;
  wear: WearTier;
  normalPrice: number;
  stattrakPrice: number;
  savings: number;
  savingsPercent: number;
}

function catalogPrice(
  catalog: Map<string, number>,
  skinName: string,
  stattrak: boolean,
  wear: WearTier,
): number | undefined {
  const hash = buildMarketHashName(skinName, stattrak, wear);
  const price = catalog.get(hash);
  return price && price > 0 ? price : undefined;
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

/** Skins onde StatTrak™ custa menos que a versão normal (mesmo exterior). */
export async function getStatTrakComparisons(
  ctx: AppContext,
  options: { limit?: number; wear?: WearTier } = {},
): Promise<StatTrakComparisonRow[]> {
  const limit = Math.min(options.limit ?? 100, 200);
  const wear = options.wear ?? DEFAULT_WEAR;
  const catalog = await loadBulkSteamPricesBrl();
  const pairs = buildPairs(ctx.skins);
  const comparisons: StatTrakComparisonRow[] = [];

  for (const { normal, st } of pairs) {
    const normalPrice = catalogPrice(catalog, normal.name, false, wear);
    const stattrakPrice = catalogPrice(catalog, st.name, true, wear);
    if (!normalPrice || !stattrakPrice) continue;
    if (stattrakPrice >= normalPrice) continue;

    const savings = normalPrice - stattrakPrice;
    const savingsPercent = normalPrice > 0 ? (savings / normalPrice) * 100 : 0;

    comparisons.push({
      skinName: normal.name,
      weapon: normal.weapon,
      rarity: normal.rarity,
      wear,
      normalPrice: Math.round(normalPrice * 100) / 100,
      stattrakPrice: Math.round(stattrakPrice * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      savingsPercent: Math.round(savingsPercent * 10) / 10,
    });
  }

  comparisons.sort((a, b) => b.savingsPercent - a.savingsPercent || b.savings - a.savings);

  return comparisons.slice(0, limit);
}
