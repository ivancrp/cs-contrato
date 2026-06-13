import type { MarketListing, Marketplace, PriceQuote } from '../models/types';
import type { MarketProvider } from './MarketProvider';
import { csfloatProvider } from './mockMarket';
import { fetchCSFloatListings } from './csfloatApi';

/** Provider CSFloat — busca listings reais via proxy interno, com fallback local. */
export class CSFloatProvider implements MarketProvider {
  private fallback = csfloatProvider;
  readonly name = 'csfloat' as const;

  getMarketHashName = (name: string, st: boolean, wear?: string) =>
    this.fallback.getMarketHashName(name, st, wear);

  async getPrices(marketHashName: string): Promise<PriceQuote[]> {
    try {
      const listings = await fetchCSFloatListings(marketHashName, 1);
      if (listings.length > 0) {
        return listings.map((listing) => ({
          itemId: listing.itemId,
          marketHashName: listing.marketHashName,
          marketplace: 'csfloat' as Marketplace,
          price: listing.price,
          currency: listing.currency,
          wear: listing.wear,
          float: listing.float,
          stattrak: listing.stattrak,
        }));
      }
    } catch {
      // Fallback abaixo
    }
    return this.fallback.getPrices(marketHashName);
  }

  async getListings(marketHashName: string, maxFloat = 1): Promise<MarketListing[]> {
    try {
      const listings = await fetchCSFloatListings(marketHashName, maxFloat);
      if (listings.length > 0) return listings;
    } catch {
      // Fallback abaixo
    }
    return this.fallback.getListings(marketHashName, maxFloat);
  }

  getFloat = (id: string) => this.fallback.getFloat(id);
}

export const csfloatMarket = new CSFloatProvider();
