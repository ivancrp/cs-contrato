'use client';

import { useCallback, useEffect, useState } from 'react';
import { OpportunitiesChart } from '@/components/OpportunitiesChart';
import { SkinImage } from '@/components/OpportunityList';
import { API_BASE } from '@/lib/api';
import {
  csfloatSearchUrl,
  openInspectInGame,
  priceSourceLabel,
  priceSourceUrl,
  WEAR_ABBR,
} from '@/lib/market-links';
import type { OpportunityListItem, WearPriceMap } from '@/components/OpportunityList';

const WEAR_ORDER = ['FN', 'MW', 'FT', 'WW', 'BS'] as const;

function formatBrl(value: number, compact = false): string {
  if (compact && value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function refWearAbbr(referenceWear?: string): string {
  if (!referenceWear) return 'FT';
  if (referenceWear in WEAR_ABBR) return WEAR_ABBR[referenceWear as keyof typeof WEAR_ABBR];
  if (referenceWear.length === 2) return referenceWear;
  return 'FT';
}

function handleInspectClick(inspectLink: string) {
  const result = openInspectInGame(inspectLink);
  if (result === 'copied') {
    globalThis.alert(
      'Não foi possível abrir o Steam automaticamente. O comando foi copiado — abra o CS2, pressione ~ e cole no console.',
    );
  }
}

function WearPriceGrid({
  wearPrices,
  referenceWear,
  loading,
}: {
  wearPrices?: WearPriceMap;
  referenceWear?: string;
  loading?: boolean;
}) {
  const refAbbr = refWearAbbr(referenceWear);

  return (
    <div className="grid grid-cols-5 gap-1 rounded-lg border border-surface-border/60 bg-[#0b1018]/50 p-1">
      {WEAR_ORDER.map((abbr) => {
        const price = wearPrices?.[abbr];
        const active = abbr === refAbbr;
        return (
          <div
            key={abbr}
            className={`rounded px-0.5 py-0.5 text-center ${active ? 'bg-sky-500/15 ring-1 ring-sky-500/35' : ''}`}
          >
            <div className={`text-[9px] font-semibold uppercase ${active ? 'text-sky-400' : 'text-slate-500'}`}>
              {abbr}
            </div>
            <div
              className={`text-[10px] tabular-nums leading-tight ${
                loading ? 'animate-pulse text-slate-600' : price != null ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {loading ? '…' : price != null ? formatBrl(price, true) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface OpportunityDetailModalProps {
  item: OpportunityListItem | null;
  onClose: () => void;
}

export function OpportunityDetailModal({ item, onClose }: OpportunityDetailModalProps) {
  const [csfloatPrices, setCsfloatPrices] = useState<WearPriceMap | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!item) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [item, handleKeyDown]);

  useEffect(() => {
    if (!item?.targetSkinName) return;

    setCsfloatPrices(null);
    setPricesLoading(true);

    const params = new URLSearchParams({ name: item.targetSkinName, stattrak: 'false' });
    fetch(`${API_BASE}/prices/wear-grid?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { prices?: WearPriceMap } | null) => {
        if (data?.prices) setCsfloatPrices(data.prices);
      })
      .catch(() => {})
      .finally(() => setPricesLoading(false));
  }, [item?.targetSkinName]);

  if (!item) return null;

  const marketUrl =
    item.priceSourceUrl ??
    (item.referenceMarketHash ? priceSourceUrl(item.priceSource ?? 'steam_scm', item.referenceMarketHash) : null);
  const csfloatUrl = item.referenceMarketHash ? csfloatSearchUrl(item.referenceMarketHash) : null;
  const displayPrices = csfloatPrices ?? item.wearPrices;

  const chartItem = {
    name: item.targetSkinName,
    roi: item.roi,
    expectedProfit: item.expectedProfit,
    referencePrice: displayPrices?.[refWearAbbr(item.referenceWear) as keyof WearPriceMap] ?? item.referencePrice,
    estimatedCost: item.estimatedCost,
    expectedValue: item.expectedValue,
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opportunity-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fechar"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border/60 px-3 py-2">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-medium text-slate-500">#{item.rank} · Oportunidade</p>
            <h2 id="opportunity-modal-title" className="truncate text-sm font-bold text-white">
              {item.targetSkinName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-surface-border text-slate-400 hover:bg-surface hover:text-white"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-[7rem_1fr] gap-3 p-3 sm:grid-cols-[8.5rem_1fr] sm:gap-4 sm:p-4">
          <div className="flex flex-col items-center gap-1.5">
            <SkinImage name={item.targetSkinName} imageUrl={item.imageUrl} rarity={item.rarity} size="lg" />
            <p
              className={`text-center text-lg font-bold tabular-nums leading-none ${
                item.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {item.roi.toFixed(1)}%
            </p>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">ROI</p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="rounded-md bg-surface/60 px-1 py-1">
                <p className="text-slate-500">Ref. {refWearAbbr(item.referenceWear)}</p>
                <p className="font-semibold tabular-nums text-sky-300">
                  {item.referencePrice != null ? formatBrl(item.referencePrice) : '—'}
                </p>
              </div>
              <div className="rounded-md bg-surface/60 px-1 py-1">
                <p className="text-slate-500">Custo</p>
                <p className="font-semibold tabular-nums text-amber-300">
                  {item.estimatedCost != null ? formatBrl(item.estimatedCost) : '—'}
                </p>
              </div>
              <div className="rounded-md bg-surface/60 px-1 py-1">
                <p className="text-slate-500">Valor esp.</p>
                <p className="font-semibold tabular-nums text-emerald-300">
                  {item.expectedValue != null ? formatBrl(item.expectedValue) : '—'}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Exteriores</p>
                <span className="text-[9px] text-emerald-400">
                  {csfloatPrices ? 'CSFloat' : pricesLoading ? '…' : 'Steam'}
                </span>
              </div>
              <WearPriceGrid
                wearPrices={displayPrices}
                referenceWear={item.referenceWear}
                loading={pricesLoading && !csfloatPrices}
              />
            </div>

            {item.costInputSkin && item.costInputPrice != null && (
              <p className="text-[10px] leading-snug text-slate-500">
                Custo: 10× {item.costInputSkin} · {formatBrl(item.costInputPrice)}/un FT
              </p>
            )}

            <OpportunitiesChart items={[chartItem]} maxItems={1} className="h-28" />

            <div className="flex flex-wrap gap-1.5">
              {item.inspectLink ? (
                <button
                  type="button"
                  onClick={() => handleInspectClick(item.inspectLink!)}
                  className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  Inspecionar
                </button>
              ) : csfloatUrl ? (
                <a
                  href={csfloatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  Buscar inspect
                </a>
              ) : null}
              {csfloatUrl && (
                <a
                  href={csfloatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  CSFloat
                </a>
              )}
              {marketUrl && (
                <a
                  href={marketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-500/20"
                >
                  {priceSourceLabel(item.priceSource ?? 'steam_scm')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
