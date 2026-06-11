import type { MarketProvider } from './MarketProvider';
import { csfloatProvider } from './mockMarket';

/** Provider CSFloat - preparado para API real */
export class CSFloatProvider implements MarketProvider {
  private impl = csfloatProvider;
  readonly name = 'csfloat' as const;
  getPrices = (hash: string) => this.impl.getPrices(hash);
  getListings = (hash: string, maxFloat?: number) => this.impl.getListings(hash, maxFloat);
  getFloat = (id: string) => this.impl.getFloat(id);
  getMarketHashName = (name: string, st: boolean, wear?: string) =>
    this.impl.getMarketHashName(name, st, wear);
}

export const csfloatMarket = new CSFloatProvider();
