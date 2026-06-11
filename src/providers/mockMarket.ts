import type { MarketListing, Marketplace, WearTier } from '../models/types';
import { floatToWear } from '../math/wear';
import { priceService } from '../services/priceService';
import { buildMarketHashName } from '../utils/format';
import type { MarketProvider } from './MarketProvider';

const WEAR_TIERS: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

const FLOAT_SAMPLES = [0.01, 0.04, 0.08, 0.12, 0.18, 0.25, 0.35];

function createProvider(marketplace: Exclude<Marketplace, 'all' | 'pricempire'>): MarketProvider {
  return {
    name: marketplace,

    getMarketHashName(skinName, stattrak, wear) {
      return buildMarketHashName(skinName, stattrak, wear);
    },

    async getPrices(marketHashName) {
      await priceService.preload();
      const isStatTrak = marketHashName.includes('StatTrak');
      const baseName = marketHashName
        .replace('StatTrak™ ', '')
        .replace(/\s*\([^)]+\)$/, '');

      const quotes = await Promise.all(
        WEAR_TIERS.map(async (wear) => {
          const price = await priceService.getPrice(baseName, isStatTrak, wear, marketplace);
          return {
            itemId: marketHashName,
            marketHashName: buildMarketHashName(baseName, isStatTrak, wear),
            marketplace,
            price,
            currency: 'BRL',
            wear,
            stattrak: isStatTrak,
          };
        }),
      );

      return quotes.filter((q) => q.price > 0);
    },

    async getListings(marketHashName, maxFloat = 1) {
      await priceService.preload();
      const isStatTrak = marketHashName.includes('StatTrak');
      const baseName = marketHashName
        .replace('StatTrak™ ', '')
        .replace(/\s*\([^)]+\)$/, '');

      const floats = FLOAT_SAMPLES.filter((f) => f <= maxFloat);
      const listings: MarketListing[] = [];

      for (const [i, f] of floats.entries()) {
        const price = await priceService.getPriceForFloat(baseName, isStatTrak, f, marketplace);
        if (price <= 0) continue;

        listings.push({
          id: `${marketplace}-${marketHashName}-${i}`,
          itemId: marketHashName,
          marketHashName: buildMarketHashName(baseName, isStatTrak, floatToWear(f)),
          marketplace,
          price,
          currency: 'BRL',
          float: f,
          wear: floatToWear(f),
          stattrak: isStatTrak,
        });
      }

      return listings;
    },

    async getFloat(listingId) {
      const parts = listingId.split('-');
      const idx = parseInt(parts[parts.length - 1] ?? '0', 10);
      return FLOAT_SAMPLES[idx] ?? 0.15;
    },
  };
}

export const steamProvider = createProvider('steam');
export const csfloatProvider = createProvider('csfloat');
export const skinportProvider = createProvider('skinport');
export const buffProvider = createProvider('buff');

export const ALL_PROVIDERS: MarketProvider[] = [
  steamProvider,
  csfloatProvider,
  skinportProvider,
  buffProvider,
];
