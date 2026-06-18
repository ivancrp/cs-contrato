import type { PriceQuote } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';
import { ByMykelPriceProvider } from './bymykel-provider.js';
import { SkinportPriceProvider } from './skinport-provider.js';

const BUFF_MULTIPLIER = Number(process.env.BUFF_PRICE_MULTIPLIER ?? 0.92);

/**
 * Buff163 — usa Skinport (API pública) como proxy de mercado asiático,
 * com fallback ByMykel × multiplicador.
 */
export class BuffPriceProvider implements PriceProvider {
  readonly marketplace = 'buff' as const;
  readonly priority = 8;

  private skinport = new SkinportPriceProvider();
  private bymykel = new ByMykelPriceProvider();

  isAvailable(): Promise<boolean> {
    return this.skinport.isAvailable();
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const fromSkinport = await this.skinport.getPrice(request);
    if (fromSkinport) {
      return {
        ...fromSkinport,
        marketplace: 'buff',
        price: Math.round(fromSkinport.price * BUFF_MULTIPLIER * 100) / 100,
      };
    }

    const fromSteam = await this.bymykel.getPrice(request);
    if (!fromSteam) return null;

    return {
      ...fromSteam,
      marketplace: 'buff',
      price: Math.round(fromSteam.price * BUFF_MULTIPLIER * 100) / 100,
      currency: 'BRL',
    };
  }
}
