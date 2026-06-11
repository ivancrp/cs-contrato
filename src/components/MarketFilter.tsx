import type { Marketplace } from '../models/types';

interface MarketFilterProps {
  value: Marketplace;
  onChange: (market: Marketplace) => void;
}

const OPTIONS: { value: Marketplace; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'steam', label: 'Steam' },
  { value: 'csfloat', label: 'CSFloat' },
  { value: 'skinport', label: 'Skinport' },
  { value: 'buff', label: 'Buff' },
];

export function MarketFilter({ value, onChange }: MarketFilterProps) {
  return (
    <div className="market-filter">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`filter-btn ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
