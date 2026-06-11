import { useEffect, useRef, useState } from 'react';
import type { SkinItem } from '../models/types';
import { skinSearchService, type SkinSearchResult } from '../services/skinSearchService';
import { SkinImage } from './SkinImage';

interface SkinAutocompleteProps {
  value: string;
  stattrak: boolean;
  onChange: (value: string) => void;
  onSelect: (skin: SkinItem) => void;
  placeholder?: string;
}

export function SkinAutocomplete({
  value,
  stattrak,
  onChange,
  onSelect,
  placeholder,
}: SkinAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SkinSearchResult[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const results = await skinSearchService.search(value, stattrak);
        if (!cancelled) setSuggestions(results);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, stattrak, open]);

  return (
    <div className="autocomplete" ref={ref}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <ul className="autocomplete-list">
          {loading && (
            <li className="autocomplete-status">Buscando skins na API Steam...</li>
          )}
          {!loading && suggestions.length === 0 && (
            <li className="autocomplete-status">Nenhuma skin encontrada</li>
          )}
          {!loading &&
            suggestions.map((skin) => (
              <li
                key={skin.id}
                onClick={() => {
                  onSelect(skin);
                  onChange(skin.name);
                  setOpen(false);
                }}
              >
                <SkinImage name={skin.name} rarity={skin.rarity} size="sm" />
                <span className="autocomplete-text">
                  <span className="autocomplete-title">
                    {skin.stattrak && <span className="st-badge">ST</span>}
                    {skin.name}
                  </span>
                  <span className="autocomplete-meta">
                    {skin.collectionName} · {skin.rarityLabel}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
