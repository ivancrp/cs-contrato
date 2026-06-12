import { useState } from 'react';
import type { Marketplace, TargetSearchParams, WearTier, SkinItem } from '../models/types';
import { wearToMaxFloat } from '../math/wear';
import { SkinAutocomplete } from './SkinAutocomplete';
import { MarketFilter } from './MarketFilter';

interface SearchFormProps {
  onSearch: (params: TargetSearchParams) => void;
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
  loading,
}: SearchFormProps) {
  const [skinName, setSkinName] = useState('M4A1-S | Black Lotus');
  const [selectedSkin, setSelectedSkin] = useState<SkinItem | null>(null);
  const [stattrak, setStattrak] = useState(false);
  const [wear, setWear] = useState<WearTier>('Factory New');
  const [marketplace, setMarketplace] = useState<Marketplace>('all');

  const buildParams = (skin?: SkinItem | null): TargetSearchParams => ({
    skinName: skin?.name ?? skinName,
    targetSkinId: skin?.id ?? selectedSkin?.id,
    stattrak: skin?.stattrak ?? stattrak,
    wear,
    maxFloat: wearToMaxFloat(wear),
    marketplace,
  });

  const handleSkinSelect = (skin: SkinItem) => {
    setSelectedSkin(skin);
    setSkinName(skin.name);
    setStattrak(skin.stattrak);
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
        Pesquise a skin alvo. O sistema gera automaticamente vários contratos com custo e chance de lucro.
      </p>

      <div className="form-grid">
        <label className="form-field-skin-target">
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

        <div className="form-field-stattrak">
          <span className="field-label">Versão</span>
          <div className="stattrak-toggle">
            <span className={`stattrak-toggle-label${!stattrak ? ' active' : ''}`}>Normal</span>
            <button
              type="button"
              role="switch"
              aria-checked={stattrak}
              aria-label="Ativar StatTrak"
              className={`toggle-switch${stattrak ? ' is-on' : ''}`}
              onClick={() => {
                setStattrak((current) => !current);
                setSelectedSkin(null);
              }}
            >
              <span className="toggle-knob" />
            </button>
            <span className={`stattrak-toggle-label${stattrak ? ' active' : ''}`}>StatTrak™</span>
          </div>
        </div>

        <label>
          Desgate desejado
          <select value={wear} onChange={(event) => setWear(event.target.value as WearTier)}>
            {WEAR_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="market-label">Marketplace</label>
      <MarketFilter value={marketplace} onChange={setMarketplace} />

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Calculando contratos...' : 'Calcular Contratos'}
        </button>
      </div>
    </form>
  );
}
