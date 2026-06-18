'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { OpportunitiesChart } from '@/components/OpportunitiesChart';
import { OpportunityImageGrid, OpportunityTable } from '@/components/OpportunityList';
import { ScanOpportunitiesButton } from '@/components/ScanOpportunitiesButton';
import type { Rarity } from '@ct/types';

interface Opportunity {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
  totalCost: number;
  targetChance: number;
  tier: string;
  imageUrl?: string;
  rarity?: Rarity;
}

export default function OpportunitiesPage() {
  const [data, setData] = useState<{ items: Opportunity[]; scannedAt?: string }>({
    items: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/opportunities?limit=100`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((json: { items: Opportunity[]; scannedAt?: string }) => setData(json))
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

      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-400">ROI por skin (top 12)</h2>
        <OpportunityImageGrid items={data.items} />
        <OpportunitiesChart
          items={data.items.map((i) => ({
            name: i.targetSkinName,
            roi: i.roi,
            expectedProfit: i.expectedProfit,
          }))}
        />
      </div>

      <OpportunityTable items={data.items} />
    </div>
  );
}
