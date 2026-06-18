import type { PriceQuote } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';
import { ByMykelPriceProvider } from './bymykel-provider.js';

const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.5);

/** Preços Steam SCM via catálogo ByMykel, rotulados como marketplace steam. */
export class SteamPriceProvider implements PriceProvider {
  readonly marketplace = 'steam' as const;
  readonly priority = 5;

  private delegate = new ByMykelPriceProvider();

  isAvailable(): Promise<boolean> {
    return this.delegate.isAvailable();
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const quote = await this.delegate.getPrice(request);
    if (!quote) return null;

    return {
      ...quote,
      marketplace: 'steam',
      price: Math.round(quote.price * USD_TO_BRL * 100) / 100,
      currency: 'BRL',
    };
  }
}
