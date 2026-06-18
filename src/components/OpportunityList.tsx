'use client';

import type { Rarity } from '@ct/types';
import { SkinImage } from '@/components/SkinImage';

export interface OpportunityListItem {
  rank: number;
  targetSkinName: string;
  weapon: string;
  roi: number;
  expectedProfit: number;
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
