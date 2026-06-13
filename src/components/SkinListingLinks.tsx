import { useState } from 'react';
import type { Marketplace } from '../models/types';
import {
  generateInspectLink,
  getMarketplaceLabel,
  getMarketplaceSearchUrl,
  openInspectInGame,
  type InspectParams,
} from '../services/inspectService';

interface SkinListingLinksProps {
  params: InspectParams;
  marketplace: Marketplace;
  compact?: boolean;
}

/** Links de inspeção in-game e busca no marketplace da listing. */
export function SkinListingLinks({
  params,
  marketplace,
  compact = false,
}: SkinListingLinksProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketUrl = getMarketplaceSearchUrl(params, marketplace);
  const marketLabel = getMarketplaceLabel(marketplace);

  const handleInspect = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = await generateInspectLink(params);
      if (!url) {
        setError('Metadados da skin não encontrados');
        return;
      }
      openInspectInGame(url);
    } catch {
      setError('Erro ao gerar link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`skin-listing-links${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className="btn-inspect primary"
        title="Inspecionar no CS2"
        disabled={loading}
        onClick={handleInspect}
      >
        {loading ? '…' : compact ? 'Inspecionar' : 'Inspecionar no CS2'}
      </button>
      <a
        href={marketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-inspect link"
        title={`Buscar no ${marketLabel} (float ≤ ${params.float?.toFixed(4) ?? '—'})`}
      >
        {compact ? marketLabel : `Ver no ${marketLabel}`}
      </a>
      {error && <span className="inspect-error">{error}</span>}
    </div>
  );
}
