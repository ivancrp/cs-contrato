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

/**
 * Serviço principal de Trade Up.
 * Orquestra busca, otimização e persistência.
 */
export class TradeUpService {
  /** Gera os 3 contratos otimizados */
  async search(params: TargetSearchParams): Promise<TradeUpSearchResult> {
    await refreshCatalog();
    const targetSkin = resolveTargetSkin(params);

    const contracts = await buildThreeContracts(params);

    let minLossContract: TradeUpContract | undefined;
    let minLossAnalysis: MinLossAnalysis | undefined;

    if (params.mode === 'min_loss') {
      minLossContract = await buildMinLossContract(params);
      minLossAnalysis = analyzeMinLossScenario(
        minLossContract.outputs,
        minLossContract.evMetrics.totalCost,
        targetSkin.id,
      );
    }

    db.saveContractHistory(params, contracts);

    const collections = [...new Set(
      contracts.flatMap((contract) => contract.collectionsUsed),
    )];

    const aiRecommendation = generateAIRecommendation(contracts, params.budget, params.mode);

    return {
      targetSkin,
      collections,
      contracts,
      aiRecommendation,
      minLossContract,
      minLossAnalysis,
    };
  }

  /** Encontra melhor contrato via IA */
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
