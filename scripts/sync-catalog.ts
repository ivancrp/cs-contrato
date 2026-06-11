import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Collection, Rarity, SkinItem } from '../src/models/types';
import { mapApiRarity } from '../src/db/rarityMap';

const SKINS_API =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';

const WEAPON_CATEGORIES = new Set(['Rifles', 'SMGs', 'Pistols', 'Heavy']);

const COLLECTION_ID_BY_NAME: Record<string, string> = {
  'The Revolution Collection': 'revolution',
  'The Recoil Collection': 'recoil',
  'The Dreams & Nightmares Collection': 'dreams-nightmares',
  'The Kilowatt Collection': 'kilowatt',
};

type ApiCollection = {
  id: string;
  name: string;
  image?: string;
};

type ApiSkin = {
  id: string;
  name: string;
  weapon?: { name?: string };
  category?: { name?: string };
  rarity?: { id?: string; name?: string };
  collections?: ApiCollection[];
  min_float?: number;
  max_float?: number;
  stattrak?: boolean;
  souvenir?: boolean;
  image?: string;
  paint_index?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveCollectionId(collection: ApiCollection): string {
  return COLLECTION_ID_BY_NAME[collection.name] ?? collection.id;
}

function buildSkinId(
  collectionId: string,
  paintIndex: string | undefined,
  name: string,
  stattrak: boolean,
): string {
  const suffix = stattrak ? 'st' : 'nm';
  const paint = paintIndex ?? slugify(name);
  return `${collectionId}-${paint}-${suffix}`;
}

function expandSkinVariants(skin: ApiSkin, collectionId: string): SkinItem[] {
  const rarity = mapApiRarity(skin.rarity?.id, skin.rarity?.name);
  const weapon = skin.weapon?.name ?? skin.name.split('|')[0]?.trim() ?? 'Unknown';
  const base = {
    name: skin.name,
    weapon,
    collectionId,
    rarity,
    minFloat: skin.min_float ?? 0,
    maxFloat: skin.max_float ?? 1,
    imageUrl: skin.image,
  };

  const variants: SkinItem[] = [
    {
      ...base,
      id: buildSkinId(collectionId, skin.paint_index, skin.name, false),
      stattrak: false,
      souvenir: false,
    },
  ];

  if (skin.stattrak) {
    variants.push({
      ...base,
      id: buildSkinId(collectionId, skin.paint_index, skin.name, true),
      stattrak: true,
      souvenir: false,
    });
  }

  return variants;
}

async function syncCatalog(): Promise<void> {
  const response = await fetch(SKINS_API);
  if (!response.ok) {
    throw new Error(`Falha ao baixar catálogo: HTTP ${response.status}`);
  }

  const apiSkins = (await response.json()) as ApiSkin[];
  const collectionsMap = new Map<string, Collection>();

  for (const skin of apiSkins) {
    const collection = skin.collections?.[0];
    if (!collection || !WEAPON_CATEGORIES.has(skin.category?.name ?? '')) {
      continue;
    }

    const collectionId = resolveCollectionId(collection);
    if (!collectionsMap.has(collectionId)) {
      collectionsMap.set(collectionId, {
        id: collectionId,
        name: collection.name,
        items: [],
      });
    }

    const items = expandSkinVariants(skin, collectionId);
    collectionsMap.get(collectionId)!.items.push(...items);
  }

  const collections = [...collectionsMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const collection of collections) {
    collection.items.sort((a, b) => a.name.localeCompare(b.name));
  }

  const totalSkins = collections.reduce((sum, col) => sum + col.items.length, 0);
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputPath = join(__dirname, '../src/data/catalog.json');

  writeFileSync(outputPath, `${JSON.stringify(collections, null, 2)}\n`, 'utf8');

  console.log(`Catálogo sincronizado: ${collections.length} coleções, ${totalSkins} skins.`);
  console.log(`Arquivo: ${outputPath}`);
}

syncCatalog().catch((error) => {
  console.error('Erro ao sincronizar catálogo:', error);
  process.exit(1);
});
