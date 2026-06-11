import type { MarketListing, PriceQuote } from '../models/types';
import type { MarketProvider } from './MarketProvider';
import { ALL_PROVIDERS } from './mockMarket';

/**
 * Provider Pricempire - agrega preços de múltiplos marketplaces.
 * Preparado para integração com Pricempire API.
 */
export class PricempireProvider implements MarketProvider {
  readonly name = 'pricempire' as const;

  getMarketHashName(skinName: string, stattrak: boolean, wear?: string): string {
    const prefix = stattrak ? 'StatTrak™ ' : '';
    const suffix = wear ? ` (${wear})` : '';
    return `${prefix}${skinName}${suffix}`;
  }

  async getPrices(marketHashName: string): Promise<PriceQuote[]> {
    const results = await Promise.all(
      ALL_PROVIDERS.map((p) => p.getPrices(marketHashName)),
    );
    return results.flat();
  }

  async getListings(marketHashName: string, maxFloat?: number): Promise<MarketListing[]> {
    const results = await Promise.all(
      ALL_PROVIDERS.map((p) => p.getListings(marketHashName, maxFloat)),
    );
    return results.flat().sort((a, b) => a.price - b.price);
  }

  async getFloat(listingId: string): Promise<number> {
    const provider = ALL_PROVIDERS.find((p) => listingId.startsWith(p.name));
    return provider?.getFloat(listingId) ?? 0.15;
  }
}

export const pricempireMarket = new PricempireProvider();
