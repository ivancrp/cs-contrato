import { catalogStore } from '../data/catalogStore';
import { getAllSkins, getCollectionName } from '../data/collections';
import type { SkinItem } from '../models/types';
import { normalizeSkinName } from '../utils/format';
import { getRarityLabel } from '../utils/rarity';

const TARGET_RARITIES = new Set<SkinItem['rarity']>([
  'mil-spec',
  'restricted',
  'classified',
  'covert',
  'extraordinary',
]);

function scoreMatch(skin: SkinItem, normalized: string): number {
  const name = normalizeSkinName(skin.name);
  if (!normalized) return 0;
  if (name === normalized) return 0;
  if (name.endsWith(`| ${normalized}`)) return 1;
  if (name.includes(normalized)) return 2;
  return 99;
}

export interface SkinSearchResult extends SkinItem {
  collectionName: string;
  rarityLabel: string;
}

function enrichSkin(skin: SkinItem): SkinSearchResult {
  return {
    ...skin,
    collectionName: getCollectionName(skin.collectionId),
    rarityLabel: getRarityLabel(skin.rarity),
  };
}

/**
 * Busca skins alvo na API Steam (CSGO-API) com catálogo atualizado.
 */
export async function searchTargetSkins(
  query: string,
  stattrak?: boolean,
  limit = 15,
): Promise<SkinSearchResult[]> {
  await catalogStore.refresh();

  const normalized = normalizeSkinName(query);
  let pool = getAllSkins().filter(
    (skin) =>
      !skin.souvenir &&
      TARGET_RARITIES.has(skin.rarity) &&
      (stattrak === undefined || skin.stattrak === stattrak),
  );

  if (normalized) {
    pool = pool.filter((skin) => normalizeSkinName(skin.name).includes(normalized));
  }

  return pool
    .sort((a, b) => {
      const scoreDiff = scoreMatch(a, normalized) - scoreMatch(b, normalized);
      if (scoreDiff !== 0) return scoreDiff;

      const rarityOrder = ['extraordinary', 'covert', 'classified', 'restricted', 'mil-spec'];
      return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
    })
    .slice(0, limit)
    .map(enrichSkin);
}

export const skinSearchService = {
  search: searchTargetSkins,
};
