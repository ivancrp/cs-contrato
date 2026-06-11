import type { MarketProvider } from './MarketProvider';
import { skinportProvider } from './mockMarket';

/** Provider Skinport - preparado para API real */
export class SkinportProvider implements MarketProvider {
  private impl = skinportProvider;
  readonly name = 'skinport' as const;
  getPrices = (hash: string) => this.impl.getPrices(hash);
  getListings = (hash: string, maxFloat?: number) => this.impl.getListings(hash, maxFloat);
  getFloat = (id: string) => this.impl.getFloat(id);
  getMarketHashName = (name: string, st: boolean, wear?: string) =>
    this.impl.getMarketHashName(name, st, wear);
}

export const skinportMarket = new SkinportProvider();
