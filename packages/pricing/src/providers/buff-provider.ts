import type { PriceQuote } from '@ct/types';
import type { PriceProvider, PriceRequest } from './price-provider.js';
import { ByMykelPriceProvider } from './bymykel-provider.js';

const USD_TO_BRL = Number(process.env.USD_TO_BRL ?? 5.5);
const BUFF_MULTIPLIER = Number(process.env.BUFF_PRICE_MULTIPLIER ?? 0.9);

/** Estimativa Buff163 a partir do preço Steam (ByMykel) com desconto típico. */
export class BuffPriceProvider implements PriceProvider {
  readonly marketplace = 'buff' as const;
  readonly priority = 8;

  private delegate = new ByMykelPriceProvider();

  isAvailable(): Promise<boolean> {
    return this.delegate.isAvailable();
  }

  async getPrice(request: PriceRequest): Promise<PriceQuote | null> {
    const quote = await this.delegate.getPrice(request);
    if (!quote) return null;

    const priceBrl = quote.price * USD_TO_BRL * BUFF_MULTIPLIER;
    return {
      ...quote,
      marketplace: 'buff',
      price: Math.round(priceBrl * 100) / 100,
      currency: 'BRL',
    };
  }
}
