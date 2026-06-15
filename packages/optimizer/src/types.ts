import type { ContractInput, ContractOutput } from '@ct/types';

/** Índices no pool de candidatos */
export type Combination = number[];

export interface OptimizerCandidate {
  listing: ContractInput['listing'];
  item: ContractInput['item'];
  price: number;
}

export interface InternalEvaluationContext {
  candidates: OptimizerCandidate[];
  inputCount: number;
  budget: number;
  evaluate: (combination: Combination) => {
    inputs: ContractInput[];
    outputs: ContractOutput[];
    totalCost: number;
    score: number;
  };
}

export interface InternalOptimizationResult {
  combination: Combination;
  inputs: ContractInput[];
  outputs: ContractOutput[];
  totalCost: number;
  score: number;
  algorithm: string;
}
