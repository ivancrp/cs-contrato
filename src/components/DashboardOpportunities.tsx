'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { OpportunitiesChart } from '@/components/OpportunitiesChart';
import { OpportunityImageGrid } from '@/components/OpportunityList';
import type { Rarity } from '@ct/types';

interface OpportunityItem {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
  referencePrice?: number;
  estimatedCost?: number;
  expectedValue?: number;
  imageUrl?: string;
  rarity?: Rarity;
}

export function DashboardOpportunities() {
  const [items, setItems] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    fetch(`${API_BASE}/opportunities?limit=12`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: OpportunityItem[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-6">
      <h2 className="font-semibold">TOP oportunidades (ROI)</h2>
      <p className="mt-1 text-xs text-slate-500">
        Referência = preço da skin alvo · Custo = 10 inputs mais baratos · Valor esp. = média dos outputs
      </p>
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando ranking…</p>
        ) : (
          <>
            <OpportunityImageGrid items={items} />
            <OpportunitiesChart
              items={items.map((i) => ({
                name: i.targetSkinName,
                roi: i.roi,
                expectedProfit: i.expectedProfit,
                referencePrice: i.referencePrice,
                estimatedCost: i.estimatedCost,
                expectedValue: i.expectedValue,
              }))}
            />
          </>
        )}
      </div>
    </div>
  );
}
