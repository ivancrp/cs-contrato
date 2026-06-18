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

function fallbackSvg(name: string): string {
  const label = encodeURIComponent(name.slice(0, 24));
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72" viewBox="0 0 96 72"><rect width="96" height="72" fill="#1a2332"/><text x="48" y="38" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`,
  )}`;
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
