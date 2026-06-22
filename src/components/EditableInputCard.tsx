'use client';

import type { WearTier } from '@ct/types';
import { SkinItemCard, WearFloatBar } from '@/components/SkinItemCard';

export interface EditableInputCardProps {
  name: string;
  imageUrl?: string;
  rarity?: string;
  price: number;
  float: number;
  wear: WearTier | string;
  minFloat: number;
  maxFloat: number;
  collectionId?: string;
  collectionName?: string;
  isTargetCollection?: boolean;
  purchaseUrl?: string;
  badge?: string;
  editable?: boolean;
  onFloatChange?: (value: number) => void;
  onPriceChange?: (value: number) => void;
}

export function EditableInputCard({
  editable,
  onFloatChange,
  onPriceChange,
  minFloat,
  maxFloat,
  ...cardProps
}: EditableInputCardProps) {
  if (!editable) {
    return <SkinItemCard {...cardProps} size="sm" />;
  }

  return (
    <div className="space-y-1.5">
      <SkinItemCard {...cardProps} size="sm" purchaseUrl={undefined} />
      <div className="rounded-lg border border-surface-border/60 bg-surface/40 p-2 space-y-2">
        <label className="block">
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Float</span>
          <input
            type="number"
            step="0.0001"
            min={minFloat}
            max={maxFloat}
            value={cardProps.float}
            onChange={(e) => onFloatChange?.(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-surface-border bg-[#0a0e14] px-2 py-1 text-xs tabular-nums text-sky-200 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Preço (R$)</span>
          <input
            type="number"
            step="0.01"
            min={0}
            value={cardProps.price}
            onChange={(e) => onPriceChange?.(Number(e.target.value))}
            className="mt-0.5 w-full rounded border border-surface-border bg-[#0a0e14] px-2 py-1 text-xs tabular-nums text-amber-200 focus:border-accent focus:outline-none"
          />
        </label>
        <WearFloatBar float={cardProps.float} />
      </div>
    </div>
  );
}
