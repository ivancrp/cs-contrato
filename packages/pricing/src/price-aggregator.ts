import { ByMykelPriceProvider } from './providers/bymykel-provider.js';
import { CsfloatPriceProvider } from './providers/csfloat-provider.js';
import type { CacheAdapter } from '@ct/common';
import type { AggregatedPrice, PriceProvider, PriceRequest } from './providers/price-provider.js';

/**
 * Agregador com fallback automático entre providers.
 * Ordena por priority (menor = preferido).
 */
export class PriceAggregator {
  private providers: PriceProvider[];

  constructor(
    providers: PriceProvider[],
    private cache?: CacheAdapter,
    private cacheTtl = 300,
  ) {
    this.providers = [...providers].sort((a, b) => a.priority - b.priority);
  }

  async getPrice(request: PriceRequest): Promise<AggregatedPrice | null> {
    const cacheKey = `price:${request.marketHashName}:${request.wear}:${request.float}`;

    if (this.cache) {
      const cached = await this.cache.get<AggregatedPrice>(cacheKey);
      if (cached) return cached;
    }

    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) continue;

        const quote = await provider.getPrice(request);
        if (quote) {
          const result: AggregatedPrice = {
            quote,
            provider: provider.marketplace,
            fallbackUsed: provider !== this.providers[0],
          };
          if (this.cache) {
            await this.cache.set(cacheKey, result, this.cacheTtl);
          }
          return result;
        }
      } catch (err) {
        console.warn(`[pricing] ${provider.marketplace} falhou:`, err);
      }
    }

    return null;
  }

  registerProvider(provider: PriceProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }
}

export function createDefaultPriceAggregator(cache?: CacheAdapter): PriceAggregator {
  return new PriceAggregator(
    [new CsfloatPriceProvider(), new ByMykelPriceProvider()],
    cache,
  );
}
