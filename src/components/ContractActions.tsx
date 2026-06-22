'use client';

import { useState } from 'react';
import type { EnrichedTradeUpContract, TradeUpSearchResult } from '@/components/TradeUpResults';
import {
  addFavoriteContract,
  isContractFavorited,
  removeFavoriteByContractId,
} from '@/lib/favorite-contracts';
import { buildShareUrl, shareContract } from '@/lib/trade-up-api';

interface ContractActionsProps {
  contract: EnrichedTradeUpContract;
  targetSkin: TradeUpSearchResult['targetSkin'] & { stattrak?: boolean };
  wear?: string;
  collectionLabels?: Record<string, string>;
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  recalculating?: boolean;
}

export function ContractActions({
  contract,
  targetSkin,
  wear,
  collectionLabels,
  editMode,
  onEditModeChange,
  recalculating,
}: ContractActionsProps) {
  const [favorited, setFavorited] = useState(() => isContractFavorited(contract.id));
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleFavorite() {
    if (favorited) {
      removeFavoriteByContractId(contract.id);
      setFavorited(false);
      setShareStatus('Removido dos favoritos');
    } else {
      addFavoriteContract({
        targetSkin,
        wear,
        collectionLabels,
        contract,
      });
      setFavorited(true);
      setShareStatus('Salvo nos favoritos');
    }
    setTimeout(() => setShareStatus(null), 2500);
  }

  async function handleShare() {
    setBusy(true);
    setShareStatus(null);
    try {
      const id = await shareContract({
        targetSkin,
        wear,
        collectionLabels,
        contract,
      });
      const url = buildShareUrl(id);
      await navigator.clipboard.writeText(url);
      setShareStatus('Link copiado para a área de transferência');
    } catch (err) {
      setShareStatus(err instanceof Error ? err.message : 'Erro ao compartilhar');
    } finally {
      setBusy(false);
      setTimeout(() => setShareStatus(null), 3500);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleFavorite}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          favorited
            ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
            : 'border-surface-border text-slate-300 hover:border-slate-500 hover:bg-surface/50'
        }`}
      >
        {favorited ? '★ Favoritado' : '☆ Favoritar'}
      </button>
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={busy}
        className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-surface/50 disabled:opacity-50"
      >
        {busy ? 'Gerando…' : 'Compartilhar'}
      </button>
      <button
        type="button"
        onClick={() => onEditModeChange(!editMode)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
          editMode
            ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
            : 'border-surface-border text-slate-300 hover:border-slate-500 hover:bg-surface/50'
        }`}
      >
        {editMode ? 'Fechar edição' : 'Editar floats'}
      </button>
      {recalculating && (
        <span className="text-[10px] text-slate-500 animate-pulse">Atualizando saídas…</span>
      )}
      {shareStatus && (
        <span className="text-[10px] text-emerald-400">{shareStatus}</span>
      )}
    </div>
  );
}
