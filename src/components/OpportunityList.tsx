'use client';

import { useEffect, useState } from 'react';
import type { Rarity, WearTier } from '@ct/types';
import { SkinItemCard } from '@/components/SkinItemCard';
import { OpportunityDetailModal } from '@/components/OpportunityDetailModal';
import {
  csfloatSearchUrl,
  openInspectInGame,
  priceSourceLabel,
  priceSourceUrl,
  WEAR_ABBR,
} from '@/lib/market-links';

const RARITY_BORDER: Record<Rarity, string> = {
  consumer: 'border-slate-500/40',
  industrial: 'border-sky-500/40',
  'mil-spec': 'border-blue-500/50',
  restricted: 'border-purple-500/50',
  classified: 'border-pink-500/50',
  covert: 'border-red-500/50',
  extraordinary: 'border-amber-400/50',
};

const SIZE_CLASS = {
  sm: 'h-10 w-[3.25rem]',
  md: 'h-[4.5rem] w-24',
  lg: 'h-28 w-[8.75rem]',
  xl: 'h-36 w-44',
};

const WEAR_ORDER = ['FN', 'MW', 'FT', 'WW', 'BS'] as const;

function handleInspectClick(inspectLink: string) {
  const result = openInspectInGame(inspectLink);
  if (result === 'copied') {
    globalThis.alert(
      'Não foi possível abrir o Steam automaticamente. O comando foi copiado — abra o CS2, pressione ~ e cole no console.',
    );
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fallbackSvg(name: string): string {
  const label = escapeXml(name.length > 24 ? `${name.slice(0, 22)}…` : name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72"><rect width="96" height="72" fill="#1a2332"/><text x="48" y="38" fill="#94a3b8" font-size="8" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function SkinImage({
  name,
  imageUrl,
  rarity,
  size = 'sm',
  className = '',
}: {
  name: string;
  imageUrl?: string;
  rarity?: Rarity | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [src, setSrc] = useState(imageUrl || fallbackSvg(name));
  const border =
    rarity && rarity in RARITY_BORDER
      ? RARITY_BORDER[rarity as Rarity]
      : 'border-surface-border';

  useEffect(() => {
    setSrc(imageUrl || fallbackSvg(name));
  }, [imageUrl, name]);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-[#0b1018] ${SIZE_CLASS[size]} ${border} ${className}`}
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-full w-full object-contain p-1"
        onError={() => setSrc(fallbackSvg(name))}
      />
    </div>
  );
}

function formatBrl(value: number, compact = false): string {
  if (compact && value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export interface WearPriceMap {
  FN?: number;
  MW?: number;
  FT?: number;
  WW?: number;
  BS?: number;
}

export interface OpportunityListItem {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
  referencePrice?: number;
  referenceWear?: WearTier | string;
  referenceMarketHash?: string;
  wearPrices?: WearPriceMap;
  estimatedCost?: number;
  costInputSkin?: string;
  costInputPrice?: number;
  expectedValue?: number;
  imageUrl?: string;
  rarity?: Rarity | string;
  priceSource?: string;
  priceSourceUrl?: string;
  inspectLink?: string;
}

function refWearAbbr(referenceWear?: string): string {
  if (!referenceWear) return 'FT';
  if (referenceWear in WEAR_ABBR) return WEAR_ABBR[referenceWear as WearTier];
  if (referenceWear.length === 2) return referenceWear;
  return 'FT';
}

function WearPriceGrid({
  wearPrices,
  referenceWear,
}: {
  wearPrices?: WearPriceMap;
  referenceWear?: string;
}) {
  const refAbbr = refWearAbbr(referenceWear);

  return (
    <div className="grid grid-cols-5 gap-1 rounded-lg border border-surface-border/60 bg-[#0b1018]/50 p-1.5">
      {WEAR_ORDER.map((abbr) => {
        const price = wearPrices?.[abbr];
        const active = abbr === refAbbr;
        return (
          <div
            key={abbr}
            title={price != null ? `${abbr}: R$ ${price.toFixed(0)}` : `${abbr}: sem preço`}
            className={`rounded-md px-0.5 py-1 text-center transition-colors ${
              active ? 'bg-sky-500/15 ring-1 ring-sky-500/35' : ''
            }`}
          >
            <div className={`text-[9px] font-semibold uppercase ${active ? 'text-sky-400' : 'text-slate-500'}`}>
              {abbr}
            </div>
            <div
              className={`mt-0.5 text-[10px] tabular-nums leading-tight ${
                price != null ? (active ? 'text-slate-100' : 'text-slate-400') : 'text-slate-600'
              }`}
            >
              {price != null ? formatBrl(price, true) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WearPriceRow({ wearPrices, referenceWear }: { wearPrices?: WearPriceMap; referenceWear?: string }) {
  if (!wearPrices || Object.keys(wearPrices).length === 0) return null;
  return (
    <div className="mt-2">
      <WearPriceGrid wearPrices={wearPrices} referenceWear={referenceWear} />
    </div>
  );
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

function resolveWearLabel(referenceWear?: string): WearTier | string {
  if (!referenceWear) return 'Field-Tested';
  if (referenceWear in WEAR_ABBR) return referenceWear as WearTier;
  const fromAbbr = Object.entries(WEAR_ABBR).find(([, abbr]) => abbr === referenceWear);
  return fromAbbr?.[0] ?? referenceWear;
}

function DashboardOpportunityCard({
  item,
  onSelect,
}: {
  item: OpportunityListItem;
  onSelect: (item: OpportunityListItem) => void;
}) {
  const wearLabel = resolveWearLabel(item.referenceWear);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex min-w-0 flex-col gap-2 text-left transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
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
        className="cursor-pointer"
      />
      <p
        className={`text-center text-xs font-bold tabular-nums ${
          item.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {item.roi.toFixed(1)}% ROI
      </p>
      <p className="text-center text-[10px] text-slate-500 opacity-0 transition group-hover:opacity-100">
        Clique para detalhes →
      </p>
    </button>
  );
}

function OpportunityActions({ item }: { item: OpportunityListItem }) {
  const marketUrl =
    item.priceSourceUrl ??
    (item.referenceMarketHash ? priceSourceUrl(item.priceSource ?? 'steam_scm', item.referenceMarketHash) : null);

  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
      {item.inspectLink && (
        <button
          type="button"
          onClick={() => handleInspectClick(item.inspectLink!)}
          className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20"
        >
          Inspecionar
        </button>
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
  );
}

export function OpportunityImageGrid({
  items,
  variant = 'default',
}: {
  items: OpportunityListItem[];
  variant?: 'default' | 'dashboard';
}) {
  const top = items.slice(0, variant === 'dashboard' ? 12 : 6);
  const [selected, setSelected] = useState<OpportunityListItem | null>(null);

  if (top.length === 0) return null;

  const isDashboard = variant === 'dashboard';

  if (isDashboard) {
    return (
      <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {top.map((item) => (
            <DashboardOpportunityCard key={item.rank} item={item} onSelect={setSelected} />
          ))}
        </div>
        <OpportunityDetailModal item={selected} onClose={() => setSelected(null)} />
      </>
    );
  }

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {top.map((item) => (
        <div key={item.rank} className="rounded-lg border border-surface-border bg-surface/60 p-2 text-center">
          <div className="mx-auto mb-2 flex justify-center">
            <SkinImage name={item.targetSkinName} imageUrl={item.imageUrl} rarity={item.rarity} size="md" />
          </div>
          <p className="line-clamp-2 text-[11px] font-medium leading-tight">{item.targetSkinName}</p>
          <WearPriceRow wearPrices={item.wearPrices} referenceWear={item.referenceWear} />
          <div className="mt-2 space-y-0.5 text-[10px] leading-tight text-slate-400">
            {item.referencePrice != null && (
              <p>
                Ref: <span className="text-sky-300">{formatBrl(item.referencePrice)}</span>
              </p>
            )}
            {item.estimatedCost != null && (
              <p>
                Custo: <span className="text-amber-300">{formatBrl(item.estimatedCost)}</span>
              </p>
            )}
          </div>
          <p className={`mt-1 text-xs font-semibold ${item.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {item.roi.toFixed(1)}% ROI
          </p>
          <OpportunityActions item={item} />
        </div>
      ))}
    </div>
  );
}

export function OpportunityTable({ items }: { items: OpportunityListItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma oportunidade no ranking.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-card text-left text-slate-400">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Skin</th>
            <th className="px-4 py-3">Exterior</th>
            <th className="px-4 py-3">Referência</th>
            <th className="px-4 py-3">Custo (10×)</th>
            <th className="px-4 py-3">Valor esp.</th>
            <th className="px-4 py-3">ROI</th>
            <th className="px-4 py-3">Lucro esp.</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const marketUrl =
              row.priceSourceUrl ??
              (row.referenceMarketHash
                ? priceSourceUrl(row.priceSource ?? 'steam_scm', row.referenceMarketHash)
                : null);
            const csfloatUrl = row.referenceMarketHash ? csfloatSearchUrl(row.referenceMarketHash) : null;

            return (
              <tr key={row.rank} className="border-t border-surface-border/60">
                <td className="px-4 py-2 text-slate-500">{row.rank}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    <SkinImage name={row.targetSkinName} imageUrl={row.imageUrl} rarity={row.rarity} size="sm" />
                    <div>
                      <div className="font-medium">{row.targetSkinName}</div>
                      <div className="text-xs text-slate-500">{row.weapon}</div>
                      {row.costInputSkin && (
                        <div className="text-[10px] text-slate-600">10× {row.costInputSkin}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <WearPriceGrid wearPrices={row.wearPrices} referenceWear={row.referenceWear} />
                </td>
                <td className="px-4 py-2 text-sky-300">
                  {row.referencePrice != null ? formatBrl(row.referencePrice) : '—'}
                </td>
                <td className="px-4 py-2 text-amber-300">
                  {row.estimatedCost != null ? formatBrl(row.estimatedCost) : '—'}
                </td>
                <td className="px-4 py-2">{row.expectedValue != null ? formatBrl(row.expectedValue) : '—'}</td>
                <td className={`px-4 py-2 ${row.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {row.roi.toFixed(1)}%
                </td>
                <td className="px-4 py-2">R$ {row.expectedProfit.toFixed(2)}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-1">
                    {row.inspectLink ? (
                      <button
                        type="button"
                        onClick={() => handleInspectClick(row.inspectLink!)}
                        className="text-left text-xs text-emerald-400 hover:underline"
                      >
                        Inspecionar
                      </button>
                    ) : csfloatUrl ? (
                      <a
                        href={csfloatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Buscar inspect
                      </a>
                    ) : null}
                    {marketUrl && (
                      <a
                        href={marketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-400 hover:underline"
                      >
                        {priceSourceLabel(row.priceSource ?? 'steam_scm')}
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
