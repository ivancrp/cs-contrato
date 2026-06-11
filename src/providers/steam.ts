import type { MarketProvider } from './MarketProvider';
import { steamProvider } from './mockMarket';

/**
 * Provider Steam Market.
 * Atualmente delega ao mock; substituir por chamadas à Steam Market API.
 */
export class SteamMarketProvider implements MarketProvider {
  private impl = steamProvider;

  readonly name = 'steam' as const;

  getPrices = (hash: string) => this.impl.getPrices(hash);
  getListings = (hash: string, maxFloat?: number) => this.impl.getListings(hash, maxFloat);
  getFloat = (id: string) => this.impl.getFloat(id);
  getMarketHashName = (name: string, st: boolean, wear?: string) =>
    this.impl.getMarketHashName(name, st, wear);
}

export const steamMarket = new SteamMarketProvider();
