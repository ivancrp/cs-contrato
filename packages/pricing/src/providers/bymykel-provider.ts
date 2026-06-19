import { memoizeAsync } from '@ct/common';
import type { PriceQuote, WearTier } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';

const BYMYKEL_URL =
  process.env.BYMYKEL_PRICES_URL ??
  'https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json';

const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.5);

interface ByMykelEntry {
  id: string;
  name: string;
  price?: number;
}

interface ByMykelLatestFile {
  metadata?: { currency?: string };
  prices?: Record<string, number>;
}


async function fetchPriceCatalog(): Promise<Map<string, ByMykelEntry>> {
  const res = await fetch(BYMYKEL_URL);
  if (!res.ok) throw new Error(`ByMykel fetch failed: ${res.status}`);

  const data = (await res.json()) as ByMykelLatestFile | ByMykelEntry[];
  const map = new Map<string, ByMykelEntry>();

  if (Array.isArray(data)) {
    for (const entry of data) {
      if (!entry.price || entry.price <= 0) continue;
      map.set(entry.name, entry);
    }
    return map;
  }

  if (data.prices) {
    for (const [name, rawPrice] of Object.entries(data.prices)) {
      if (!rawPrice || rawPrice <= 0) continue;
      const priceUsd = rawPrice / 100;
      map.set(name, { id: name, name, price: priceUsd });
    }
  }

  return map;
}

const memoizedCatalog = memoizeAsync(
  async () => fetchPriceCatalog(),
  () => 'bymykel_prices',
  300_000,
);

/** Mapa market_hash_name → preço em BRL (bulk, cacheado). */
export async function loadBulkSteamPricesBrl(): Promise<Map<string, number>> {
  const catalog = await memoizedCatalog();
  const map = new Map<string, number>();

  for (const [name, entry] of catalog) {
    if (!entry.price || entry.price <= 0) continue;
    map.set(name, Math.round(entry.price * USD_TO_BRL * 100) / 100);
  }

  return map;
}

/** Provider ByMykel — catálogo de preços Steam (USD) */
export class ByMykelPriceProvider implements PriceProvider {
  readonly marketplace = 'bymykel' as const;
  readonly priority = 10;

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(BYMYKEL_URL, { method: 'HEAD' });
      return res.ok;
    } catch {
      return true;
    }
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const prices = await memoizedCatalog();
    const entry = prices.get(request.marketHashName);
    if (!entry?.price) return null;

    return {
      itemId: request.itemId ?? entry.id,
      marketHashName: request.marketHashName,
      marketplace: 'bymykel',
      price: entry.price,
      currency: 'USD',
      wear: request.wear ?? 'Field-Tested',
      float: request.float,
      stattrak: request.stattrak ?? false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function wearSuffix(wear: WearTier): string {
  const map: Record<WearTier, string> = {
    'Factory New': 'Factory New',
    'Minimal Wear': 'Minimal Wear',
    'Field-Tested': 'Field-Tested',
    'Well-Worn': 'Well-Worn',
    'Battle-Scarred': 'Battle-Scarred',
  };
  return map[wear];
}
