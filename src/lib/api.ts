export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '/api/backend';

export const API_HEALTH_PATH =
  process.env.NEXT_PUBLIC_API_HEALTH_URL?.replace(/\/$/, '') ?? '/api/health';

/** URL absoluta para fetch em Server Components (Vercel/SSR). */
export function resolveAppUrl(path: string): string {
  if (path.startsWith('http')) return path;
  if (typeof window !== 'undefined') return path;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface ApiHealth {
  status: string;
  version: string;
  catalogSource?: string;
  redis?: boolean;
  database?: boolean;
}

export async function fetchApiHealth(): Promise<ApiHealth | null> {
  try {
    const res = await fetch(resolveAppUrl(API_HEALTH_PATH), {
      next: { revalidate: 30 },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiHealth;
  } catch {
    return null;
  }
}

export async function fetchCatalogSummary() {
  const res = await fetch(resolveAppUrl(`${API_BASE}/catalog`), {
    next: { revalidate: 300 },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Falha ao carregar catálogo');
  return res.json() as Promise<{
    totalSkins: number;
    source: string;
    collections: unknown[];
  }>;
}

export interface OpportunitySummary {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
  referencePrice?: number;
  referenceWear?: string;
  referenceMarketHash?: string;
  wearPrices?: { FN?: number; MW?: number; FT?: number; WW?: number; BS?: number };
  estimatedCost?: number;
  costInputSkin?: string;
  costInputPrice?: number;
  expectedValue?: number;
  imageUrl?: string;
  rarity?: string;
  priceSource?: string;
  priceSourceUrl?: string;
  inspectLink?: string;
}

export async function fetchOpportunities(limit = 12): Promise<{
  items: OpportunitySummary[];
  scannedAt?: string;
  source?: string;
}> {
  try {
    const res = await fetch(resolveAppUrl(`${API_BASE}/opportunities?limit=${limit}`), {
      cache: 'no-store',
    });
    if (!res.ok) return { items: [] };
    return (await res.json()) as {
      items: OpportunitySummary[];
      scannedAt?: string;
      source?: string;
    };
  } catch {
    return { items: [] };
  }
}
