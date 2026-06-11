import { useState } from 'react';
import type { Marketplace, OptimizationMode, TargetSearchParams, WearTier } from '../models/types';
import { Autocomplete } from './Autocomplete';
import { MarketFilter } from './MarketFilter';
import type { SkinItem } from '../models/types';

interface SearchFormProps {
  onSearch: (params: TargetSearchParams) => void;
  onFindBest: (params: TargetSearchParams) => void;
  onSearchSkins: (query: string, stattrak: boolean) => SkinItem[];
  loading: boolean;
}

const WEAR_OPTIONS: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

export function SearchForm({
  onSearch,
  onFindBest,
  onSearchSkins,
  loading,
}: SearchFormProps) {
  const [skinName, setSkinName] = useState('M4A1-S | Black Lotus');
  const [stattrak, setStattrak] = useState(true);
  const [wear, setWear] = useState<WearTier>('Factory New');
  const [maxFloat, setMaxFloat] = useState(0.07);
  const [budget, setBudget] = useState(100);
  const [marketplace, setMarketplace] = useState<Marketplace>('all');
  const [mode, setMode] = useState<OptimizationMode>('balanced');

  const buildParams = (): TargetSearchParams => ({
    skinName,
    stattrak,
    wear,
    maxFloat,
    budget,
    marketplace,
    mode,
  });

  const suggestions = onSearchSkins(skinName, stattrak);

  return (
    <form
      className="search-form card"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(buildParams());
      }}
    >
      <h2>Configurar Trade Up</h2>

      <div className="form-grid">
        <label>
          Skin alvo
          <Autocomplete
            value={skinName}
            onChange={setSkinName}
            onSelect={(skin) => setSkinName(skin.name)}
            suggestions={suggestions}
            placeholder="Ex: M4A1-S | Black Lotus"
          />
        </label>

        <label>
          Versão
          <select
            value={stattrak ? 'st' : 'normal'}
            onChange={(e) => setStattrak(e.target.value === 'st')}
          >
            <option value="st">StatTrak™</option>
            <option value="normal">Normal</option>
          </select>
        </label>

        <label>
          Wear desejado
          <select value={wear} onChange={(e) => setWear(e.target.value as WearTier)}>
            {WEAR_OPTIONS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>

        <label>
          Float máximo
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={maxFloat}
            onChange={(e) => setMaxFloat(parseFloat(e.target.value))}
          />
        </label>

        <label>
          Orçamento (R$)
          <input
            type="number"
            min="1"
            value={budget}
            onChange={(e) => setBudget(parseFloat(e.target.value))}
          />
        </label>

        <label>
          Modo
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as OptimizationMode)}
          >
            <option value="balanced">Equilibrado</option>
            <option value="low_cost">Menor custo</option>
            <option value="high_chance">Maior chance</option>
            <option value="min_loss">Menor perda possível</option>
          </select>
        </label>
      </div>

      <label className="market-label">Marketplace</label>
      <MarketFilter value={marketplace} onChange={setMarketplace} />

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Calculando...' : 'Calcular Contratos'}
        </button>
        <button
          type="button"
          className="btn accent"
          disabled={loading}
          onClick={() => onFindBest(buildParams())}
        >
          Encontrar Melhor Contrato
        </button>
      </div>
    </form>
  );
}
