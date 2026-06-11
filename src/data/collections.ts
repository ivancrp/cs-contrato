import catalog from './catalog.json';
import type { Collection, SkinItem } from '../models/types';

/**
 * Catálogo sincronizado via `npm run catalog:sync` (fonte: CSGO-API / Steam).
 */
export const COLLECTIONS: Collection[] = catalog as Collection[];

/** Índice flat de todas as skins */
export function getAllSkins(): SkinItem[] {
  return COLLECTIONS.flatMap((collection) => collection.items);
}

/** Busca skin por nome (prioriza match exato). */
export function findSkinByName(name: string, stattrak: boolean): SkinItem | undefined {
  const normalized = name.toLowerCase().replace(/stattrak™?\s*/gi, '').trim();
  const pool = getAllSkins().filter((skin) => skin.stattrak === stattrak);

  const exact = pool.filter((skin) => skin.name.toLowerCase() === normalized);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    return (
      exact.find((skin) => skin.rarity !== 'consumer' && skin.rarity !== 'industrial') ??
      exact[0]
    );
  }

  return pool.find((skin) => skin.name.toLowerCase().includes(normalized));
}

export function findSkinsByName(name: string, stattrak: boolean): SkinItem[] {
  const normalized = name.toLowerCase().replace(/stattrak™?\s*/gi, '').trim();
  return getAllSkins().filter(
    (skin) => skin.stattrak === stattrak && skin.name.toLowerCase() === normalized,
  );
}
