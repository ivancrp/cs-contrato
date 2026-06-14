import { useEffect, useRef, useState, useTransition } from 'react';
import type { SkinItem } from '../models/types';
import { skinSearchService, type SkinSearchResult } from '../services/skinSearchService';
import { SkinImage } from './SkinImage';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 120;

interface SkinAutocompleteProps {
  value: string;
  stattrak: boolean;
  selectedSkinId?: string;
  onChange: (value: string) => void;
  onSelect: (skin: SkinItem) => void;
  placeholder?: string;
}

export function SkinAutocomplete({
  value,
  stattrak,
  selectedSkinId,
  onChange,
  onSelect,
  placeholder,
}: SkinAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SkinSearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

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
    const trimmed = debouncedValue.trim();
    if (!open || trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;

    skinSearchService.warmIndexAsync().then(() => {
      if (cancelled) return;
      const results = skinSearchService.searchSync(trimmed, stattrak);
      startTransition(() => {
        setSuggestions(results);
        setActiveIndex(results.length > 0 ? 0 : -1);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue, stattrak, open]);

  const selectSkin = (skin: SkinSearchResult) => {
    onSelect(skin);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (value.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      selectSkin(suggestions[activeIndex]);
    }
  };

  const showDropdown = open && value.trim().length >= MIN_QUERY_LENGTH;
  const trimmedLength = value.trim().length;

  return (
    <div className="autocomplete" ref={ref}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls="skin-autocomplete-list"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (value.trim().length >= MIN_QUERY_LENGTH) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {showDropdown && (
        <ul className="autocomplete-list" id="skin-autocomplete-list" role="listbox">
          {suggestions.length === 0 && (
            <li className="autocomplete-status">Nenhuma skin encontrada no catálogo</li>
          )}
          {suggestions.map((skin, index) => (
            <li
              key={skin.id}
              role="option"
              aria-selected={index === activeIndex || skin.id === selectedSkinId}
              className={
                index === activeIndex
                  ? 'is-active'
                  : skin.id === selectedSkinId
                    ? 'is-selected'
                    : undefined
              }
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                selectSkin(skin);
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
      {!showDropdown && trimmedLength > 0 && trimmedLength < MIN_QUERY_LENGTH && (
        <p className="autocomplete-hint">Digite pelo menos {MIN_QUERY_LENGTH} caracteres para buscar</p>
      )}
    </div>
  );
}
