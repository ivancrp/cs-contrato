import type { MarketListing, Marketplace, PriceQuote } from '../models/types';

/**
 * Interface base para integração com marketplaces.
 * Cada provider implementa esta interface sem alterar o restante do sistema.
 */
export interface MarketProvider {
  readonly name: Marketplace;

  /** Retorna preços agregados para um hash name */
  getPrices(marketHashName: string): Promise<PriceQuote[]>;

  /** Retorna listagens disponíveis com float específico */
  getListings(marketHashName: string, maxFloat?: number): Promise<MarketListing[]>;

  /** Obtém float de um listing específico */
  getFloat(listingId: string): Promise<number>;

  /** Converte item para market hash name do marketplace */
  getMarketHashName(
    skinName: string,
    stattrak: boolean,
    wear?: string,
  ): string;
}
