import type {
  LiquidityMetrics,
  Marketplace,
  PriceHistoryPoint,
  PriceQuote,
  WearTier,
} from '@ct/types';

export interface PriceRequest {
  marketHashName: string;
  itemId?: string;
  wear?: WearTier;
  float?: number;
  stattrak?: boolean;
}

/** Interface unificada — cada provider é independente */
export interface PriceProvider {
  readonly marketplace: Marketplace;
  readonly priority: number;

  getPrice(request: PriceRequest): Promise<PriceQuote | null>;
  getHistory?(request: PriceRequest, days?: number): Promise<PriceHistoryPoint[]>;
  getLiquidity?(request: PriceRequest): Promise<LiquidityMetrics | null>;
  getVolume?(request: PriceRequest): Promise<{
    daily?: number;
    weekly?: number;
    monthly?: number;
  } | null>;

  isAvailable(): Promise<boolean>;
}

export interface AggregatedPrice {
  quote: PriceQuote;
  provider: Marketplace;
  fallbackUsed: boolean;
}
