import { catalogStore } from '../data/catalogStore';
import { getCollectionName } from '../data/collections';
import { canBeTradeUpTarget } from '../math/contractRules';
import type { Collection, SkinItem } from '../models/types';
import { normalizeSkinName } from '../utils/format';
import { getRarityLabel } from '../utils/rarity';
import { yieldToMain } from '../utils/yieldToMain';

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

type TargetIndex = {
  collections: Collection[];
  catalog: SkinItem[];
  byStatTrak: Map<boolean, Set<string>>;
};

let targetIndex: TargetIndex | null = null;
let buildGeneration = 0;

function uniqueCatalogSkins(collections: Collection[]): SkinItem[] {
  const byId = new Map<string, SkinItem>();
  for (const collection of collections) {
    for (const item of collection.items) {
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
  }
  return [...byId.values()];
}

async function buildTargetIndexAsync(collections: Collection[]): Promise<TargetIndex> {
  const catalog = uniqueCatalogSkins(collections);
  const byStatTrak = new Map<boolean, Set<string>>([
    [false, new Set<string>()],
    [true, new Set<string>()],
  ]);

  for (let i = 0; i < catalog.length; i++) {
    const skin = catalog[i];
    if (canBeTradeUpTarget(skin, catalog)) {
      byStatTrak.get(skin.stattrak)!.add(skin.id);
    }
    if (i > 0 && i % 40 === 0) {
      await yieldToMain();
    }
  }

  return { collections, catalog, byStatTrak };
}

function buildTargetIdsByStatTrak(catalog: SkinItem[]): Map<boolean, Set<string>> {
  const byStatTrak = new Map<boolean, Set<string>>([
    [false, new Set<string>()],
    [true, new Set<string>()],
  ]);

  for (const skin of catalog) {
    if (canBeTradeUpTarget(skin, catalog)) {
      byStatTrak.get(skin.stattrak)!.add(skin.id);
    }
  }

  return byStatTrak;
}

function ensureTargetIndex(): TargetIndex {
  const collections = catalogStore.getCollections();
  if (targetIndex?.collections === collections) {
    return targetIndex;
  }

  const catalog = uniqueCatalogSkins(collections);
  targetIndex = {
    collections,
    catalog,
    byStatTrak: buildTargetIdsByStatTrak(catalog),
  };
  return targetIndex;
}

/** Pré-calcula índice em background sem bloquear a UI. */
export function warmSkinSearchIndexAsync(): Promise<void> {
  const collections = catalogStore.getCollections();
  if (targetIndex?.collections === collections) {
    return Promise.resolve();
  }

  const generation = buildGeneration;
  return buildTargetIndexAsync(collections).then((index) => {
    if (generation === buildGeneration) {
      targetIndex = index;
    }
  });
}

/** Pré-calcula índice de skins alvo válidas (chamar após carregar catálogo). */
export function warmSkinSearchIndex(): void {
  ensureTargetIndex();
}

/** Invalida cache quando o catálogo for atualizado. */
export function invalidateSkinSearchIndex(): void {
  targetIndex = null;
  buildGeneration++;
}

function getValidTargetIds(stattrak?: boolean): Set<string> {
  const { byStatTrak } = ensureTargetIndex();
  if (stattrak === undefined) {
    return new Set([...byStatTrak.get(false)!, ...byStatTrak.get(true)!]);
  }
  return byStatTrak.get(stattrak)!;
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
  const { catalog } = ensureTargetIndex();
  const validIds = getValidTargetIds(stattrak);
  let pool = catalog.filter((skin) => validIds.has(skin.id));

  if (stattrak !== undefined) {
    pool = pool.filter((skin) => skin.stattrak === stattrak);
  }

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
  invalidateSkinSearchIndex();
  await warmSkinSearchIndexAsync();

  const local = searchTargetSkinsSync(query, stattrak, limit);
  if (local.length >= limit || query.trim().length < 2) {
    return local;
  }

  try {
    const { checkApiHealth, searchSkinsFromApi } = await import('./api/apiClient');
    if (!(await checkApiHealth())) return local;

    const apiResults = await searchSkinsFromApi(query, limit);
    if (!apiResults?.length) return local;

    const { catalog } = ensureTargetIndex();
    const validIds = getValidTargetIds(stattrak);
    const byId = new Map(catalog.map((s) => [s.id, s]));

    const merged = new Map<string, SkinSearchResult>();
    for (const item of local) merged.set(item.id, item);

    for (const hit of apiResults) {
      const skin = byId.get(hit.id);
      if (!skin || !validIds.has(skin.id)) continue;
      if (stattrak !== undefined && skin.stattrak !== stattrak) continue;
      merged.set(skin.id, enrichSkin(skin));
      if (merged.size >= limit) break;
    }

    return [...merged.values()].slice(0, limit);
  } catch {
    return local;
  }
}

export const skinSearchService = {
  search: searchTargetSkins,
  searchSync: searchTargetSkinsSync,
  warmIndex: warmSkinSearchIndex,
  warmIndexAsync: warmSkinSearchIndexAsync,
  invalidateIndex: invalidateSkinSearchIndex,
};
