import type { MarketProvider } from './MarketProvider';
import { buffProvider } from './mockMarket';

/** Provider Buff163 - preparado para API real */
export class BuffProvider implements MarketProvider {
  private impl = buffProvider;
  readonly name = 'buff' as const;
  getPrices = (hash: string) => this.impl.getPrices(hash);
  getListings = (hash: string, maxFloat?: number) => this.impl.getListings(hash, maxFloat);
  getFloat = (id: string) => this.impl.getFloat(id);
  getMarketHashName = (name: string, st: boolean, wear?: string) =>
    this.impl.getMarketHashName(name, st, wear);
}

export const buffMarket = new BuffProvider();
