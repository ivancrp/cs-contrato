import { memoizeAsync } from '@ct/common';
import type { PriceQuote } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';

const SKINPORT_API = process.env.SKINPORT_API_URL ?? 'https://api.skinport.com/v1/items';
const EUR_TO_BRL = Number(process.env.EUR_TO_BRL ?? 6.0);

interface SkinportItem {
  market_hash_name: string;
  min_price?: number;
  suggested_price?: number;
  currency?: string;
}

/** Provider Skinport — catálogo público com cache. */
export class SkinportPriceProvider implements PriceProvider {
  readonly marketplace = 'skinport' as const;
  readonly priority = 3;

  private loadItems = memoizeAsync(
    async () => this.fetchItems(),
    () => 'skinport_items',
    300_000,
  );

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${SKINPORT_API}?app_id=730&currency=EUR`, {
        headers: { Accept: 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const items = await this.loadItems();
    const item = items.get(request.marketHashName);
    if (!item) return null;

    const eur = item.min_price ?? item.suggested_price;
    if (!eur || eur <= 0) return null;

    return {
      itemId: request.itemId ?? request.marketHashName,
      marketHashName: request.marketHashName,
      marketplace: 'skinport',
      price: Math.round(eur * EUR_TO_BRL * 100) / 100,
      currency: 'BRL',
      wear: request.wear ?? 'Field-Tested',
      float: request.float,
      stattrak: request.stattrak ?? false,
      fetchedAt: new Date().toISOString(),
    };
  }

  private async fetchItems(): Promise<Map<string, SkinportItem>> {
    const res = await fetch(`${SKINPORT_API}?app_id=730&currency=EUR`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return new Map();

    const data = (await res.json()) as SkinportItem[];
    const map = new Map<string, SkinportItem>();
    for (const item of data) {
      if (item.market_hash_name) {
        map.set(item.market_hash_name, item);
      }
    }
    return map;
  }
}
