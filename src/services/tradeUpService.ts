import {
  buildMinLossContract,
  buildThreeContracts,
  findBestContract,
  prepareContractSearch,
  resolveTargetSkin,
  summarizeMarketAvailability,
} from '../contracts/contractBuilder';
import { refreshCatalog } from '../data/collections';
import { analyzeMinLossScenario } from '../math/ev';
import { db } from '../models/database';
import type {
  ContractInput,
  MinLossAnalysis,
  SimulationResult,
  SkinItem,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { simulateContracts } from '../simulations/monteCarlo';
import { simulateViaApi } from './api/apiClient';
import { generateAIRecommendation, type AIRecommendation } from './aiAdvisor';
import type { CandidateListing } from '../algorithms/types';
import {
  enrichContractsWithMarketPrices,
  recalculateContractFromInputs,
} from './contractRecalcService';

export interface MarketAvailabilitySummary {
  marketplace: TargetSearchParams['marketplace'];
  listingsFound: number;
  skinsWithListings: number;
  liveListings: number;
}

export interface TradeUpSearchResult {
  targetSkin: ReturnType<typeof resolveTargetSkin>;
  collections: string[];
  contracts: TradeUpContract[];
  aiRecommendation: AIRecommendation;
  minLossContract?: TradeUpContract;
  minLossAnalysis?: MinLossAnalysis;
  marketAvailability: MarketAvailabilitySummary;
  candidates: CandidateListing[];
  searchParams: TargetSearchParams;
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
    const prepared = await prepareContractSearch(params);
    const targetSkin = prepared.targetSkin;

    const tierContracts = await buildThreeContracts(params, prepared);

    let minLossContract: TradeUpContract | undefined;
    try {
      minLossContract = await buildMinLossContract(params, prepared);
    } catch {
      minLossContract = undefined;
    }

    const contracts = mergeUniqueContracts([
      ...tierContracts,
      ...(minLossContract ? [minLossContract] : []),
    ]);

    if (contracts.length === 0) {
      throw new Error('Não foi possível gerar contratos válidos para esta skin alvo');
    }

    const realisticContracts = await enrichContractsWithMarketPrices(
      contracts,
      params.marketplace,
    );

    const enrichedMinLoss = realisticContracts.find((c) => c.tier === 'min_loss');
    const minLossAnalysis = enrichedMinLoss
      ? analyzeMinLossScenario(
          enrichedMinLoss.outputs,
          enrichedMinLoss.evMetrics.totalCost,
          targetSkin.id,
        )
      : undefined;

    db.saveContractHistory(params, realisticContracts);

    const collections = [...new Set(
      contracts.flatMap((contract) => contract.collectionsUsed),
    )];

    const aiRecommendation = generateAIRecommendation(realisticContracts);

    return {
      targetSkin,
      collections,
      contracts: realisticContracts,
      aiRecommendation,
      minLossContract: enrichedMinLoss,
      minLossAnalysis,
      marketAvailability: summarizeMarketAvailability(
        prepared.candidates,
        params.marketplace,
      ),
      candidates: prepared.candidates,
      searchParams: params,
    };
  }

  /** Mantido para compatibilidade com simulações pontuais */
  async findBest(params: TargetSearchParams): Promise<TradeUpContract> {
    await refreshCatalog();
    return findBestContract(params);
  }

  /** Simula N contratos — usa API quando disponível, senão local */
  async simulate(contract: TradeUpContract, iterations = 100_000): Promise<SimulationResult> {
    const fromApi = await simulateViaApi(contract, iterations);
    const result = fromApi ?? simulateContracts(contract, iterations);
    db.saveSimulation(contract.id, result);
    return result;
  }

  /** Recalcula contrato com entradas personalizadas e preços reais de mercado */
  async recalculateFromInputs(
    inputs: ContractInput[],
    targetSkin: SkinItem,
    params: TargetSearchParams,
    base?: Pick<TradeUpContract, 'tier' | 'tierLabel' | 'algorithmUsed' | 'aiScore'>,
  ): Promise<TradeUpContract> {
    await refreshCatalog();
    return recalculateContractFromInputs(inputs, targetSkin, params, base);
  }
}

export const tradeUpService = new TradeUpService();
