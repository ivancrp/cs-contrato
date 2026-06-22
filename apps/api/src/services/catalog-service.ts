import type { CacheAdapter } from '@ct/common';
import { fetchCatalog } from '@ct/parser';
import type { Collection, Crate, SkinItem } from '@ct/types';

export type CatalogSource = 'prisma' | 'cache' | 'parser';

export interface LoadedCatalog {
  collections: Collection[];
  skins: SkinItem[];
  crates: Crate[];
  source: CatalogSource;
}

async function loadFromPrisma(): Promise<LoadedCatalog | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const { CatalogRepository } = await import('../repositories/catalog-repository.js');
    const repo = new CatalogRepository();
    const collections = await repo.getCollections();
    if (collections.length === 0 || !collections.some((c) => c.items.length > 0)) {
      return null;
    }

    const skins = await repo.getSkins();
    const crates = await repo.getCrates();
    return { collections, skins, crates, source: 'prisma' };
  } catch (err) {
    console.warn('[catalog] Prisma indisponível, usando fallback:', (err as Error).message);
    return null;
  }
}

const CATALOG_CACHE_KEY = 'catalog:v4';

export async function loadCatalog(cache: CacheAdapter): Promise<LoadedCatalog> {
  const fromDb = await loadFromPrisma();
  if (fromDb) {
    await cache.set(
      CATALOG_CACHE_KEY,
      { collections: fromDb.collections, skins: fromDb.skins },
      Number(process.env.CACHE_TTL_CATALOG ?? 86400),
    );
    await cache.set('crates', fromDb.crates, Number(process.env.CACHE_TTL_CATALOG ?? 86400));
    return fromDb;
  }

  const cached = await cache.get<{ collections: Collection[]; skins: SkinItem[] }>(CATALOG_CACHE_KEY);
  const cachedCrates = await cache.get<Crate[]>('crates');

  if (cached?.collections?.length) {
    return {
      collections: cached.collections,
      skins: cached.skins,
      crates: cachedCrates ?? [],
      source: 'cache',
    };
  }

  const catalog = await fetchCatalog();
  await cache.set(
    CATALOG_CACHE_KEY,
    { collections: catalog.collections, skins: catalog.skins },
    Number(process.env.CACHE_TTL_CATALOG ?? 86400),
  );
  await cache.set('crates', catalog.crates, Number(process.env.CACHE_TTL_CATALOG ?? 86400));

  return {
    collections: catalog.collections,
    skins: catalog.skins,
    crates: catalog.crates,
    source: 'parser',
  };
}
