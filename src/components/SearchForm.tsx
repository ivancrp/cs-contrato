import { useState } from 'react';
import type { Marketplace, TargetSearchParams, WearTier, SkinItem } from '../models/types';
import { getCollectionName } from '../data/collections';
import { wearToMaxFloat } from '../math/wear';
import { getRarityLabel } from '../utils/rarity';
import { SkinAutocomplete } from './SkinAutocomplete';
import { SkinImage } from './SkinImage';
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
  const [skinName, setSkinName] = useState('');
  const [selectedSkin, setSelectedSkin] = useState<SkinItem | null>(null);
  const [stattrak, setStattrak] = useState(false);
  const [wear, setWear] = useState<WearTier>('Factory New');
  const [marketplace, setMarketplace] = useState<Marketplace>('all');
  const [validationError, setValidationError] = useState<string | null>(null);

  const buildParams = (): TargetSearchParams => ({
    skinName: selectedSkin?.name ?? skinName,
    targetSkinId: selectedSkin?.id,
    stattrak: selectedSkin?.stattrak ?? stattrak,
    wear,
    maxFloat: wearToMaxFloat(wear),
    marketplace,
  });

  const handleSkinSelect = (skin: SkinItem) => {
    setSelectedSkin(skin);
    setSkinName(skin.name);
    setStattrak(skin.stattrak);
    setValidationError(null);
  };

  const handleClearSelection = () => {
    setSelectedSkin(null);
    setSkinName('');
    setValidationError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSkin) {
      setValidationError('Selecione uma skin da lista antes de calcular.');
      return;
    }
    if (selectedSkin.stattrak !== stattrak) {
      setValidationError(
        stattrak
          ? 'Esta skin não possui versão StatTrak.'
          : 'Ative StatTrak para esta skin alvo.',
      );
      return;
    }
    setValidationError(null);
    onSearch(buildParams());
  };

  return (
    <form className="search-form card" onSubmit={handleSubmit}>
      <h2>Configurar Trade Up</h2>
      <p className="search-form-hint">
        Pesquise e selecione a skin alvo. Os contratos só são calculados após clicar em
        {' '}
        <strong>Calcular Contratos</strong>
        , consultando disponibilidade e preços reais do mercado.
      </p>

      <div className="skin-target-section">
        <label className="form-field-skin-target">
          Skin alvo
          <SkinAutocomplete
            value={skinName}
            stattrak={stattrak}
            selectedSkinId={selectedSkin?.id}
            onChange={(value) => {
              setSkinName(value);
              if (selectedSkin && value !== selectedSkin.name) {
                setSelectedSkin(null);
              }
              setValidationError(null);
            }}
            onSelect={handleSkinSelect}
            placeholder="Ex.: AK-47 | Redline, M4A1-S | Black Lotus..."
          />
        </label>

        {selectedSkin ? (
          <div className="selected-skin-preview" aria-live="polite">
            <span className="selected-skin-label">Skin selecionada</span>
            <div className="selected-skin-card">
              <SkinImage name={selectedSkin.name} rarity={selectedSkin.rarity} size="md" />
              <div className="selected-skin-info">
                <span className="selected-skin-name">
                  {selectedSkin.stattrak && <span className="st-badge">ST</span>}
                  {selectedSkin.name}
                </span>
                <span className="selected-skin-meta">
                  {getCollectionName(selectedSkin.collectionId)} · {getRarityLabel(selectedSkin.rarity)}
                </span>
              </div>
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={handleClearSelection}
                aria-label="Trocar skin selecionada"
              >
                Trocar
              </button>
            </div>
          </div>
        ) : (
          <p className="selected-skin-empty">
            Clique em uma skin nos resultados da busca para selecioná-la.
          </p>
        )}
      </div>

      <div className="form-grid">
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
                setValidationError(null);
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

      {validationError && (
        <p className="form-validation-error" role="alert">{validationError}</p>
      )}

      <div className="form-actions">
        <button
          type="submit"
          className="btn primary"
          disabled={loading || !selectedSkin}
        >
          {loading ? 'Calculando...' : 'Calcular Contratos'}
        </button>
      </div>
    </form>
  );
}
