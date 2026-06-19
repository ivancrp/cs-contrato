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
  premium: number;
  premiumPercent: number;
  normalSource: string;
  stattrakSource: string;
}

const WEAR_OPTIONS = [
  { value: 'Field-Tested', label: 'Field-Tested (FT)' },
  { value: 'Minimal Wear', label: 'Minimal Wear (MW)' },
  { value: 'Factory New', label: 'Factory New (FN)' },
  { value: 'Well-Worn', label: 'Well-Worn (WW)' },
  { value: 'Battle-Scarred', label: 'Battle-Scarred (BS)' },
] as const;

export default function StatTrakPage() {
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [wear, setWear] = useState('Field-Tested');

  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ limit: '100', wear });
    fetch(`${API_BASE}/stattrak/compare?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar comparações');
        return res.json();
      })
      .then((data: { items: ComparisonRow[] }) => {
        setRows(data.items ?? []);
      })
      .catch((err: Error) => {
        setError(err.message);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [wear]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => !q || r.skinName.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">StatTrak vs Normal</h1>
        <p className="mt-1 text-sm text-slate-400">
          Comparação de preços CSFloat entre versão normal e StatTrak™
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          placeholder="Filtrar skin…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-200"
          value={wear}
          onChange={(e) => setWear(e.target.value)}
        >
          {WEAR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface/60" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-surface-border bg-surface/40 px-6 py-10 text-center">
          <p className="text-sm text-slate-400">Nenhuma comparação encontrada para este exterior.</p>
          <p className="mt-1 text-xs text-slate-500">
            Verifique se a API está online e se o CSFloat responde aos preços.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-card text-left text-slate-400">
              <tr>
                <th className="px-4 py-3">Skin</th>
                <th className="px-4 py-3">Normal</th>
                <th className="px-4 py-3">StatTrak™</th>
                <th className="px-4 py-3">Diferença</th>
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
                  <td className="px-4 py-2">
                    <span className="tabular-nums">R$ {row.normalPrice.toFixed(2)}</span>
                    <span className="ml-1 text-[10px] text-slate-600">{row.normalSource}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="tabular-nums">R$ {row.stattrakPrice.toFixed(2)}</span>
                    <span className="ml-1 text-[10px] text-slate-600">{row.stattrakSource}</span>
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums ${
                      row.premium >= 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {row.premium >= 0 ? '+' : ''}R$ {row.premium.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-2 tabular-nums ${
                      row.premiumPercent >= 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {row.premiumPercent >= 0 ? '+' : ''}
                    {row.premiumPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
