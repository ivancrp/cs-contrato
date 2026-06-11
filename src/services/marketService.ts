import type { Marketplace, MarketListing, PriceQuote } from '../models/types';
import { buffMarket } from '../providers/buff';
import { csfloatMarket } from '../providers/csfloat';
import type { MarketProvider } from '../providers/MarketProvider';
import { pricempireMarket } from '../providers/pricempire';
import { skinportMarket } from '../providers/skinport';
import { steamMarket } from '../providers/steam';

const PROVIDER_MAP: Record<Exclude<Marketplace, 'all'>, MarketProvider> = {
  steam: steamMarket,
  csfloat: csfloatMarket,
  skinport: skinportMarket,
  buff: buffMarket,
  pricempire: pricempireMarket,
};

/**
 * Serviço unificado de mercado.
 * Abstrai providers e aplica filtros de marketplace.
 */
export class MarketService {
  getProvider(marketplace: Marketplace): MarketProvider | MarketProvider[] {
    if (marketplace === 'all') {
      return [steamMarket, csfloatMarket, skinportMarket, buffMarket];
    }
    return PROVIDER_MAP[marketplace];
  }

  async getBestListings(
    marketHashName: string,
    marketplace: Marketplace,
    maxFloat?: number,
  ): Promise<MarketListing[]> {
    const providers = Array.isArray(this.getProvider(marketplace))
      ? (this.getProvider(marketplace) as MarketProvider[])
      : [this.getProvider(marketplace) as MarketProvider];

    const all = await Promise.all(
      providers.map((p) => p.getListings(marketHashName, maxFloat)),
    );

    return all.flat().sort((a, b) => a.price - b.price);
  }

  async getPrices(
    marketHashName: string,
    marketplace: Marketplace,
  ): Promise<PriceQuote[]> {
    if (marketplace === 'all') {
      return pricempireMarket.getPrices(marketHashName);
    }
    const provider = PROVIDER_MAP[marketplace];
    return provider.getPrices(marketHashName);
  }
}

export const marketService = new MarketService();
