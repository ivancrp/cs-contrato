import type { MarketListing, WearTier } from '@ct/types';
import { floatToWear } from '@ct/engine';

const CSFLOAT_BASE = process.env.CSFLOAT_BASE_URL ?? 'https://csfloat.com/api/v1';
const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.5);

interface CSFloatListingItem {
  asset_id: string;
  def_index?: number;
  paint_index?: number;
  float_value: number;
  market_hash_name: string;
  inspect_link?: string;
}

interface CSFloatListing {
  id: string;
  price: number;
  item: CSFloatListingItem;
}

function parseStatTrak(marketHashName: string): boolean {
  return marketHashName.includes('StatTrak');
}

function parseBaseName(marketHashName: string): string {
  return marketHashName
    .replace('StatTrak™ ', '')
    .replace(/\s*\([^)]+\)$/, '');
}

function buildMarketHashName(name: string, stattrak: boolean, wear: WearTier): string {
  const prefix = stattrak ? 'StatTrak™ ' : '';
  return `${prefix}${name} (${wear})`;
}

export interface FetchCsfloatListingsOptions {
  marketHashName: string;
  maxFloat?: number;
  minFloat?: number;
  limit?: number;
  apiKey?: string;
}

/** Busca listings reais no CSFloat (server-side). */
export async function fetchCsfloatListings(
  options: FetchCsfloatListingsOptions,
): Promise<MarketListing[]> {
  const {
    marketHashName,
    maxFloat = 1,
    minFloat = 0,
    limit = 50,
    apiKey = process.env.CSFLOAT_API_KEY,
  } = options;

  const isStatTrak = parseStatTrak(marketHashName);
  const params = new URLSearchParams({
    market_hash_name: marketHashName,
    max_float: String(maxFloat),
    min_float: String(Math.max(0, minFloat)),
    limit: String(limit),
    sort_by: 'lowest_price',
    type: 'buy_now',
    category: isStatTrak ? '2' : '1',
  });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = apiKey;

  const response = await fetch(`${CSFLOAT_BASE}/listings?${params}`, { headers });
  if (!response.ok) {
    throw new Error(`CSFloat API: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: CSFloatListing[] };
  const baseName = parseBaseName(marketHashName);

  return (payload.data ?? [])
    .map((listing): MarketListing | null => {
      const floatValue = listing.item.float_value;
      if (floatValue < minFloat || floatValue > maxFloat) return null;

      const wear = floatToWear(floatValue);
      return {
        id: `csfloat-${listing.id}`,
        itemId: listing.item.asset_id,
        marketHashName: buildMarketHashName(baseName, isStatTrak, wear),
        marketplace: 'csfloat',
        price: Math.round((listing.price / 100) * USD_TO_BRL * 100) / 100,
        currency: 'BRL',
        float: floatValue,
        wear,
        stattrak: isStatTrak,
        inspectLink: listing.item.inspect_link,
        purchaseUrl: `https://csfloat.com/item/${listing.id}`,
      };
    })
    .filter((listing): listing is MarketListing => listing !== null);
}
