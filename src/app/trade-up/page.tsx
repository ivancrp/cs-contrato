'use client';

import { useState } from 'react';
import { API_BASE } from '@/lib/api';
import { SkinAutocomplete, type SkinHit } from '@/components/SkinAutocomplete';

export default function TradeUpPage() {
  const [skinName, setSkinName] = useState('');
  const [selectedSkinId, setSelectedSkinId] = useState<string | undefined>();
  const [selectedSkin, setSelectedSkin] = useState<SkinHit | null>(null);
  const [stattrak, setStattrak] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    contracts: Array<{ tier: string; tierLabel: string; evMetrics: { totalCost: number; expectedProfit: number; targetChance: number } }>;
    marketAvailability: { listingsFound: number };
  } | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/trade-up/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skinName,
          targetSkinId: selectedSkinId,
          stattrak,
          wear: 'Field-Tested',
          marketplace: 'csfloat',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro na busca');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Busca Trade Up</h1>

      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-surface-border bg-surface-card p-6 space-y-4"
      >
        <div>
          <label className="block text-sm text-slate-400 mb-1">Skin alvo</label>
          <SkinAutocomplete
            value={skinName}
            stattrak={stattrak}
            selectedSkinId={selectedSkinId}
            selectedSkin={selectedSkin}
            onChange={(query) => {
              setSkinName(query);
              setSelectedSkinId(undefined);
              setSelectedSkin(null);
            }}
            onSelect={(skin: SkinHit) => {
              setSkinName(skin.name);
              setSelectedSkinId(skin.id);
              setSelectedSkin(skin);
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={stattrak}
            onChange={(e) => {
              setStattrak(e.target.checked);
              setSelectedSkinId(undefined);
              setSelectedSkin(null);
            }}
          />
          StatTrak
        </label>
        <button
          type="submit"
          disabled={loading || skinName.trim().length < 2}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Buscando…' : 'Buscar contratos'}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            {result.marketAvailability.listingsFound} listings · {result.contracts.length} contratos
          </p>
          <div className="grid gap-3">
            {result.contracts.map((contract) => (
              <div
                key={contract.tier}
                className="rounded-xl border border-surface-border bg-surface-card p-4"
              >
                <h3 className="font-medium">{contract.tierLabel}</h3>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-slate-400">
                  <span>Custo: R$ {contract.evMetrics.totalCost.toFixed(2)}</span>
                  <span>Lucro esp.: R$ {contract.evMetrics.expectedProfit.toFixed(2)}</span>
                  <span>Chance alvo: {(contract.evMetrics.targetChance * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
