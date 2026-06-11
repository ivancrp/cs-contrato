import { useState } from 'react';
import {
  copyToClipboard,
  generateInspectLink,
  getCSFloatSearchUrl,
  getSteamMarketUrl,
  openInspectInGame,
  type InspectParams,
} from '../services/inspectService';

interface InspectButtonProps {
  params: InspectParams;
  compact?: boolean;
}

/**
 * Botões para inspecionar skin no CS2, abrir Steam Market e CSFloat.
 */
export function InspectButton({ params, compact = false }: InspectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCopy = async () => {
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

  if (compact) {
    return (
      <div className="inspect-actions compact">
        <button
          type="button"
          className="btn-inspect primary"
          title="Inspecionar no CS2"
          disabled={loading}
          onClick={handleInspect}
        >
          {loading ? '…' : 'CS2'}
        </button>
      </div>
    );
  }

  return (
    <div className="inspect-actions">
      <button
        type="button"
        className="btn-inspect primary"
        disabled={loading}
        onClick={handleInspect}
      >
        {loading ? '...' : 'Inspecionar no CS2'}
      </button>
      <button type="button" className="btn-inspect" onClick={handleCopy}>
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
      <a
        href={getSteamMarketUrl(params)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-inspect link"
      >
        Steam Market
      </a>
      <a
        href={getCSFloatSearchUrl(params)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-inspect link"
      >
        CSFloat
      </a>
      {error && <span className="inspect-error">{error}</span>}
    </div>
  );
}
