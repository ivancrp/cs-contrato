import { useEffect, useRef, useState } from 'react';
import type { SkinItem } from '../models/types';
import { SkinImage } from './SkinImage';

interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (skin: SkinItem) => void;
  suggestions: SkinItem[];
  placeholder?: string;
}

export function Autocomplete({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="autocomplete" ref={ref}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((skin) => (
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
                {skin.stattrak && <span className="st-badge">ST</span>}
                {skin.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
