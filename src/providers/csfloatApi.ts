import type { MarketListing } from '../models/types';
import { floatToWear } from '../math/wear';
import { buildMarketHashName } from '../utils/format';

/** Proxy local / Vercel — evita CORS e mantém a busca dentro do app. */
export const CSFLOAT_API_BASE = '/api/csfloat/v1';

const USD_TO_BRL = 5.5;

interface CSFloatListingItem {
  asset_id: string;
  float_value: number;
  market_hash_name: string;
}

interface CSFloatListing {
  id: string;
  price: number;
  item: CSFloatListingItem;
}

interface CSFloatListingsResponse {
  data?: CSFloatListing[];
}

function parseStatTrakFromHash(marketHashName: string): boolean {
  return marketHashName.includes('StatTrak');
}

function parseBaseName(marketHashName: string): string {
  return marketHashName
    .replace('StatTrak™ ', '')
    .replace(/\s*\([^)]+\)$/, '');
}

/**
 * Consulta listings reais no CSFloat (float + preço) via proxy interno.
 */
export async function fetchCSFloatListings(
  marketHashName: string,
  maxFloat: number,
  minFloat = 0,
): Promise<MarketListing[]> {
  const isStatTrak = parseStatTrakFromHash(marketHashName);
  const params = new URLSearchParams({
    market_hash_name: marketHashName,
    max_float: String(maxFloat),
    min_float: String(Math.max(0, minFloat)),
    limit: '50',
    sort_by: 'lowest_price',
    type: 'buy_now',
    category: isStatTrak ? '2' : '1',
  });

  const response = await fetch(`${CSFLOAT_API_BASE}/listings?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`CSFloat API: ${response.status}`);
  }

  const payload = (await response.json()) as CSFloatListingsResponse;
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
      };
    })
    .filter((listing): listing is MarketListing => listing !== null);
}
