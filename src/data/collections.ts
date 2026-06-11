import type { Collection, SkinItem } from '../models/types';
import { catalogStore } from './catalogStore';

/** Coleções atuais (atualizadas via API Steam na inicialização). */
export function getCollections(): Collection[] {
  return catalogStore.getCollections();
}


/** Índice flat de todas as skins */
export function getAllSkins(): SkinItem[] {
  return getCollections().flatMap((collection) => collection.items);
}

function rankSkinMatch(skin: SkinItem, normalized: string): number {
  const name = skin.name.toLowerCase();
  if (name === normalized) return 0;
  if (name.endsWith(`| ${normalized}`) || name.endsWith(`|${normalized}`)) return 1;
  if (name.includes(normalized)) return 2;
  return 99;
}

/** Busca skin por nome (prioriza match exato e armas específicas). */
export function findSkinByName(name: string, stattrak: boolean): SkinItem | undefined {
  const normalized = name.toLowerCase().replace(/stattrak™?\s*/gi, '').trim();
  const pool = getAllSkins().filter((skin) => skin.stattrak === stattrak);

  const exact = pool.filter((skin) => skin.name.toLowerCase() === normalized);
  if (exact.length === 1) return exact[0];

  const candidates = exact.length > 0 ? exact : pool.filter((skin) => skin.name.toLowerCase().includes(normalized));
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((a, b) => {
    const rankDiff = rankSkinMatch(a, normalized) - rankSkinMatch(b, normalized);
    if (rankDiff !== 0) return rankDiff;

    const rarityOrder = ['covert', 'classified', 'restricted', 'mil-spec', 'industrial', 'consumer'];
    return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
  })[0];
}

export function findSkinsByName(name: string, stattrak: boolean): SkinItem[] {
  const normalized = name.toLowerCase().replace(/stattrak™?\s*/gi, '').trim();
  return getAllSkins().filter(
    (skin) => skin.stattrak === stattrak && skin.name.toLowerCase().includes(normalized),
  );
}

export function refreshCatalog(): Promise<void> {
  return catalogStore.refresh(true);
}
