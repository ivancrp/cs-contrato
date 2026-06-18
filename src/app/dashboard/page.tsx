import { fetchApiHealth, fetchCatalogSummary, API_BASE } from '@/lib/api';
import { OpportunitiesChart } from '@/components/OpportunitiesChart';

export const dynamic = 'force-dynamic';

async function fetchTopOpportunities() {
  try {
    const res = await fetch(`${API_BASE}/opportunities?limit=12`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items: Array<{ targetSkinName: string; roi: number; expectedProfit: number }>;
    };
    return data.items;
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const [health, catalog, opportunities] = await Promise.all([
    fetchApiHealth(),
    fetchCatalogSummary().catch(() => null),
    fetchTopOpportunities(),
  ]);

  const online = health?.status === 'ok';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="API"
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'ok' : 'error'}
        />
        <StatCard
          label="Versão"
          value={health?.version ?? '—'}
        />
        <StatCard
          label="Catálogo"
          value={catalog ? String(catalog.totalSkins) : '—'}
          hint={catalog?.source}
        />
        <StatCard
          label="Fonte dados"
          value={health?.catalogSource ?? catalog?.source ?? '—'}
        />
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-6">
        <h2 className="font-semibold">TOP oportunidades (ROI)</h2>
        <div className="mt-4">
          <OpportunitiesChart
            items={opportunities.map((i) => ({
              name: i.targetSkinName,
              roi: i.roi,
              expectedProfit: i.expectedProfit,
            }))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-6">
        <h2 className="font-semibold">Infraestrutura</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>PostgreSQL: {health?.database ? '✓ configurado' : '○ não configurado'}</li>
          <li>Redis: {health?.redis ? '✓ configurado' : '○ in-memory'}</li>
          <li>Coleções: {catalog?.collections?.length ?? 0}</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'ok' | 'error';
}) {
  const valueClass =
    tone === 'ok' ? 'text-emerald-400' : tone === 'error' ? 'text-red-400' : 'text-white';

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
