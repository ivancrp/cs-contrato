import type { Collection, Crate, ProbabilityMetadata, Rarity, SkinItem } from '@ct/types';

const CSGO_API_BASE =
  process.env.CSGO_API_BASE ??
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en';

interface ApiSkin {
  id: string;
  name: string;
  weapon?: { name: string; weapon_id?: number };
  collections?: { id: string; name: string }[];
  rarity?: { name: string; color?: string };
  min_float?: number;
  max_float?: number;
  stattrak?: boolean;
  souvenir?: boolean;
  image?: string;
  paint_index?: string;
  pattern?: { id?: string };
}

interface ApiCrate {
  id: string;
  name: string;
  contains?: { id: string; name: string; rarity?: { name: string } }[];
  contains_rare?: { id: string; name: string }[];
  first_sale_date?: string;
  type?: string;
}

const RARITY_MAP: Record<string, Rarity> = {
  'Consumer Grade': 'consumer',
  'Industrial Grade': 'industrial',
  'Mil-Spec Grade': 'mil-spec',
  Restricted: 'restricted',
  Classified: 'classified',
  Covert: 'covert',
  Extraordinary: 'extraordinary',
  Contraband: 'extraordinary',
};

const RARITY_BY_API_ID: Record<string, Rarity> = {
  rarity_common_weapon: 'consumer',
  rarity_uncommon_weapon: 'industrial',
  rarity_rare_weapon: 'mil-spec',
  rarity_mythical_weapon: 'restricted',
  rarity_legendary_weapon: 'classified',
  rarity_ancient_weapon: 'covert',
  rarity_contraband_weapon: 'extraordinary',
};

export function mapApiRarity(rarityId?: string, rarityName?: string): Rarity {
  if (rarityId && RARITY_BY_API_ID[rarityId]) {
    return RARITY_BY_API_ID[rarityId];
  }
  return mapRarity(rarityName);
}

export function mapRarity(name?: string): Rarity {
  if (!name) return 'mil-spec';
  return RARITY_MAP[name] ?? 'mil-spec';
}

export function parseSkin(raw: ApiSkin): SkinItem | null {
  const collection = raw.collections?.[0];
  if (!collection) return null;

  return {
    id: raw.id,
    name: raw.name,
    weapon: raw.weapon?.name ?? 'Unknown',
    weaponDefIndex: raw.weapon?.weapon_id,
    collectionId: collection.id,
    rarity: mapRarity(raw.rarity?.name),
    minFloat: raw.min_float ?? 0,
    maxFloat: raw.max_float ?? 1,
    stattrak: false,
    souvenir: false,
    imageUrl: raw.image,
    paintIndex: raw.paint_index,
    finishCatalog: raw.pattern?.id,
  };
}

export function parseCollection(id: string, name: string, items: SkinItem[]): Collection {
  return { id, name, items };
}

/**
 * Probabilidade de drop em caixa — SEM dados oficiais da Valve.
 * Retorna metadata source: unknown quando não há informação confiável.
 */
export function createUnknownDropProbability(): ProbabilityMetadata {
  return {
    probability: 0,
    source: 'unknown',
    reference: 'Valve não publica drop rates oficiais para caixas CS2',
  };
}

export function parseCrate(raw: ApiCrate): Crate {
  const unknownProb = createUnknownDropProbability();

  const mapDrop = (item: { id: string }) => ({
    skinId: item.id,
    probability: { ...unknownProb },
  });

  return {
    id: raw.id,
    name: raw.name,
    year: raw.first_sale_date ? new Date(raw.first_sale_date).getFullYear() : undefined,
    status: 'unknown',
    skins: (raw.contains ?? []).map(mapDrop),
    knives: (raw.contains_rare ?? []).map(mapDrop),
    gloves: [],
  };
}

/** Fetch e parse do catálogo ByMykel CSGO-API */
export async function fetchCatalog(): Promise<{
  skins: SkinItem[];
  collections: Collection[];
  crates: Crate[];
}> {
  const [skinsRes, cratesRes] = await Promise.all([
    fetch(`${CSGO_API_BASE}/skins.json`),
    fetch(`${CSGO_API_BASE}/crates.json`),
  ]);

  if (!skinsRes.ok) throw new Error(`Failed to fetch skins: ${skinsRes.status}`);

  const rawSkins = (await skinsRes.json()) as ApiSkin[];
  const skins = rawSkins.map(parseSkin).filter((s): s is SkinItem => s !== null);

  const collectionMap = new Map<string, Collection>();
  for (const raw of rawSkins) {
    const skin = parseSkin(raw);
    if (!skin) continue;
    const colMeta = raw.collections?.[0];
    if (!colMeta) continue;

    const existing = collectionMap.get(colMeta.id);
    if (existing) {
      existing.items.push(skin);
    } else {
      collectionMap.set(colMeta.id, {
        id: colMeta.id,
        name: colMeta.name,
        items: [skin],
      });
    }
  }

  const crates: Crate[] = [];
  if (cratesRes.ok) {
    const rawCrates = (await cratesRes.json()) as ApiCrate[];
    crates.push(...rawCrates.map(parseCrate));
  }

  return {
    skins,
    collections: [...collectionMap.values()],
    crates,
  };
}
