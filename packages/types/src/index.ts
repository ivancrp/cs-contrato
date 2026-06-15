import type { Rarity } from './rarity.js';

export type { Rarity } from './rarity.js';

export type WearTier =
  | 'Factory New'
  | 'Minimal Wear'
  | 'Field-Tested'
  | 'Well-Worn'
  | 'Battle-Scarred';

export type Marketplace =
  | 'steam'
  | 'csfloat'
  | 'skinport'
  | 'buff'
  | 'pricempire'
  | 'bymykel'
  | 'all';

export type ProbabilitySource = 'official' | 'community' | 'estimated' | 'unknown';

/** Metadata de probabilidade — nunca apresentar estimativas como oficiais */
export interface ProbabilityMetadata {
  probability: number;
  source: ProbabilitySource;
  /** 0–1 quando conhecido; undefined se source === 'unknown' */
  confidence?: number;
  reference?: string;
  updatedAt?: string;
}

export type OptimizationStrategy =
  | 'max_profit'
  | 'max_ev'
  | 'min_loss'
  | 'max_profit_chance'
  | 'min_risk'
  | 'max_sharpe'
  | 'risk_adjusted_return';

export type AlgorithmType =
  | 'branch_and_bound'
  | 'simulated_annealing'
  | 'genetic'
  | 'heuristic'
  | 'exhaustive';

/** Skin base do catálogo */
export interface SkinItem {
  id: string;
  name: string;
  weapon: string;
  collectionId: string;
  rarity: Rarity;
  minFloat: number;
  maxFloat: number;
  stattrak: boolean;
  souvenir?: boolean;
  imageUrl?: string;
  paintIndex?: string;
  finishCatalog?: string;
}

export interface Collection {
  id: string;
  name: string;
  items: SkinItem[];
  imageUrl?: string;
}

/** Caixa / crate — probabilidades sempre com metadata */
export interface Crate {
  id: string;
  name: string;
  collectionId?: string;
  year?: number;
  status: 'active' | 'discontinued' | 'unknown';
  dropPool?: string;
  skins: CrateDrop[];
  knives: CrateDrop[];
  gloves: CrateDrop[];
}

export interface CrateDrop {
  skinId: string;
  probability: ProbabilityMetadata;
}

export interface MarketListing {
  id: string;
  itemId: string;
  marketHashName: string;
  marketplace: Marketplace;
  price: number;
  currency: string;
  float: number;
  wear: WearTier;
  stattrak: boolean;
  souvenir?: boolean;
  purchaseUrl?: string;
  inspectLink?: string;
}

export interface PriceQuote {
  itemId: string;
  marketHashName: string;
  marketplace: Marketplace;
  price: number;
  currency: string;
  wear: WearTier;
  float?: number;
  stattrak: boolean;
  liquidity?: number;
  volumeDaily?: number;
  volumeWeekly?: number;
  volumeMonthly?: number;
  fetchedAt: string;
}

export interface ContractInput {
  listing: MarketListing;
  item: SkinItem;
}

export interface ContractOutput {
  item: SkinItem;
  probability: number;
  probabilityMeta?: ProbabilityMetadata;
  expectedFloat: number;
  expectedWear: WearTier;
  price: number;
  isTarget: boolean;
  priceSource?: string;
}

export interface EVMetrics {
  expectedValue: number;
  totalCost: number;
  expectedProfit: number;
  roi: number;
  marginPercent: number;
  maxLoss: number;
  averageLoss: number;
  averageGain: number;
  targetChance: number;
  breakEvenChance: number;
  lossChance: number;
  isBreakEven: boolean;
  riskScore: number;
  sharpeRatio?: number;
  standardDeviation?: number;
}

export interface ScenarioCase {
  skinId: string;
  skinName: string;
  float: number;
  wear: WearTier;
  price: number;
  profitOrLoss: number;
  percent: number;
}

export interface FloatMetrics {
  averageInputFloat: number;
  averageNormalizedFloat: number;
  expectedOutputFloat: number;
  expectedWear: WearTier;
  minPossibleFloat: number;
  maxPossibleFloat: number;
  floatForFN?: number;
  floatForMW?: number;
  floatForFT?: number;
  floatForWW?: number;
  floatForBS?: number;
}

export interface TradeUpContract {
  id: string;
  ruleId: string;
  inputs: ContractInput[];
  outputs: ContractOutput[];
  floatMetrics: FloatMetrics;
  evMetrics: EVMetrics;
  worstCase: ScenarioCase;
  bestCase: ScenarioCase;
  collectionsUsed: string[];
}

export interface SimulationResult {
  iterations: number;
  targetObtained: number;
  outputCounts: Record<string, number>;
  averageProfit: number;
  averageLoss: number;
  observedEV: number;
  observedROI: number;
  standardDeviation: number;
  profitChance: number;
  lossChance: number;
  breakEvenChance: number;
  breakEvenCount: number;
  profitDistribution: { bucket: string; count: number }[];
  histogram: { range: string; count: number; percentage: number }[];
}

export interface LiquidityMetrics {
  score: number;
  volumeDaily?: number;
  volumeWeekly?: number;
  volumeMonthly?: number;
  spread?: number;
}

export interface PriceHistoryPoint {
  timestamp: string;
  price: number;
  marketplace: Marketplace;
}

export * from './contracts.js';
