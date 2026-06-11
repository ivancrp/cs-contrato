import {
  buildMinLossContract,
  buildThreeContracts,
  findBestContract,
  resolveTargetSkin,
} from '../contracts/contractBuilder';
import { refreshCatalog } from '../data/collections';
import { analyzeMinLossScenario } from '../math/ev';
import { db } from '../models/database';
import type {
  MinLossAnalysis,
  SimulationResult,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { simulateContracts } from '../simulations/monteCarlo';
import { generateAIRecommendation, type AIRecommendation } from './aiAdvisor';

export interface TradeUpSearchResult {
  targetSkin: ReturnType<typeof resolveTargetSkin>;
  collections: string[];
  contracts: TradeUpContract[];
  aiRecommendation: AIRecommendation;
  minLossContract?: TradeUpContract;
  minLossAnalysis?: MinLossAnalysis;
}

function contractSignature(contract: TradeUpContract): string {
  return contract.inputs
    .map((input) => `${input.item.id}:${input.listing.float.toFixed(4)}`)
    .sort()
    .join('|');
}

function mergeUniqueContracts(contracts: TradeUpContract[]): TradeUpContract[] {
  const seen = new Set<string>();
  const merged: TradeUpContract[] = [];

  for (const contract of contracts) {
    const signature = contractSignature(contract);
    if (seen.has(signature)) continue;
    seen.add(signature);
    merged.push(contract);
  }

  return merged;
}

/**
 * Serviço principal de Trade Up.
 * Orquestra busca, otimização e persistência.
 */
export class TradeUpService {
  /** Gera múltiplos contratos otimizados automaticamente */
  async search(params: TargetSearchParams): Promise<TradeUpSearchResult> {
    await refreshCatalog();
    const targetSkin = resolveTargetSkin(params);

    const tierContracts = await buildThreeContracts(params);

    let minLossContract: TradeUpContract | undefined;
    let minLossAnalysis: MinLossAnalysis | undefined;
    try {
      minLossContract = await buildMinLossContract(params);
      minLossAnalysis = analyzeMinLossScenario(
        minLossContract.outputs,
        minLossContract.evMetrics.totalCost,
        targetSkin.id,
      );
    } catch {
      minLossContract = undefined;
      minLossAnalysis = undefined;
    }

    const contracts = mergeUniqueContracts([
      ...tierContracts,
      ...(minLossContract ? [minLossContract] : []),
    ]);

    if (contracts.length === 0) {
      throw new Error('Não foi possível gerar contratos válidos para esta skin alvo');
    }

    db.saveContractHistory(params, contracts);

    const collections = [...new Set(
      contracts.flatMap((contract) => contract.collectionsUsed),
    )];

    const aiRecommendation = generateAIRecommendation(contracts);

    return {
      targetSkin,
      collections,
      contracts,
      aiRecommendation,
      minLossContract,
      minLossAnalysis,
    };
  }

  /** Mantido para compatibilidade com simulações pontuais */
  async findBest(params: TargetSearchParams): Promise<TradeUpContract> {
    await refreshCatalog();
    return findBestContract(params);
  }

  /** Simula 100.000 contratos */
  simulate(contract: TradeUpContract, iterations = 100_000): SimulationResult {
    const result = simulateContracts(contract, iterations);
    db.saveSimulation(contract.id, result);
    return result;
  }
}

export const tradeUpService = new TradeUpService();
