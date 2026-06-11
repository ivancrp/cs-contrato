import type { ContractInput, ContractOutput, OptimizationMode, Rarity } from '../models/types';

export interface CandidateListing {
  listingId: string;
  itemId: string;
  collectionId: string;
  rarity: Rarity;
  stattrak: boolean;
  price: number;
  float: number;
  isTargetCollection: boolean;
}

/** Representação compacta: índices no pool de candidatos */
export type Combination = number[];

export interface EvaluationContext {
  candidates: CandidateListing[];
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
  inputs: ContractInput[];
  outputs: ContractOutput[];
  totalCost: number;
  expectedFloat: number;
  score: number;
}
