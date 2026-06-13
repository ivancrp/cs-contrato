import { catalogStore } from '../data/catalogStore';
import { getAllSkins, getCollectionName } from '../data/collections';
import { canBeTradeUpTarget } from '../math/contractRules';
import type { SkinItem } from '../models/types';
import { normalizeSkinName } from '../utils/format';
import { getRarityLabel } from '../utils/rarity';

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
 * Busca skins alvo no catálogo local (sem rede).
 * Usado pelo autocomplete — não dispara cálculos nem refresh de API.
 */
export function searchTargetSkinsSync(
  query: string,
  stattrak?: boolean,
  limit = 20,
): SkinSearchResult[] {
  const normalized = normalizeSkinName(query);
  const catalog = getAllSkins();
  let pool = catalog.filter(
    (skin) =>
      (stattrak === undefined || skin.stattrak === stattrak) &&
      canBeTradeUpTarget(skin, catalog),
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

/**
 * Busca skins alvo com catálogo atualizado da API Steam (CSGO-API).
 */
export async function searchTargetSkins(
  query: string,
  stattrak?: boolean,
  limit = 20,
): Promise<SkinSearchResult[]> {
  await catalogStore.refresh();
  return searchTargetSkinsSync(query, stattrak, limit);
}

export const skinSearchService = {
  search: searchTargetSkins,
  searchSync: searchTargetSkinsSync,
};
