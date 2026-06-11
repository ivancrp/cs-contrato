import staticCatalog from './catalog.json';
import { buildCatalogFromApiSkins, SKINS_API_URL, type ApiSkin } from './buildCatalog';
import type { Collection } from '../models/types';

class CatalogStore {
  private collections: Collection[] = staticCatalog as Collection[];
  private refreshPromise: Promise<void> | null = null;

  getCollections(): Collection[] {
    return this.collections;
  }

  refresh(force = false): Promise<void> {
    if (!this.refreshPromise || force) {
      this.refreshPromise = this.fetchLatestCatalog();
    }
    return this.refreshPromise;
  }

  private async fetchLatestCatalog(): Promise<void> {
    try {
      const response = await fetch(SKINS_API_URL);
      if (!response.ok) return;

      const apiSkins = (await response.json()) as ApiSkin[];
      this.collections = buildCatalogFromApiSkins(apiSkins);
    } catch {
      // Mantém catálogo estático em caso de falha de rede.
    }
  }
}

export const catalogStore = new CatalogStore();
