'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import type { OpportunitySummary } from '@/lib/api';
import { OpportunityImageGrid } from '@/components/OpportunityList';

interface DashboardOpportunitiesProps {
  initialData?: {
    items: OpportunitySummary[];
    scannedAt?: string;
    source?: string;
  };
}

export function DashboardOpportunities({ initialData }: DashboardOpportunitiesProps) {
  const [items, setItems] = useState<OpportunitySummary[]>(initialData?.items ?? []);
  const [scannedAt, setScannedAt] = useState(initialData?.scannedAt);
  const [loading, setLoading] = useState(!initialData?.items?.length);

  useEffect(() => {
    if (initialData?.items?.length) return;

    fetch(`${API_BASE}/opportunities?limit=12`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: OpportunitySummary[]; scannedAt?: string }) => {
        setItems(data.items ?? []);
        setScannedAt(data.scannedAt);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [initialData?.items?.length]);

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-6 2xl:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">TOP oportunidades (ROI)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Clique em uma skin para abrir detalhes, preços CSFloat e gráfico individual
          </p>
          {scannedAt && (
            <p className="mt-1 text-xs text-slate-600">
              Atualizado em {new Date(scannedAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <Link
          href="/opportunities"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-300 hover:bg-surface-border/40"
        >
          Ver TOP 100 →
        </Link>
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="h-64 animate-pulse rounded-xl border border-surface-border bg-surface/60"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-surface-border bg-surface/40 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Nenhuma oportunidade calculada ainda.</p>
          <p className="mt-1 text-xs text-slate-500">
            O ranking é gerado na primeira consulta — aguarde ou acesse a página TOP 100.
          </p>
          <Link
            href="/opportunities"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            Abrir TOP 100
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <OpportunityImageGrid items={items} variant="dashboard" />
        </div>
      )}
    </section>
  );
}
