'use client';

import { useEffect, useRef, useState } from 'react';
import type { WearTier } from '@ct/types';

interface WearSelectProps {
  id?: string;
  value: WearTier;
  options: WearTier[];
  labels: Record<WearTier, string>;
  onChange: (wear: WearTier) => void;
}

export function WearSelect({ id, value, options, labels, onChange }: WearSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-surface px-3 py-2 text-left text-sm text-slate-100 transition-colors hover:border-slate-500"
      >
        <span>{labels[value]}</span>
        <span className="text-slate-400 text-xs" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-surface-border bg-surface-card py-1 shadow-xl"
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'text-slate-200 hover:bg-surface-border/40'
                  }`}
                >
                  {labels[option]}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
