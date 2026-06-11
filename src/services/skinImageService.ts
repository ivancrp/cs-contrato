import { SKIN_IMAGE_MAP } from '../data/skinImages';
import { normalizeSkinName } from '../utils/format';

function normalizeCdnUrl(url: string): string {
  return url.replace(
    /community\.(akamai|cloudflare)\.steamstatic\.com/i,
    'community.fastly.steamstatic.com',
  );
}

const API_URL =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';
const COLLECTIONS_API_URL =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/collections.json';
const CACHE_KEY = 'cs2-skin-images-cache-v2';

/** Aliases para nomes incorretos ou variações */
const NAME_ALIASES: Record<string, string> = {
  'scar-20 | fracture': 'SCAR-20 | Fragments',
};

type ApiSkin = { name: string; image?: string };
type ApiCollectionItem = { name: string; image?: string };

/**
 * Serviço de imagens com cache estático + carregamento dinâmico da CSGO-API.
 */
class SkinImageService {
  private cache = new Map<string, string>();
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    this.hydrateFromStorage();
    Object.entries(SKIN_IMAGE_MAP).forEach(([name, url]) => {
      this.cache.set(normalizeSkinName(name), normalizeCdnUrl(url));
    });
  }

  /** Pré-carrega índice completo da API (chamar no boot do app). */
  preload(): Promise<void> {
    return this.ensureLoaded();
  }

  /** Resolve URL de forma síncrona (cache + estático). */
  getSync(skinName: string): string | null {
    const key = this.resolveKey(skinName);
    return this.cache.get(key) ?? null;
  }

  /** Resolve URL assíncrona, buscando na API se necessário. */
  async resolve(skinName: string): Promise<string | null> {
    const key = this.resolveKey(skinName);
    const cached = this.cache.get(key);
    if (cached) return cached;

    await this.ensureLoaded();
    return this.cache.get(key) ?? null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private resolveKey(skinName: string): string {
    const normalized = normalizeSkinName(skinName);
    const alias = NAME_ALIASES[normalized];
    return alias ? normalizeSkinName(alias) : normalized;
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private hydrateFromStorage(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([k, v]) => this.cache.set(k, v));
    } catch {
      // ignore corrupt cache
    }
  }

  private persist(): void {
    try {
      const obj = Object.fromEntries(this.cache);
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {
      // storage full or unavailable
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.fetchAndIndex();
    }
    return this.loadPromise;
  }

  private async fetchAndIndex(): Promise<void> {
    try {
      const [skinsRes, collectionsRes] = await Promise.all([
        fetch(API_URL),
        fetch(COLLECTIONS_API_URL),
      ]);

      if (skinsRes.ok) {
        const skins = (await skinsRes.json()) as ApiSkin[];
        for (const skin of skins) {
          if (skin.name && skin.image) {
            this.cache.set(normalizeSkinName(skin.name), normalizeCdnUrl(skin.image));
          }
        }
      }

      if (collectionsRes.ok) {
        const collections = (await collectionsRes.json()) as {
          contains?: ApiCollectionItem[];
        }[];
        for (const col of collections) {
          for (const item of col.contains ?? []) {
            if (item.name && item.image) {
              this.cache.set(normalizeSkinName(item.name), normalizeCdnUrl(item.image));
            }
          }
        }
      }

      // Aplicar aliases após indexação
      for (const [alias, target] of Object.entries(NAME_ALIASES)) {
        const targetUrl = this.cache.get(normalizeSkinName(target));
        if (targetUrl) this.cache.set(alias, targetUrl);
      }

      this.persist();
      this.notify();
    } catch {
      // API indisponível — mantém cache estático
    }
  }
}

export const skinImageService = new SkinImageService();
