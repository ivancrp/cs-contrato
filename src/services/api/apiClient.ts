import { API_BASE_URL, API_ENABLED, API_HEALTH_URL } from '../../config/api';
import type { Collection, Marketplace, SimulationResult, SkinItem, TargetSearchParams, TradeUpContract } from '../../models/types';
import { fromApiContract, fromApiSearchCandidate, type ApiEnrichedContract, type ApiSearchCandidate } from './fromApiContract';
import { toApiContract } from './contractAdapter';

interface HealthResponse {
  status: string;
  version: string;
}

interface CatalogResponse {
  collections: Collection[];
  skins: unknown[];
  totalSkins?: number;
}

interface SearchResponse {
  query: string;
  results: Array<{ id: string; name: string; weapon: string }>;
}

let apiAvailable: boolean | null = null;
let healthCheckPromise: Promise<boolean> | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `API ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

/** Verifica se a API está online (cache 30s) */
export async function checkApiHealth(force = false): Promise<boolean> {
  if (!API_ENABLED) {
    apiAvailable = false;
    return false;
  }

  if (!force && apiAvailable !== null) return apiAvailable;
  if (!force && healthCheckPromise) return healthCheckPromise;

  healthCheckPromise = (async () => {
    try {
      const urls = [API_HEALTH_URL, `${API_BASE_URL}/health`];
      let ok = false;
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = (await res.json()) as HealthResponse;
          if (data.status === 'ok') {
            ok = true;
            break;
          }
        } catch {
          /* tenta próximo endpoint */
        }
      }
      apiAvailable = ok;
    } catch {
      apiAvailable = false;
    }
    setTimeout(() => {
      apiAvailable = null;
      healthCheckPromise = null;
    }, 30_000);
    return apiAvailable;
  })();

  return healthCheckPromise;
}

export async function fetchCatalogFromApi(): Promise<Collection[] | null> {
  if (!(await checkApiHealth())) return null;
  try {
    const data = await request<CatalogResponse>('/catalog');
    return data.collections?.length ? data.collections : null;
  } catch {
    return null;
  }
}

export async function searchSkinsFromApi(query: string, limit = 50) {
  if (!(await checkApiHealth()) || !query.trim()) return null;
  try {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const data = await request<SearchResponse>(`/search?${params}`);
    return data.results;
  } catch {
    return null;
  }
}

export async function simulateViaApi(
  contract: TradeUpContract,
  iterations: number,
  seed?: number,
): Promise<SimulationResult | null> {
  if (!(await checkApiHealth())) return null;

  try {
    const useAsync = iterations > 100_000;
    const payload = {
      contract: toApiContract(contract),
      iterations,
      seed,
      async: useAsync,
    };

    if (useAsync) {
      const queued = await request<{ jobId: string }>('/simulate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return pollSimulationJob(queued.jobId);
    }

    const result = await request<SimulationResult>('/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeSimulationResult(result);
  } catch {
    return null;
  }
}

async function pollSimulationJob(jobId: string): Promise<SimulationResult | null> {
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const job = await request<{
      status: string;
      result?: SimulationResult;
      error?: string;
    }>(`/simulate/jobs/${jobId}`);

    if (job.status === 'completed' && job.result) {
      return normalizeSimulationResult(job.result);
    }
    if (job.status === 'failed') {
      throw new Error(job.error ?? 'Simulação falhou');
    }
  }
  throw new Error('Timeout aguardando simulação');
}

/** Normaliza resposta da API para o formato legado */
function normalizeSimulationResult(result: SimulationResult): SimulationResult {
  return {
    iterations: result.iterations,
    targetObtained: result.targetObtained,
    outputCounts: result.outputCounts,
    averageProfit: result.averageProfit,
    averageLoss: result.averageLoss,
    observedEV: result.observedEV,
    breakEvenCount: result.breakEvenCount ??
      Math.round((result as SimulationResult & { breakEvenChance?: number }).breakEvenChance! * result.iterations),
    profitDistribution: result.profitDistribution,
    histogram: result.histogram.map((h) => ({
      range: h.range,
      count: h.count,
      percentage: h.percentage,
    })),
  };
}

export async function fetchPriceFromApi(name: string, wear?: string, float?: number) {
  if (!(await checkApiHealth())) return null;
  try {
    const params = new URLSearchParams({ name });
    if (wear) params.set('wear', wear);
    if (float !== undefined) params.set('float', String(float));
    return request<{ quote: { price: number; currency: string }; provider?: string }>(`/prices?${params}`);
  } catch {
    return null;
  }
}

interface TradeUpSearchApiResponse {
  targetSkin: SkinItem;
  collections: string[];
  contracts: ApiEnrichedContract[];
  candidates: ApiSearchCandidate[];
  marketAvailability: {
    marketplace: Marketplace;
    listingsFound: number;
    skinsWithListings: number;
    liveListings: number;
  };
}

export interface TradeUpSearchApiResult {
  targetSkin: SkinItem;
  collections: string[];
  contracts: TradeUpContract[];
  candidates: import('../../algorithms/types').CandidateListing[];
  marketAvailability: TradeUpSearchApiResponse['marketAvailability'];
  searchParams: TargetSearchParams;
}

/** Busca completa de contratos via API backend */
export async function searchTradeUpFromApi(
  params: TargetSearchParams,
): Promise<TradeUpSearchApiResult | null> {
  if (!(await checkApiHealth())) return null;

  try {
    const data = await request<TradeUpSearchApiResponse>('/trade-up/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (!data.contracts?.length) return null;

    const contracts = data.contracts.map(fromApiContract);
    const candidates = data.candidates.map(fromApiSearchCandidate);

    return {
      targetSkin: data.targetSkin,
      collections: data.collections,
      contracts,
      candidates,
      marketAvailability: data.marketAvailability,
      searchParams: params,
    };
  } catch {
    return null;
  }
}
