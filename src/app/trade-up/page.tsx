'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '@/lib/api';
import {
  defaultWearForSkin,
  getWearTiersForSkin,
  isWearValidForSkin,
  WEAR_LABELS,
} from '@/lib/wear';
import { SkinAutocomplete, type SkinHit } from '@/components/SkinAutocomplete';
import { Toggle } from '@/components/Toggle';
import { WearSelect } from '@/components/WearSelect';
import { TradeUpResults, TargetSkinHero, type TradeUpSearchResult } from '@/components/TradeUpResults';
import type { WearTier } from '@ct/types';

export default function TradeUpPage() {
  const [skinName, setSkinName] = useState('');
  const [selectedSkinId, setSelectedSkinId] = useState<string | undefined>();
  const [selectedSkin, setSelectedSkin] = useState<SkinHit | null>(null);
  const [stattrak, setStattrak] = useState(false);
  const [wear, setWear] = useState<WearTier>('Factory New');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TradeUpSearchResult | null>(null);
  const [previewSkin, setPreviewSkin] = useState<SkinHit | null>(null);
  const [collectionLabels, setCollectionLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`${API_BASE}/catalog`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.collections) return;
        setCollectionLabels(
          Object.fromEntries(
            (data.collections as { id: string; name: string }[]).map((col) => [col.id, col.name]),
          ),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const trimmed = skinName.trim();
    if (trimmed.length < 2) {
      setPreviewSkin(null);
      return;
    }

    if (selectedSkin?.name.toLowerCase() === trimmed.toLowerCase()) {
      setPreviewSkin(selectedSkin);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: '8',
          stattrak: String(stattrak),
        });
        const res = await fetch(`${API_BASE}/search?${params}`, { signal: controller.signal });
        if (!res.ok) {
          setPreviewSkin(null);
          return;
        }

        const data = (await res.json()) as { results: SkinHit[] };
        const exact = data.results.find((skin) => skin.name.toLowerCase() === trimmed.toLowerCase());
        setPreviewSkin(exact ?? data.results[0] ?? null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setPreviewSkin(null);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [skinName, stattrak, selectedSkin]);

  const validWears = useMemo(() => {
    if (!selectedSkin) {
      return (Object.keys(WEAR_LABELS) as WearTier[]);
    }
    return getWearTiersForSkin(selectedSkin.minFloat, selectedSkin.maxFloat);
  }, [selectedSkin]);

  useEffect(() => {
    if (!selectedSkin) return;
    setWear((current) => {
      if (isWearValidForSkin(selectedSkin.minFloat, selectedSkin.maxFloat, current)) {
        return current;
      }
      return defaultWearForSkin(selectedSkin.minFloat, selectedSkin.maxFloat);
    });
  }, [selectedSkin]);

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
          wear,
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

  function handleClear() {
    setSkinName('');
    setSelectedSkinId(undefined);
    setSelectedSkin(null);
    setStattrak(false);
    setWear('Factory New');
    setPreviewSkin(null);
    setResult(null);
    setError(null);
  }

  const heroSkin = result?.targetSkin ?? previewSkin;
  const hasHeroSkin = Boolean(heroSkin);
  const heroCollectionName =
    result?.collectionLabels?.[heroSkin?.collectionId ?? ''] ??
    collectionLabels[heroSkin?.collectionId ?? ''];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Busca Trade Up</h1>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <form
          onSubmit={handleSearch}
          className="flex min-w-0 flex-1 flex-col rounded-xl border border-surface-border bg-surface-card p-6 space-y-4"
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
          <Toggle
            label="StatTrak"
            checked={stattrak}
            onChange={(checked) => {
              setStattrak(checked);
              setSelectedSkinId(undefined);
              setSelectedSkin(null);
            }}
          />
          <div>
            <label htmlFor="wear-alvo" className="mb-1 block text-sm text-slate-400">
              Wear alvo
            </label>
            <WearSelect
              id="wear-alvo"
              value={wear}
              options={validWears}
              labels={WEAR_LABELS}
              onChange={setWear}
            />
            {selectedSkin && validWears.length < 5 && (
              <p className="mt-1 text-xs text-amber-400/90">
                Esta skin só existe em {validWears.map((w) => WEAR_LABELS[w].split(' ')[0]).join(' ou ')}.
              </p>
            )}
          </div>
          <div className="mt-auto flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || skinName.trim().length < 2}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? 'Buscando…' : 'Buscar contratos'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-surface-border px-5 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:bg-surface/40"
            >
              Limpar
            </button>
          </div>
        </form>

        <div className="w-full shrink-0 lg:w-72 xl:w-80">
          <TargetSkinHero
            empty={!hasHeroSkin}
            targetSkin={heroSkin ?? undefined}
            marketAvailability={result?.marketAvailability}
            contractCount={result?.contracts.length}
            collectionName={heroCollectionName || undefined}
          />
        </div>
      </div>

      {result?.wearAutoAdjusted && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          Wear ajustado para <strong>{result.wear}</strong> — esta skin não existe no desgaste solicitado.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && <TradeUpResults result={result} />}
    </div>
  );
}
