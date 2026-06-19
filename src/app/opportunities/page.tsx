'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { OpportunityTable } from '@/components/OpportunityList';
import { ScanOpportunitiesButton } from '@/components/ScanOpportunitiesButton';
import type { OpportunityListItem } from '@/components/OpportunityList';

export default function OpportunitiesPage() {
  const [data, setData] = useState<{ items: OpportunityListItem[]; scannedAt?: string }>({
    items: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/opportunities?limit=100`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((json: { items: OpportunityListItem[]; scannedAt?: string }) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-slate-400">Carregando oportunidades…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">TOP 100 Oportunidades</h1>
          <p className="text-sm text-slate-400">
            Ranking heurístico · {data.items.length} itens
            {data.scannedAt && ` · ${new Date(data.scannedAt).toLocaleString('pt-BR')}`}
          </p>
        </div>
        <ScanOpportunitiesButton />
      </div>

      <OpportunityTable items={data.items} />
    </div>
  );
}
