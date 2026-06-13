import { useEffect, useState } from 'react';
import type { Marketplace } from '../models/types';
import { formatCurrency, formatFloat } from '../utils/format';
import {
  copyToClipboard,
  generateInspectLink,
  getCSFloatSearchUrlForSkin,
  getListingPurchaseUrl,
  getMarketplaceLabel,
  openInspectInGame,
  type InspectParams,
} from '../services/inspectService';
import { skinMetadataService } from '../services/skinMetadataService';

interface SkinListingLinksProps {
  params: InspectParams;
  marketplace: Marketplace;
  price?: number;
  purchaseUrl?: string;
  marketVerified?: boolean;
  compact?: boolean;
}

/** Inspeção in-game e link de compra CSFloat (def_index + paint_index + float). */
export function SkinListingLinks({
  params,
  marketplace,
  price,
  purchaseUrl,
  marketVerified = false,
  compact = false,
}: SkinListingLinksProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyUrl, setBuyUrl] = useState<string | null>(
    purchaseUrl ?? getListingPurchaseUrl(params, marketplace, purchaseUrl),
  );

  const marketLabel = getMarketplaceLabel(marketplace);

  useEffect(() => {
    if (purchaseUrl) {
      setBuyUrl(purchaseUrl);
      return;
    }

    const syncUrl = getCSFloatSearchUrlForSkin(params)
      ?? getListingPurchaseUrl(params, marketplace);
    if (syncUrl) {
      setBuyUrl(syncUrl);
      return;
    }

    let cancelled = false;
    skinMetadataService.resolve(params.skinName, params.stattrak ?? false).then(() => {
      if (cancelled) return;
      setBuyUrl(
        getCSFloatSearchUrlForSkin(params)
          ?? getListingPurchaseUrl(params, marketplace),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [purchaseUrl, marketplace, params.skinName, params.stattrak, params.float, params.wear]);

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

  const handleCopyBuyLink = async () => {
    if (!buyUrl) return;
    const ok = await copyToClipboard(buyUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`skin-listing-links${compact ? ' compact' : ''}`}>
      <span
        className={`market-verified-badge${marketVerified ? '' : ' estimated'}`}
        title={
          marketVerified
            ? `Listing real no ${marketLabel} — float ${formatFloat(params.float ?? 0)}`
            : `Preço estimado — confira disponibilidade no ${marketLabel}`
        }
      >
        {marketVerified ? '✓' : '~'}
        {' '}
        {marketLabel} · {formatFloat(params.float ?? 0)}
        {price !== undefined && ` · ${formatCurrency(price)}`}
      </span>
      {buyUrl && (
        <a
          href={buyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-inspect link buy"
          title={`Comprar no CSFloat — float ≤ ${formatFloat(params.float ?? 0)}`}
        >
          {compact ? 'Comprar' : 'Comprar no CSFloat'}
        </a>
      )}
      <button
        type="button"
        className="btn-inspect primary"
        title="Inspecionar no CS2"
        disabled={loading}
        onClick={handleInspect}
      >
        {loading ? '…' : compact ? 'Inspecionar' : 'Inspecionar no CS2'}
      </button>
      {buyUrl && (
        <button
          type="button"
          className="btn-inspect"
          title="Copiar link de compra"
          onClick={handleCopyBuyLink}
        >
          {copied ? 'Copiado!' : 'Copiar link'}
        </button>
      )}
      {error && <span className="inspect-error">{error}</span>}
    </div>
  );
}
