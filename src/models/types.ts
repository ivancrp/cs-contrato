/** Raridades do CS2 em ordem crescente */
export type Rarity =
  | 'consumer'
  | 'industrial'
  | 'mil-spec'
  | 'restricted'
  | 'classified'
  | 'covert'
  | 'extraordinary';

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
  | 'all';

export type OptimizationMode =
  | 'balanced'
  | 'low_cost'
  | 'high_chance'
  | 'min_loss';

export type AlgorithmType =
  | 'branch_and_bound'
  | 'simulated_annealing'
  | 'genetic'
  | 'heuristic';

/** Skin base do catálogo (sem float/preço dinâmico) */
export interface SkinItem {
  id: string;
  name: string;
  weapon: string;
  collectionId: string;
  rarity: Rarity;
  minFloat: number;
  maxFloat: number;
  stattrak: boolean;
  /** Souvenir não pode entrar em trade up */
  souvenir?: boolean;
  imageUrl?: string;
}

export interface Collection {
  id: string;
  name: string;
  items: SkinItem[];
}

/** Listagem de mercado com preço e float específicos */
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
}

/** Entrada selecionada para o contrato (1 das 10 skins) */
export interface ContractInput {
  listing: MarketListing;
  item: SkinItem;
}

/** Saída possível com probabilidade calculada */
export interface ContractOutput {
  item: SkinItem;
  probability: number;
  expectedFloat: number;
  expectedWear: WearTier;
  price: number;
  isTarget: boolean;
}

/** Métricas de EV e risco */
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
  /** Probabilidade de saída com preço >= custo (lucro ou break-even) */
  breakEvenChance: number;
  /** EV igual ao custo (margem zero) */
  isBreakEven: boolean;
  riskScore: number;
}

export interface FloatMetrics {
  averageInputFloat: number;
  expectedOutputFloat: number;
  expectedWear: WearTier;
  minPossibleFloat: number;
  maxPossibleFloat: number;
}

/** Contrato completo otimizado */
export interface TradeUpContract {
  id: string;
  tier: 'budget' | 'balanced' | 'premium' | 'ai_best' | 'min_loss';
  tierLabel: string;
  inputs: ContractInput[];
  outputs: ContractOutput[];
  floatMetrics: FloatMetrics;
  evMetrics: EVMetrics;
  aiScore: number;
  algorithmUsed: AlgorithmType;
  collectionsUsed: string[];
}

export interface TargetSearchParams {
  skinName: string;
  stattrak: boolean;
  wear: WearTier;
  maxFloat: number;
  budget: number;
  marketplace: Marketplace;
  mode: OptimizationMode;
}

export interface SimulationResult {
  iterations: number;
  targetObtained: number;
  outputCounts: Record<string, number>;
  averageProfit: number;
  averageLoss: number;
  /** EV observado na simulação: Σ(freq × preço) */
  observedEV: number;
  /** Contratos com lucro >= 0 */
  breakEvenCount: number;
  profitDistribution: { bucket: string; count: number }[];
  histogram: { range: string; count: number; percentage?: number }[];
}

export interface MinLossAnalysis {
  worstCase: { skin: string; value: number; loss: number };
  bestCase: { skin: string; value: number; gain: number };
  /** Métricas quando a skin alvo não é obtida */
  nonTargetExpectedValue: number;
  nonTargetRoi: number;
  nonTargetAverageProfit: number;
  nonTargetDistribution: { skin: string; probability: number; price: number }[];
}

export interface ContractHistoryEntry {
  id: string;
  createdAt: string;
  params: TargetSearchParams;
  contracts: TradeUpContract[];
}

export interface SimulationRecord {
  id: string;
  contractId: string;
  createdAt: string;
  result: SimulationResult;
}

/** Representação do schema de banco de dados */
export interface DatabaseSchema {
  collections: Collection[];
  items: SkinItem[];
  prices: PriceQuote[];
  contracts: ContractHistoryEntry[];
  simulations: SimulationRecord[];
}
