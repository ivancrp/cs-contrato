import { useState } from 'react';
import type { Marketplace, OptimizationMode, TargetSearchParams, WearTier, SkinItem } from '../models/types';
import { SkinAutocomplete } from './SkinAutocomplete';
import { MarketFilter } from './MarketFilter';

interface SearchFormProps {
  onSearch: (params: TargetSearchParams) => void;
  onFindBest: (params: TargetSearchParams) => void;
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
  loading,
}: SearchFormProps) {
  const [skinName, setSkinName] = useState('M4A1-S | Black Lotus');
  const [selectedSkin, setSelectedSkin] = useState<SkinItem | null>(null);
  const [stattrak, setStattrak] = useState(true);
  const [wear, setWear] = useState<WearTier>('Factory New');
  const [maxFloat, setMaxFloat] = useState(0.07);
  const [budget, setBudget] = useState(100);
  const [marketplace, setMarketplace] = useState<Marketplace>('all');
  const [mode, setMode] = useState<OptimizationMode>('balanced');

  const buildParams = (skin?: SkinItem | null): TargetSearchParams => ({
    skinName: skin?.name ?? skinName,
    targetSkinId: skin?.id ?? selectedSkin?.id,
    stattrak: skin?.stattrak ?? stattrak,
    wear,
    maxFloat,
    budget,
    marketplace,
    mode,
  });

  const handleSkinSelect = (skin: SkinItem) => {
    setSelectedSkin(skin);
    setSkinName(skin.name);
    setStattrak(skin.stattrak);
    onSearch(buildParams(skin));
  };

  return (
    <form
      className="search-form card"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(buildParams());
      }}
    >
      <h2>Configurar Trade Up</h2>
      <p className="search-form-hint">
        Pesquise a skin alvo na API Steam, selecione na lista e veja os melhores contratos.
      </p>

      <div className="form-grid">
        <label>
          Skin alvo
          <SkinAutocomplete
            value={skinName}
            stattrak={stattrak}
            onChange={(value) => {
              setSkinName(value);
              setSelectedSkin(null);
            }}
            onSelect={handleSkinSelect}
            placeholder="Digite para buscar na API Steam..."
          />
        </label>

        <label>
          Versão
          <select
            value={stattrak ? 'st' : 'normal'}
            onChange={(event) => {
              setStattrak(event.target.value === 'st');
              setSelectedSkin(null);
            }}
          >
            <option value="st">StatTrak™</option>
            <option value="normal">Normal</option>
          </select>
        </label>

        <label>
          Wear desejado
          <select value={wear} onChange={(event) => setWear(event.target.value as WearTier)}>
            {WEAR_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
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
            onChange={(event) => setMaxFloat(parseFloat(event.target.value))}
          />
        </label>

        <label>
          Orçamento (R$)
          <input
            type="number"
            min="1"
            value={budget}
            onChange={(event) => setBudget(parseFloat(event.target.value))}
          />
        </label>

        <label>
          Modo
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as OptimizationMode)}
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
