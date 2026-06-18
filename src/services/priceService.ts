import type { Marketplace, Rarity, WearTier } from '../models/types';
import { buildMarketHashName } from '../utils/format';
import { floatToWear, WEAR_BOUNDS } from '../math/wear';

const PRICE_API_URL =
  'https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json';

/** Taxa USD → BRL (Steam SCM em USD; exibição em reais) */
const USD_TO_BRL = 5.5;

const MARKETPLACE_MULTIPLIERS: Record<Exclude<Marketplace, 'all' | 'pricempire'>, number> = {
  steam: 1.12,
  csfloat: 1.0,
  skinport: 1.05,
  buff: 0.9,
};

const WEAR_ORDER: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

const FALLBACK_BASE: Record<Rarity, number> = {
  consumer: 0.5,
  industrial: 1.2,
  'mil-spec': 3,
  restricted: 12,
  classified: 45,
  covert: 180,
  extraordinary: 2500,
};

type PriceData = {
  metadata?: { currency?: string; updated_at?: string };
  prices: Record<string, number>;
};

/**
 * Preços reais do Steam Community Market (via ByMykel price tracker).
 * Valores em centavos USD convertidos para BRL.
 */
class PriceService {
  private prices = new Map<string, number>();
  private loadPromise: Promise<void> | null = null;
  private updatedAt: string | null = null;

  preload(): Promise<void> {
    return this.ensureLoaded();
  }

  getLastUpdated(): string | null {
    return this.updatedAt;
  }

  isLoaded(): boolean {
    return this.prices.size > 0;
  }

  async getPrice(
    skinName: string,
    stattrak: boolean,
    wear: WearTier,
    marketplace: Marketplace = 'all',
  ): Promise<number> {
    const hash = buildMarketHashName(skinName, stattrak, wear);
    const fromApi = await this.tryApiPrice(skinName, stattrak, wear, marketplace);
    if (fromApi > 0) return fromApi;

    await this.ensureLoaded();
    return this.resolvePrice(hash, marketplace);
  }

  async getOutputPrice(
    skinName: string,
    stattrak: boolean,
    expectedFloat: number,
    marketplace: Marketplace = 'all',
  ): Promise<number> {
    const wear = floatToWear(expectedFloat);
    const fromApi = await this.tryApiPrice(skinName, stattrak, wear, marketplace, expectedFloat);
    if (fromApi > 0) {
      const bounds = WEAR_BOUNDS[wear];
      const range = bounds.max - bounds.min || 1;
      const position = Math.min(Math.max((expectedFloat - bounds.min) / range, 0), 1);
      const floatMult = 1 + (1 - position) * 0.12;
      return Math.round(fromApi * floatMult * 100) / 100;
    }

    await this.ensureLoaded();
    return this.getOutputPriceSync(skinName, stattrak, expectedFloat, marketplace);
  }

  private async tryApiPrice(
    skinName: string,
    stattrak: boolean,
    wear: WearTier,
    marketplace: Marketplace,
    float?: number,
  ): Promise<number> {
    try {
      const { checkApiHealth, fetchPriceFromApi } = await import('./api/apiClient');
      if (!(await checkApiHealth())) return 0;

      const marketHashName = buildMarketHashName(skinName, stattrak, wear);
      const result = await fetchPriceFromApi(marketHashName, wear, float);
      if (!result?.quote?.price) return 0;
      return this.applyMarketplaceFromApi(result.quote.price, marketplace, result.quote.currency);
    } catch {
      return 0;
    }
  }

  private applyMarketplaceFromApi(
    price: number,
    marketplace: Marketplace,
    currency: string,
  ): number {
    let value = price;
    if (currency === 'USD') {
      value = price * USD_TO_BRL;
    }
    if (marketplace !== 'all' && marketplace in MARKETPLACE_MULTIPLIERS) {
      value *= MARKETPLACE_MULTIPLIERS[marketplace as keyof typeof MARKETPLACE_MULTIPLIERS];
    }
    return Math.round(value * 100) / 100;
  }

  async getPriceForFloat(
    skinName: string,
    stattrak: boolean,
    float: number,
    marketplace: Marketplace = 'all',
  ): Promise<number> {
    await this.ensureLoaded();
    return this.getPriceForFloatSync(skinName, stattrak, float, marketplace);
  }

  getPriceForFloatSync(
    skinName: string,
    stattrak: boolean,
    float: number,
    marketplace: Marketplace = 'all',
  ): number {
    const wear = floatToWear(float);
    const hash = buildMarketHashName(skinName, stattrak, wear);
    const base = this.resolvePrice(hash, marketplace);
    if (base <= 0) return 0;

    const bounds = WEAR_BOUNDS[wear];
    const range = bounds.max - bounds.min || 1;
    const position = Math.min(Math.max((float - bounds.min) / range, 0), 1);
    const floatMult = 1 + (1 - position) * 0.12;
    return Math.round(base * floatMult * 100) / 100;
  }

  getOutputPriceSync(
    skinName: string,
    stattrak: boolean,
    expectedFloat: number,
    marketplace: Marketplace = 'all',
  ): number {
    return this.getPriceForFloatSync(skinName, stattrak, expectedFloat, marketplace);
  }

  hasMarketPrice(skinName: string, stattrak: boolean, wear: WearTier): boolean {
    const hash = buildMarketHashName(skinName, stattrak, wear);
    return this.prices.has(hash);
  }

  getPriceSync(
    skinName: string,
    stattrak: boolean,
    wear: WearTier,
    marketplace: Marketplace = 'all',
  ): number {
    const hash = buildMarketHashName(skinName, stattrak, wear);
    return this.resolvePrice(hash, marketplace);
  }

  /** Fallback síncrono quando API ainda não carregou */
  getFallbackPrice(rarity: Rarity, float: number, stattrak: boolean): number {
    const stMult = stattrak ? 2.5 : 1;
    const floatMult = 1 + (1 - float) * 0.3;
    return Math.round(FALLBACK_BASE[rarity] * stMult * floatMult * 100) / 100;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.fetchPrices();
    return this.loadPromise;
  }

  private async fetchPrices(): Promise<void> {
    try {
      const res = await fetch(PRICE_API_URL);
      if (!res.ok) return;
      const data = (await res.json()) as PriceData;
      this.updatedAt = data.metadata?.updated_at ?? null;

      for (const [hash, cents] of Object.entries(data.prices ?? {})) {
        const usd = cents / 100;
        this.prices.set(hash, Math.round(usd * USD_TO_BRL * 100) / 100);
      }
    } catch {
      // Mantém fallback por raridade
    }
  }

  private resolvePrice(hash: string, marketplace: Marketplace): number {
    const direct = this.prices.get(hash);
    if (direct !== undefined) {
      return this.applyMarketplace(direct, marketplace);
    }

    const wear = this.extractWear(hash);
    if (wear) {
      for (const altWear of WEAR_ORDER) {
        const altHash = hash.replace(`(${wear})`, `(${altWear})`);
        const alt = this.prices.get(altHash);
        if (alt !== undefined) {
          const ratio = this.wearPriceRatio(altWear, wear);
          return this.applyMarketplace(Math.round(alt * ratio * 100) / 100, marketplace);
        }
      }
    }

    return 0;
  }

  private applyMarketplace(price: number, marketplace: Marketplace): number {
    if (price <= 0) return 0;
    const mult =
      marketplace === 'all' || marketplace === 'pricempire'
        ? 1
        : MARKETPLACE_MULTIPLIERS[marketplace] ?? 1;
    return Math.round(price * mult * 100) / 100;
  }

  private extractWear(hash: string): WearTier | null {
    const match = hash.match(/\(([^)]+)\)$/);
    if (!match) return null;
    return WEAR_ORDER.find((w) => w === match[1]) ?? null;
  }

  private wearPriceRatio(from: WearTier, to: WearTier): number {
    const ratios: Record<WearTier, number> = {
      'Factory New': 1,
      'Minimal Wear': 0.72,
      'Field-Tested': 0.45,
      'Well-Worn': 0.32,
      'Battle-Scarred': 0.22,
    };
    return (ratios[to] ?? 0.5) / (ratios[from] ?? 0.5);
  }
}

export const priceService = new PriceService();
