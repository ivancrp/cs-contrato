import type { PriceQuote } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';

const CSFLOAT_BASE =
  process.env.CSFLOAT_BASE_URL ?? 'https://csfloat.com/api/v1';

interface CsfloatListing {
  id: string;
  price: number;
  item: {
    market_hash_name: string;
    float_value: number;
    paint_wear?: number;
    is_stattrak?: boolean;
  };
}

/** Provider CSFloat — listings reais */
export class CsfloatPriceProvider implements PriceProvider {
  readonly marketplace = 'csfloat' as const;
  readonly priority = 1;

  constructor(private apiKey?: string) {
    this.apiKey = apiKey ?? process.env.CSFLOAT_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${CSFLOAT_BASE}/listings?limit=1`);
      return res.ok || res.status === 401;
    } catch {
      return false;
    }
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const params = new URLSearchParams({
      market_hash_name: request.marketHashName,
      limit: '1',
      sort_by: 'lowest_price',
    });

    if (request.float !== undefined) {
      params.set('min_float', String(Math.max(0, request.float - 0.01)));
      params.set('max_float', String(Math.min(1, request.float + 0.01)));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers.Authorization = this.apiKey;

    const res = await fetch(`${CSFLOAT_BASE}/listings?${params}`, { headers });
    if (!res.ok) return null;

    const data = (await res.json()) as { data?: CsfloatListing[] };
    const listing = data.data?.[0];
    if (!listing) return null;

    return {
      itemId: request.itemId ?? listing.id,
      marketHashName: listing.item.market_hash_name,
      marketplace: 'csfloat',
      price: listing.price / 100,
      currency: 'USD',
      wear: request.wear ?? 'Field-Tested',
      float: listing.item.float_value ?? listing.item.paint_wear,
      stattrak: listing.item.is_stattrak ?? false,
      fetchedAt: new Date().toISOString(),
    };
  }
}
