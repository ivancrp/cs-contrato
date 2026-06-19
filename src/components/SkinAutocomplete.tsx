'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { SkinImage } from '@/components/SkinImage';
import type { Rarity } from '@ct/types';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 200;

export interface SkinHit {
  id: string;
  name: string;
  weapon: string;
  rarity: Rarity;
  imageUrl?: string;
  stattrak: boolean;
  collectionId: string;
  minFloat: number;
  maxFloat: number;
}

const RARITY_LABEL: Record<Rarity, string> = {
  consumer: 'Consumer',
  industrial: 'Industrial',
  'mil-spec': 'Mil-Spec',
  restricted: 'Restricted',
  classified: 'Classified',
  covert: 'Covert',
  extraordinary: 'Extraordinary',
};

export function SkinAutocomplete({
  value,
  onChange,
  onSelect,
  stattrak = false,
  selectedSkinId,
  selectedSkin,
  placeholder = 'Buscar skin alvo…',
}: {
  value: string;
  onChange: (query: string) => void;
  onSelect?: (skin: SkinHit) => void;
  stattrak?: boolean;
  selectedSkinId?: string;
  selectedSkin?: SkinHit | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SkinHit[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressSearchRef = useRef(false);
  const activeQueryRef = useRef('');

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    const trimmed = value.trim();
    activeQueryRef.current = trimmed;

    if (!open || trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setTotalResults(0);
      setLoading(false);
      return;
    }

    setResults([]);
    setTotalResults(0);
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const querySnapshot = trimmed;
      try {
        const params = new URLSearchParams({
          q: querySnapshot,
          limit: '100',
          stattrak: String(stattrak),
        });
        const res = await fetch(`${API_BASE}/search?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          if (activeQueryRef.current === querySnapshot) setResults([]);
          return;
        }

        const data = (await res.json()) as { results: SkinHit[]; total?: number };

        if (activeQueryRef.current !== querySnapshot) return;

        setResults(data.results);
        setTotalResults(data.total ?? data.results.length);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (activeQueryRef.current === querySnapshot) setResults([]);
      } finally {
        if (activeQueryRef.current === querySnapshot) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, stattrak, open]);

  function pickSkin(skin: SkinHit) {
    suppressSearchRef.current = true;
    activeQueryRef.current = skin.name;
    setOpen(false);
    setResults([]);
    setTotalResults(0);
    setLoading(false);
    onSelect?.(skin);
    onChange(skin.name);
    inputRef.current?.blur();
  }

  const showDropdown = open && value.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-3">
        {selectedSkin && selectedSkinId && (
          <SkinImage
            name={selectedSkin.name}
            imageUrl={selectedSkin.imageUrl}
            rarity={selectedSkin.rarity}
            size="sm"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
          }}
        />
      </div>

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-96 w-full overflow-auto rounded-lg border border-surface-border bg-surface-card shadow-xl"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-slate-500">Buscando…</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Nenhuma skin encontrada</li>
          )}
          {!loading &&
            results.map((skin) => (
              <li key={skin.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={skin.id === selectedSkinId}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-border/40 ${
                    skin.id === selectedSkinId ? 'border-l-2 border-accent bg-surface-border/20' : ''
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSkin(skin);
                  }}
                >
                  <SkinImage
                    name={skin.name}
                    imageUrl={skin.imageUrl}
                    rarity={skin.rarity}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">
                      {skin.stattrak && (
                        <span className="mr-1 rounded bg-orange-500/20 px-1 text-[10px] text-orange-300">
                          ST
                        </span>
                      )}
                      {skin.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {skin.weapon} · {RARITY_LABEL[skin.rarity] ?? skin.rarity}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          {!loading && totalResults > results.length && (
            <li className="border-t border-surface-border/60 px-3 py-2 text-xs text-slate-500">
              Mostrando {results.length} de {totalResults} skins — refine a busca para ver menos
            </li>
          )}
        </ul>
      )}

      {!showDropdown && value.trim().length > 0 && value.trim().length < MIN_QUERY_LENGTH && (
        <p className="mt-1 text-xs text-slate-500">
          Digite pelo menos {MIN_QUERY_LENGTH} caracteres para buscar
        </p>
      )}
    </div>
  );
}
