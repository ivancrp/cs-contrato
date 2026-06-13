import { useState } from 'react';
import type { Marketplace } from '../models/types';
import { formatCurrency, formatFloat } from '../utils/format';
import {
  copyToClipboard,
  generateInspectLink,
  getMarketplaceLabel,
  openInspectInGame,
  type InspectParams,
} from '../services/inspectService';

interface SkinListingLinksProps {
  params: InspectParams;
  marketplace: Marketplace;
  price?: number;
  compact?: boolean;
}

/** Ações in-app: inspeção e confirmação de listing verificada no cálculo. */
export function SkinListingLinks({
  params,
  marketplace,
  price,
  compact = false,
}: SkinListingLinksProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCopyInspect = async () => {
    const url = await generateInspectLink(params);
    if (!url) {
      setError('Metadados não encontrados');
      return;
    }
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`skin-listing-links${compact ? ' compact' : ''}`}>
      <span
        className="market-verified-badge"
        title={`Listing verificada no ${marketLabel} durante o cálculo`}
      >
        ✓ {marketLabel} · {formatFloat(params.float ?? 0)}
        {price !== undefined && ` · ${formatCurrency(price)}`}
      </span>
      <button
        type="button"
        className="btn-inspect primary"
        title="Inspecionar no CS2 (sem sair do app)"
        disabled={loading}
        onClick={handleInspect}
      >
        {loading ? '…' : compact ? 'Inspecionar' : 'Inspecionar no CS2'}
      </button>
      <button
        type="button"
        className="btn-inspect"
        title="Copiar link de inspeção"
        onClick={handleCopyInspect}
      >
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
      {error && <span className="inspect-error">{error}</span>}
    </div>
  );
}
