import { fetchApiHealth, fetchCatalogSummary } from '@/lib/api';
import { DashboardOpportunities } from '@/components/DashboardOpportunities';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [health, catalog] = await Promise.all([
    fetchApiHealth(),
    fetchCatalogSummary().catch(() => null),
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
        <StatCard label="Versão" value={health?.version ?? '—'} />
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

      <DashboardOpportunities />

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
