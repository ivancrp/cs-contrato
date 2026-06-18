'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import type { ApiHealth } from '@/lib/api';

export function DashboardStatus() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [catalog, setCatalog] = useState<{
    totalSkins: number;
    source: string;
    collections: unknown[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(`${API_BASE}/health`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<ApiHealth>) : null))
        .catch(() => null),
      fetch(`${API_BASE}/catalog`, { signal: controller.signal })
        .then((res) =>
          res.ok
            ? (res.json() as Promise<{
                totalSkins: number;
                source: string;
                collections: unknown[];
              }>)
            : null,
        )
        .catch(() => null),
    ])
      .then(([healthData, catalogData]) => {
        setHealth(healthData);
        setCatalog(catalogData);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const online = health?.status === 'ok';

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-surface-border bg-surface-card"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="API"
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'ok' : 'error'}
          hint={online ? 'Backend Fastify ativo' : 'Verifique /api/backend/health'}
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

      <div className="rounded-xl border border-surface-border bg-surface-card p-6">
        <h2 className="font-semibold">Infraestrutura</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          <li>PostgreSQL: {health?.database ? '✓ configurado' : '○ não configurado'}</li>
          <li>Redis: {health?.redis ? '✓ configurado' : '○ in-memory'}</li>
          <li>Coleções: {catalog?.collections?.length ?? 0}</li>
        </ul>
      </div>
    </>
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
