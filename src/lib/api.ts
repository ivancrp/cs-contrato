export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '/api/backend';

export interface ApiHealth {
  status: string;
  version: string;
  catalogSource?: string;
  redis?: boolean;
  database?: boolean;
}

export async function fetchApiHealth(): Promise<ApiHealth | null> {
  try {
    const healthUrl =
      process.env.NEXT_PUBLIC_API_HEALTH_URL?.replace(/\/$/, '') ?? '/api/health';
    const res = await fetch(healthUrl, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as ApiHealth;
  } catch {
    return null;
  }
}

export async function fetchCatalogSummary() {
  const res = await fetch(`${API_BASE}/catalog`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error('Falha ao carregar catálogo');
  return res.json() as Promise<{
    totalSkins: number;
    source: string;
    collections: unknown[];
  }>;
}
