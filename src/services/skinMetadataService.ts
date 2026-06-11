import { normalizeSkinName } from '../utils/format';

const API_URL =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';

export interface SkinMetadata {
  name: string;
  defIndex: number;
  paintIndex: number;
  rarity: number;
  stattrak: boolean;
  image?: string;
}

const RARITY_IDS: Record<string, number> = {
  rarity_common_weapon: 1,
  rarity_uncommon_weapon: 2,
  rarity_rare_weapon: 3,
  rarity_mythical_weapon: 4,
  rarity_legendary_weapon: 5,
  rarity_ancient_weapon: 6,
  rarity_contraband_weapon: 7,
};

const NAME_ALIASES: Record<string, string> = {
  'scar-20 | fracture': 'scar-20 | fragments',
};

type ApiSkin = {
  name: string;
  image?: string;
  stattrak?: boolean;
  paint_index?: string;
  weapon?: { weapon_id?: number };
  rarity?: { id?: string };
};

/**
 * Índice de metadados CS2 (defindex, paintindex) para gerar inspect links.
 */
class SkinMetadataService {
  private cache = new Map<string, SkinMetadata>();
  private loadPromise: Promise<void> | null = null;

  preload(): Promise<void> {
    return this.ensureLoaded();
  }

  getSync(skinName: string, stattrak = false): SkinMetadata | null {
    const key = this.cacheKey(skinName, stattrak);
    return this.cache.get(key) ?? this.cache.get(this.cacheKey(skinName, false)) ?? null;
  }

  async resolve(skinName: string, stattrak = false): Promise<SkinMetadata | null> {
    const cached = this.getSync(skinName, stattrak);
    if (cached) return cached;
    await this.ensureLoaded();
    return this.getSync(skinName, stattrak);
  }

  private cacheKey(name: string, stattrak: boolean): string {
    const normalized = normalizeSkinName(name);
    const alias = NAME_ALIASES[normalized] ?? normalized;
    return `${alias}|st:${stattrak ? 1 : 0}`;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.fetchAndIndex();
    return this.loadPromise;
  }

  private async fetchAndIndex(): Promise<void> {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) return;
      const skins = (await res.json()) as ApiSkin[];

      for (const skin of skins) {
        if (!skin.name || !skin.weapon?.weapon_id || !skin.paint_index) continue;

        const meta: SkinMetadata = {
          name: skin.name,
          defIndex: skin.weapon.weapon_id,
          paintIndex: parseInt(skin.paint_index, 10),
          rarity: RARITY_IDS[skin.rarity?.id ?? ''] ?? 4,
          stattrak: !!skin.stattrak,
          image: skin.image,
        };

        const key = this.cacheKey(skin.name, meta.stattrak);
        this.cache.set(key, meta);
      }

      for (const [alias, target] of Object.entries(NAME_ALIASES)) {
        const targetMeta = [...this.cache.entries()].find(([k]) => k.startsWith(target));
        if (targetMeta) {
          this.cache.set(`${alias}|st:0`, { ...targetMeta[1], name: alias });
          this.cache.set(`${alias}|st:1`, { ...targetMeta[1], name: alias, stattrak: true });
        }
      }
    } catch {
      // API indisponível
    }
  }
}

export const skinMetadataService = new SkinMetadataService();
