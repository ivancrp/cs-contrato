'use client';

import { useCallback, useEffect, useState } from 'react';
import { OpportunitiesChart } from '@/components/OpportunitiesChart';
import { SkinItemCard } from '@/components/SkinItemCard';
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

function resolveWearLabel(referenceWear?: string): string {
  if (!referenceWear) return 'Field-Tested';
  if (referenceWear in WEAR_ABBR) return referenceWear;
  const fromAbbr = Object.entries(WEAR_ABBR).find(([, abbr]) => abbr === referenceWear);
  return fromAbbr?.[0] ?? referenceWear;
}

function defaultFloatForWear(referenceWear?: string): number {
  const abbr = refWearAbbr(referenceWear);
  const floats: Record<string, number> = {
    FN: 0.035,
    MW: 0.11,
    FT: 0.25,
    WW: 0.42,
    BS: 0.75,
  };
  return floats[abbr] ?? 0.25;
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
    <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-surface-border/60 bg-[#0b1018]/50 p-2">
      {WEAR_ORDER.map((abbr) => {
        const price = wearPrices?.[abbr];
        const active = abbr === refAbbr;
        return (
          <div
            key={abbr}
            className={`rounded-md px-1 py-1.5 text-center transition-colors ${
              active ? 'bg-sky-500/15 ring-1 ring-sky-500/35' : ''
            }`}
          >
            <div className={`text-[10px] font-semibold uppercase ${active ? 'text-sky-400' : 'text-slate-500'}`}>
              {abbr}
            </div>
            <div
              className={`mt-0.5 text-xs tabular-nums ${
                loading
                  ? 'animate-pulse text-slate-600'
                  : price != null
                    ? active
                      ? 'text-slate-100'
                      : 'text-slate-400'
                    : 'text-slate-600'
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

  const wearLabel = resolveWearLabel(item.referenceWear);
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
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
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

      <div className="relative flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-surface-border bg-surface-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-surface-border/60 px-4 py-3">
          <div>
            <p className="text-xs font-medium text-slate-500">#{item.rank} · Oportunidade</p>
            <h2 id="opportunity-modal-title" className="text-base font-bold text-white">
              {item.targetSkinName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border text-slate-400 transition hover:bg-surface hover:text-white"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <SkinItemCard
              name={item.targetSkinName}
              imageUrl={item.imageUrl}
              rarity={item.rarity}
              price={item.referencePrice ?? 0}
              float={defaultFloatForWear(item.referenceWear)}
              wear={wearLabel}
              badge={`#${item.rank}`}
              size="sm"
              showPrice={item.referencePrice != null}
            />

            <div className="flex flex-col justify-center space-y-3">
              <p
                className={`text-center text-2xl font-bold tabular-nums ${
                  item.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {item.roi.toFixed(1)}% ROI
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-surface/60 px-2 py-2">
                  <p className="text-slate-500">Ref. {refWearAbbr(item.referenceWear)}</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-sky-300">
                    {item.referencePrice != null ? formatBrl(item.referencePrice) : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-surface/60 px-2 py-2">
                  <p className="text-slate-500">Custo</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-amber-300">
                    {item.estimatedCost != null ? formatBrl(item.estimatedCost) : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-surface/60 px-2 py-2">
                  <p className="text-slate-500">Valor esp.</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-emerald-300">
                    {item.expectedValue != null ? formatBrl(item.expectedValue) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Preços por exterior
              </p>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                {csfloatPrices ? 'CSFloat · BRL' : pricesLoading ? 'Carregando CSFloat…' : 'Catálogo Steam'}
              </span>
            </div>
            <WearPriceGrid
              wearPrices={displayPrices}
              referenceWear={item.referenceWear}
              loading={pricesLoading && !csfloatPrices}
            />
          </div>

          {item.costInputSkin && item.costInputPrice != null && (
            <div className="mt-4 rounded-lg border border-surface-border/60 bg-surface/40 px-3 py-2.5 text-xs text-slate-400">
              <p className="font-medium text-slate-300">Como o custo é calculado</p>
              <p className="mt-1 leading-relaxed">
                Um contrato CS2 exige <strong className="text-slate-200">10 skins de entrada</strong> da mesma
                raridade. O sistema usa a skin input mais barata da coleção —{' '}
                <span className="text-slate-200">{item.costInputSkin}</span> — a{' '}
                <span className="text-slate-200">{formatBrl(item.costInputPrice)}/un</span> em{' '}
                <span className="text-slate-200">Field-Tested</span>, totalizando{' '}
                <span className="text-amber-300">{formatBrl(item.estimatedCost ?? 0)}</span>.
              </p>
            </div>
          )}

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Comparativo de preços
            </p>
            <OpportunitiesChart items={[chartItem]} maxItems={1} className="h-56" />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {item.inspectLink ? (
              <button
                type="button"
                onClick={() => handleInspectClick(item.inspectLink!)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                Inspecionar
              </button>
            ) : csfloatUrl ? (
              <a
                href={csfloatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                Buscar inspect
              </a>
            ) : null}
            {csfloatUrl && (
              <a
                href={csfloatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                CSFloat
              </a>
            )}
            {marketUrl && (
              <a
                href={marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
              >
                {priceSourceLabel(item.priceSource ?? 'steam_scm')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}