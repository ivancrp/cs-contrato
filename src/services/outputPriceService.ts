import type { ContractOutput, Marketplace, SkinItem } from '../models/types';
import { buildMarketHashName } from '../utils/format';
import { floatToWear, WEAR_BOUNDS } from '../math/wear';
import { marketService } from './marketService';
import { priceService } from './priceService';

const FLOAT_TOLERANCE = 0.005;
const BETTER_FLOAT_DISCOUNT = 0.92;
const UNAVAILABLE_DISCOUNT = 0.85;

export type OutputPriceSource =
  | 'listing_exact'
  | 'listing_comparable'
  | 'wear_tier'
  | 'catalog'
  | 'fallback';

export interface ResolvedOutputPrice {
  price: number;
  theoreticalPrice: number;
  marketVerified: boolean;
  floatAvailable: boolean;
  source: OutputPriceSource;
  comparableFloat?: number;
  listingsCount: number;
}

const cache = new Map<string, ResolvedOutputPrice>();
const inflight = new Map<string, Promise<ResolvedOutputPrice>>();

function cacheKey(itemId: string, expectedFloat: number, marketplace: Marketplace): string {
  return `${marketplace}:${itemId}:${expectedFloat.toFixed(4)}`;
}

function pickLowest(listings: { float: number; price: number }[]): { float: number; price: number } | null {
  if (listings.length === 0) return null;
  return listings.reduce((best, current) => (current.price < best.price ? current : best));
}

/**
 * Resolve preço de venda realista para uma saída de contrato.
 * Prioriza listings do mercado no float esperado ou pior; usa desconto conservador quando indisponível.
 */
export async function resolveOutputPrice(
  item: SkinItem,
  expectedFloat: number,
  marketplace: Marketplace,
): Promise<ResolvedOutputPrice> {
  const key = cacheKey(item.id, expectedFloat, marketplace);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = resolveOutputPriceUncached(item, expectedFloat, marketplace);
  inflight.set(key, promise);

  try {
    const resolved = await promise;
    cache.set(key, resolved);
    return resolved;
  } finally {
    inflight.delete(key);
  }
}

async function resolveOutputPriceUncached(
  item: SkinItem,
  expectedFloat: number,
  marketplace: Marketplace,
): Promise<ResolvedOutputPrice> {
  const theoreticalPrice = priceService.getOutputPriceSync(
    item.name,
    item.stattrak,
    expectedFloat,
    marketplace,
  );

  const wear = floatToWear(expectedFloat);
  const wearMax = WEAR_BOUNDS[wear].max;
  const hash = buildMarketHashName(item.name, item.stattrak, wear);

  let listings: { float: number; price: number }[] = [];
  try {
    const raw = await marketService.getBestListings(hash, marketplace, wearMax);
    listings = raw
      .filter((listing) => listing.price > 0 && listing.float >= item.minFloat && listing.float <= item.maxFloat)
      .map((listing) => ({ float: listing.float, price: listing.price }));
  } catch {
    listings = [];
  }

  const exactMatches = listings.filter(
    (listing) => Math.abs(listing.float - expectedFloat) <= FLOAT_TOLERANCE,
  );
  const exactPick = pickLowest(exactMatches);
  if (exactPick) {
    return {
      price: exactPick.price,
      theoreticalPrice,
      marketVerified: true,
      floatAvailable: true,
      source: 'listing_exact',
      comparableFloat: exactPick.float,
      listingsCount: exactMatches.length,
    };
  }

  const comparableMatches = listings.filter((listing) => listing.float >= expectedFloat);
  const comparablePick = pickLowest(comparableMatches);
  if (comparablePick) {
    return {
      price: comparablePick.price,
      theoreticalPrice,
      marketVerified: true,
      floatAvailable: true,
      source: 'listing_comparable',
      comparableFloat: comparablePick.float,
      listingsCount: comparableMatches.length,
    };
  }

  const wearPick = pickLowest(listings);
  if (wearPick) {
    const discounted = Math.round(wearPick.price * BETTER_FLOAT_DISCOUNT * 100) / 100;
    return {
      price: discounted,
      theoreticalPrice,
      marketVerified: true,
      floatAvailable: false,
      source: 'wear_tier',
      comparableFloat: wearPick.float,
      listingsCount: listings.length,
    };
  }

  const catalogPrice = priceService.getPriceSync(item.name, item.stattrak, wear, marketplace);
  if (catalogPrice > 0) {
    const discounted = Math.round(catalogPrice * UNAVAILABLE_DISCOUNT * 100) / 100;
    return {
      price: discounted,
      theoreticalPrice,
      marketVerified: false,
      floatAvailable: false,
      source: 'catalog',
      listingsCount: 0,
    };
  }

  const fallback = priceService.getFallbackPrice(item.rarity, expectedFloat, item.stattrak);
  return {
    price: Math.round(fallback * UNAVAILABLE_DISCOUNT * 100) / 100,
    theoreticalPrice,
    marketVerified: false,
    floatAvailable: false,
    source: 'fallback',
    listingsCount: 0,
  };
}

export function applyResolvedPriceToOutput(
  output: ContractOutput,
  resolved: ResolvedOutputPrice,
): ContractOutput {
  return {
    ...output,
    price: resolved.price,
    theoreticalPrice: resolved.theoreticalPrice,
    marketVerified: resolved.marketVerified,
    floatAvailable: resolved.floatAvailable,
    priceSource: resolved.source,
    comparableFloat: resolved.comparableFloat,
    marketListingsCount: resolved.listingsCount,
  };
}

export function clearOutputPriceCache(): void {
  cache.clear();
  inflight.clear();
}
