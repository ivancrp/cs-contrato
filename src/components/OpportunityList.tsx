'use client';

import { useEffect, useState } from 'react';
import type { Rarity } from '@ct/types';

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
};

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
  size?: 'sm' | 'md' | 'lg';
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
        className="h-full w-full object-contain p-0.5"
        onError={() => setSrc(fallbackSvg(name))}
      />
    </div>
  );
}

function formatBrl(value: number): string {
  return `R$ ${value.toFixed(0)}`;
}

export interface OpportunityListItem {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
  referencePrice?: number;
  estimatedCost?: number;
  expectedValue?: number;
  imageUrl?: string;
  rarity?: Rarity | string;
}

export function OpportunityImageGrid({ items }: { items: OpportunityListItem[] }) {
  const top = items.slice(0, 6);
  if (top.length === 0) return null;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {top.map((item) => (
        <div
          key={item.rank}
          className="rounded-lg border border-surface-border bg-surface/60 p-2 text-center"
        >
          <div className="mx-auto mb-2 flex justify-center">
            <SkinImage
              name={item.targetSkinName}
              imageUrl={item.imageUrl}
              rarity={item.rarity}
              size="md"
            />
          </div>
          <p className="line-clamp-2 text-[11px] font-medium leading-tight">{item.targetSkinName}</p>
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
            <th className="px-4 py-3">Referência</th>
            <th className="px-4 py-3">Custo atual</th>
            <th className="px-4 py-3">Valor esp.</th>
            <th className="px-4 py-3">ROI</th>
            <th className="px-4 py-3">Lucro esp.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.rank} className="border-t border-surface-border/60">
              <td className="px-4 py-2 text-slate-500">{row.rank}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-3">
                  <SkinImage
                    name={row.targetSkinName}
                    imageUrl={row.imageUrl}
                    rarity={row.rarity}
                    size="sm"
                  />
                  <div>
                    <div className="font-medium">{row.targetSkinName}</div>
                    <div className="text-xs text-slate-500">{row.weapon}</div>
                  </div>
                </div>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
