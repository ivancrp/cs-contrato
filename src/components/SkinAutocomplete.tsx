'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

export interface SkinHit {
  id: string;
  name: string;
  weapon: string;
}

export function SkinAutocomplete({
  value,
  onChange,
  stattrak = false,
  placeholder = 'Buscar skin alvo…',
}: {
  value: string;
  onChange: (skin: SkinHit | null, query: string) => void;
  stattrak?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SkinHit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: query, limit: '12' });
      const res = await fetch(`${API_BASE}/search?${params}`);
      if (!res.ok) return;
      const data = (await res.json()) as { results: SkinHit[] };
      setResults(
        data.results.filter((s) =>
          stattrak ? s.name.includes('StatTrak') : !s.name.includes('StatTrak'),
        ),
      );
      setOpen(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [query, stattrak]);

  return (
    <div className="relative">
      <input
        className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(null, e.target.value);
        }}
        onFocus={() => setOpen(results.length > 0)}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-surface-border bg-surface-card shadow-lg">
          {results.map((skin) => (
            <li key={skin.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-border/40"
                onClick={() => {
                  setQuery(skin.name);
                  onChange(skin, skin.name);
                  setOpen(false);
                }}
              >
                <span className="text-slate-300">{skin.weapon}</span> | {skin.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
