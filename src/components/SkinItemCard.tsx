'use client';

import { useEffect, useState } from 'react';
import type { Rarity, WearTier } from '@ct/types';

const RARITY_GRADIENT: Record<Rarity, string> = {
  consumer: 'from-slate-800/90 via-[#121820] to-[#0a0e14]',
  industrial: 'from-sky-950/90 via-[#101820] to-[#0a0e14]',
  'mil-spec': 'from-blue-950/90 via-indigo-950/80 to-[#0a0e14]',
  restricted: 'from-purple-950/90 via-violet-950/80 to-[#0a0e14]',
  classified: 'from-fuchsia-950/90 via-purple-950/80 to-[#0a0e14]',
  covert: 'from-red-950/90 via-rose-950/80 to-[#0a0e14]',
  extraordinary: 'from-amber-950/90 via-orange-950/80 to-[#0a0e14]',
};

const RARITY_ACCENT: Record<Rarity, string> = {
  consumer: 'bg-slate-400',
  industrial: 'bg-sky-400',
  'mil-spec': 'bg-blue-400',
  restricted: 'bg-violet-400',
  classified: 'bg-fuchsia-500',
  covert: 'bg-red-500',
  extraordinary: 'bg-amber-400',
};

const WEAR_SEGMENTS = [
  { key: 'FN', width: 7, color: 'bg-emerald-500' },
  { key: 'MW', width: 8, color: 'bg-lime-500' },
  { key: 'FT', width: 23, color: 'bg-amber-400' },
  { key: 'WW', width: 7, color: 'bg-orange-500' },
  { key: 'BS', width: 55, color: 'bg-red-600' },
] as const;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fallbackSvg(name: string): string {
  const label = escapeXml(name.length > 20 ? `${name.slice(0, 18)}…` : name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90" fill="#1a2332"/><text x="60" y="48" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function collectionLabel(collectionId: string): string {
  const known: Record<string, string> = {
    'collection-set-community-33': 'Kilowatt',
    'collection-set-community-32': 'Revolution',
    'collection-set-community-31': 'Recoil',
    'collection-set-community-21': 'Dreams & Nightmares',
    'collection-set-community-30': 'Snakebite',
    'collection-set-gamma-2': 'Gamma 2',
    'collection-set-gamma': 'Gamma',
    'collection-set-chroma-3': 'Chroma 3',
    'collection-set-bravo': 'Bravo',
    'collection-set-falchion': 'Falchion',
    'collection-set-huntsman': 'Huntsman',
    'collection-set-phoenix': 'Phoenix',
    'collection-set-vanguard': 'Vanguard',
    'collection-set-breakout': 'Breakout',
    'collection-set-shadow': 'Shadow',
    'collection-set-wildfire': 'Wildfire',
    'collection-set-chroma-2': 'Chroma 2',
    'collection-set-revolver': 'Revolver',
    'collection-set-horizon': 'Horizon',
    'collection-set-clutch': 'Clutch',
    'collection-set-prisma': 'Prisma',
    'collection-set-shattered-web': 'Shattered Web',
    'collection-set-fracture': 'Fracture',
    'collection-set-prisma-2': 'Prisma 2',
    'collection-set-fever': 'Fever',
  };
  if (known[collectionId]) return known[collectionId];
  return collectionId
    .replace(/^collection-set-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WearFloatBar({ float }: { float: number }) {
  const clamped = Math.min(Math.max(float, 0), 1);
  const markerLeft = `${clamped * 100}%`;

  return (
    <div className="relative px-0.5 pt-0.5">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-black/40">
        {WEAR_SEGMENTS.map((seg) => (
          <div key={seg.key} className={`${seg.color} shrink-0`} style={{ width: `${seg.width}%` }} />
        ))}
      </div>
      <div
        className="absolute top-0 h-3 w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
        style={{ left: markerLeft }}
        title={`Float ${clamped.toFixed(4)}`}
      />
      <div className="mt-1.5 flex justify-between text-[9px] font-medium text-slate-600">
        {WEAR_SEGMENTS.map((seg) => (
          <span key={seg.key}>{seg.key}</span>
        ))}
      </div>
    </div>
  );
}

export interface SkinItemCardProps {
  name: string;
  imageUrl?: string;
  rarity?: Rarity | string;
  price: number;
  float: number;
  wear: WearTier | string;
  collectionId?: string;
  collectionName?: string;
  count?: number;
  isTargetCollection?: boolean;
  purchaseUrl?: string;
  badge?: string;
  size?: 'sm' | 'md' | 'lg';
  showPrice?: boolean;
  showFloatBar?: boolean;
  className?: string;
}

export function SkinItemCard({
  name,
  imageUrl,
  rarity,
  price,
  float,
  wear,
  collectionId,
  collectionName,
  count = 1,
  isTargetCollection,
  purchaseUrl,
  badge,
  size = 'md',
  showPrice = true,
  showFloatBar = true,
  className = '',
}: SkinItemCardProps) {
  const [src, setSrc] = useState(imageUrl || fallbackSvg(name));
  const r = (rarity && rarity in RARITY_GRADIENT ? rarity : 'restricted') as Rarity;
  const gradient = RARITY_GRADIENT[r];
  const accent = RARITY_ACCENT[r];
  const imageHeight =
    size === 'lg' ? 'h-[15rem]' : size === 'sm' ? 'h-[11.5rem]' : 'h-[13rem]';
  const titleSize =
    size === 'lg' ? 'text-[15px]' : size === 'sm' ? 'text-[11px]' : 'text-[13px]';
  const wearSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const priceSize = size === 'sm' ? 'text-sm' : 'text-base';

  useEffect(() => {
    setSrc(imageUrl || fallbackSvg(name));
  }, [imageUrl, name]);

  const wearLabel =
    typeof wear === 'string' ? wear : String(wear);

  const collectionDisplay =
    collectionName ??
    (collectionId ? collectionLabel(collectionId) : undefined);

  const widthClass = 'w-full max-w-none';

  const card = (
    <article
      className={`group flex min-w-0 flex-col overflow-hidden rounded-xl border border-surface-border/80 bg-[#0c1018] shadow-lg shadow-black/25 transition hover:border-surface-border hover:shadow-black/40 ${widthClass} ${className}`}
    >
      <div
        className={`relative flex flex-col ${imageHeight} overflow-hidden bg-gradient-to-b ${gradient}`}
      >
        <div className="relative z-10 shrink-0 bg-gradient-to-b from-black/95 via-black/70 to-transparent px-2.5 pb-2 pt-2.5">
          <h3
            className={`line-clamp-3 font-bold leading-snug text-white ${titleSize}`}
            title={name}
          >
            {name}
          </h3>
          {showFloatBar && (
            <p className={`mt-1 text-slate-400 ${wearSize}`}>{wearLabel}</p>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 items-end justify-center px-1.5 pb-2.5 pt-1">
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="relative z-0 max-h-[92%] max-w-full object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
            onError={() => setSrc(fallbackSvg(name))}
          />

          {badge && (
            <span className="absolute right-1.5 top-1 z-20 rounded bg-accent/90 px-1.5 py-0.5 text-[10px] font-bold text-black shadow">
              {badge}
            </span>
          )}
          {count > 1 && (
            <span className="absolute right-1.5 top-8 z-20 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
              ×{count}
            </span>
          )}
          {isTargetCollection && (
            <span className="absolute bottom-1 left-1.5 z-20 rounded-md border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 backdrop-blur-sm">
              alvo
            </span>
          )}
        </div>
      </div>

      <div className={`h-0.5 ${accent} shadow-[0_0_12px_currentColor] opacity-80`} />

      <div className="space-y-1.5 px-2 py-2.5">
        {showPrice && (
          <p className={`text-center font-bold tabular-nums text-slate-100 ${priceSize}`}>
            {count > 1 ? (
              <>
                R$ {price.toFixed(2)}
                <span className="ml-1 text-xs font-normal text-slate-500">
                  · total R$ {(price * count).toFixed(2)}
                </span>
              </>
            ) : (
              `R$ ${price.toFixed(2)}`
            )}
          </p>
        )}

        {(collectionDisplay || showFloatBar) && (
          <div className="space-y-1 border-t border-surface-border/40 pt-1.5">
            {collectionDisplay && (
              <p
                className="line-clamp-2 text-center text-[10px] font-medium leading-snug text-slate-400"
                title={collectionDisplay}
              >
                {collectionDisplay}
                {count > 1 ? ` (${count})` : ''}
              </p>
            )}
            {showFloatBar && (
              <p className="text-center text-[10px] tabular-nums text-sky-300/90">
                Float {float.toFixed(4)}
              </p>
            )}
          </div>
        )}

        {showFloatBar && <WearFloatBar float={float} />}
      </div>
    </article>
  );

  if (purchaseUrl) {
    return (
      <a href={purchaseUrl} target="_blank" rel="noopener noreferrer" className="block">
        {card}
      </a>
    );
  }

  return card;
}
