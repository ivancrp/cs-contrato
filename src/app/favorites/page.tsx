'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  listFavoriteContracts,
  removeFavoriteContract,
  type FavoriteContract,
} from '@/lib/favorite-contracts';

function formatBrl(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function FavoriteRow({
  item,
  onOpen,
  onRemove,
}: {
  item: FavoriteContract;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-slate-100">{item.targetSkinName}</h2>
        <p className="mt-0.5 text-sm text-slate-400">{item.tierLabel}</p>
        <p className="mt-2 text-xs text-slate-500">
          Custo {formatBrl(item.totalCost)} · ROI {item.roi.toFixed(1)}% ·{' '}
          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black"
        >
          Abrir
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-400 hover:text-red-300"
        >
          Remover
        </button>
      </div>
    </article>
  );
}

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteContract[]>(() => listFavoriteContracts());

  const refresh = useCallback(() => {
    setFavorites(listFavoriteContracts());
  }, []);

  function openFavorite(item: FavoriteContract) {
    sessionStorage.setItem('ct-load-favorite', JSON.stringify(item.payload));
    router.push('/trade-up?favorite=1');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contratos favoritos</h1>
          <p className="mt-1 text-sm text-slate-400">
            Salvos neste navegador — use compartilhar para enviar a outras pessoas.
          </p>
        </div>
        <Link
          href="/trade-up"
          className="rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-300 hover:bg-surface/50"
        >
          Nova busca
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-surface-card/50 px-6 py-12 text-center">
          <p className="text-slate-400">Nenhum contrato favoritado ainda.</p>
          <p className="mt-2 text-sm text-slate-500">
            Na página Trade Up, use <strong className="text-slate-300">☆ Favoritar</strong> em um contrato.
          </p>
          <Link
            href="/trade-up"
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2 text-sm font-medium text-black"
          >
            Buscar contratos
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((item) => (
            <FavoriteRow
              key={item.id}
              item={item}
              onOpen={() => openFavorite(item)}
              onRemove={() => {
                removeFavoriteContract(item.id);
                refresh();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
