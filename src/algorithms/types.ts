import type { ContractInput, ContractOutput, OptimizationMode, Rarity, SkinItem } from '../models/types';

export interface CandidateListing {
  listingId: string;
  itemId: string;
  collectionId: string;
  rarity: Rarity;
  stattrak: boolean;
  price: number;
  float: number;
  /** Wear normalizado (0–1) dentro do range da skin. */
  normalizedFloat: number;
  /** Distância do wear ideal para atingir o desgate alvo (menor = melhor). */
  floatFitScore: number;
  isTargetCollection: boolean;
}

/** Representação compacta: índices no pool de candidatos */
export type Combination = number[];

export interface EvaluationContext {
  candidates: CandidateListing[];
  targetSkin: SkinItem;
  evaluate: (combination: Combination) => {
    inputs: ContractInput[];
    outputs: ContractOutput[];
    totalCost: number;
    expectedFloat: number;
    score: number;
  };
  budget: number;
  mode: OptimizationMode;
}

export interface OptimizationResult {
  combination: Combination;
  /** Snapshot do pool usado na otimização — evita corrupção ao rematerializar entradas. */
  candidatePool: CandidateListing[];
  inputs: ContractInput[];
  outputs: ContractOutput[];
  totalCost: number;
  expectedFloat: number;
  score: number;
}
