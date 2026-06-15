import { memoizeAsync } from '@ct/common';
import type { PriceQuote, WearTier } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';

const BYMYKEL_URL =
  process.env.BYMYKEL_PRICES_URL ??
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/prices.json';

interface ByMykelEntry {
  id: string;
  name: string;
  price?: number;
}

/** Provider ByMykel — catálogo de preços Steam (USD) */
export class ByMykelPriceProvider implements PriceProvider {
  readonly marketplace = 'bymykel' as const;
  readonly priority = 10;

  private fetchPrices = memoizeAsync(
    async () => this.loadPrices(),
    () => 'bymykel_prices',
    300_000,
  );

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(BYMYKEL_URL, { method: 'HEAD' });
      return res.ok;
    } catch {
      return true;
    }
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const prices = await this.fetchPrices();
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

  private async loadPrices(): Promise<Map<string, ByMykelEntry>> {
    const res = await fetch(BYMYKEL_URL);
    if (!res.ok) throw new Error(`ByMykel fetch failed: ${res.status}`);
    const data = (await res.json()) as ByMykelEntry[];
    const map = new Map<string, ByMykelEntry>();
    for (const entry of data) {
      map.set(entry.name, entry);
    }
    return map;
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
