'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api';

interface ComparisonRow {
  skinName: string;
  weapon: string;
  wear: string;
  rarity: string;
  normalPrice: number;
  stattrakPrice: number;
  savings: number;
  savingsPercent: number;
}

export default function StatTrakPage() {
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/catalog`);
        const catalog = (await res.json()) as {
          collections: Array<{
            items: Array<{ id: string; name: string; weapon: string; rarity: string; stattrak: boolean }>;
          }>;
        };

        const skins = catalog.collections.flatMap((c) => c.items);
        const byName = new Map<string, typeof skins>();
        for (const skin of skins) {
          if (!byName.has(skin.name)) byName.set(skin.name, []);
          byName.get(skin.name)!.push(skin);
        }

        const pairs: Array<{ normal: (typeof skins)[0]; st: (typeof skins)[0] }> = [];
        for (const [, variants] of byName) {
          const normal = variants.find((s) => !s.stattrak);
          const st = variants.find((s) => s.stattrak);
          if (normal && st) pairs.push({ normal, st });
        }

        const comparisons: ComparisonRow[] = [];
        for (const { normal, st } of pairs.slice(0, 40)) {

          const [nPrice, sPrice] = await Promise.all([
            fetchPrice(normal.name, false),
            fetchPrice(st.name, true),
          ]);
          if (nPrice <= 0 || sPrice <= 0) continue;

          const savings = sPrice - nPrice;
          const savingsPercent = nPrice > 0 ? (savings / nPrice) * 100 : 0;
          if (savingsPercent <= 0) continue;

          comparisons.push({
            skinName: normal.name,
            weapon: normal.weapon,
            wear: 'Field-Tested',
            rarity: normal.rarity,
            normalPrice: nPrice,
            stattrakPrice: sPrice,
            savings,
            savingsPercent,
          });
        }

        comparisons.sort((a, b) => b.savingsPercent - a.savingsPercent);
        setRows(comparisons.slice(0, 80));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => !q || r.skinName.toLowerCase().includes(q));
  }, [rows, search]);

  if (loading) return <p className="text-slate-400">Carregando comparações…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">StatTrak vs Normal</h1>
      <input
        className="w-full max-w-md rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
        placeholder="Filtrar skin…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-card text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Skin</th>
              <th className="px-4 py-3">Normal</th>
              <th className="px-4 py-3">StatTrak</th>
              <th className="px-4 py-3">Prêmio ST</th>
              <th className="px-4 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.skinName} className="border-t border-surface-border/60">
                <td className="px-4 py-2">
                  <div className="font-medium">{row.skinName}</div>
                  <div className="text-xs text-slate-500">{row.weapon}</div>
                </td>
                <td className="px-4 py-2">R$ {row.normalPrice.toFixed(2)}</td>
                <td className="px-4 py-2">R$ {row.stattrakPrice.toFixed(2)}</td>
                <td className="px-4 py-2 text-amber-400">R$ {row.savings.toFixed(2)}</td>
                <td className="px-4 py-2 text-amber-400">{row.savingsPercent.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function fetchPrice(name: string, stattrak: boolean): Promise<number> {
  const hash = stattrak ? `StatTrak™ ${name} (Field-Tested)` : `${name} (Field-Tested)`;
  const params = new URLSearchParams({ name: hash });
  const res = await fetch(`${API_BASE}/prices?${params}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as { quote: { price: number } };
  return data.quote?.price ?? 0;
}
