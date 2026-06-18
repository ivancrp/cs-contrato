import { config } from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { mapApiRarity } from '@ct/parser';

config();

neonConfig.webSocketConstructor = ws;

const SKINS_API =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json';

/** Categorias equivalentes à listagem /skins/ do CSGO Database (somente armas). */
const WEAPON_CATEGORIES = new Set(['Rifles', 'SMGs', 'Pistols', 'Heavy']);

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

type CollectionRow = {
  id: string;
  name: string;
  image_url: string | null;
};

type SkinRow = {
  id: string;
  name: string;
  weapon: string;
  collection_id: string | null;
  rarity: string;
  min_float: number;
  max_float: number;
  stattrak: boolean;
  souvenir: boolean;
  image_url: string | null;
  paint_index: string | null;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchWeaponSkins(): Promise<ApiSkin[]> {
  const response = await fetch(SKINS_API);
  if (!response.ok) {
    throw new Error(`Falha ao baixar catálogo: HTTP ${response.status}`);
  }

  const skins = (await response.json()) as ApiSkin[];

  return skins.filter(
    (skin) =>
      skin.collections?.length &&
      WEAPON_CATEGORIES.has(skin.category?.name ?? ''),
  );
}

function buildRows(skins: ApiSkin[]): { collections: CollectionRow[]; skins: SkinRow[] } {
  const collectionsMap = new Map<string, CollectionRow>();
  const skinRows: SkinRow[] = [];

  for (const skin of skins) {
    const collection = skin.collections?.[0];
    if (collection) {
      collectionsMap.set(collection.id, {
        id: collection.id,
        name: collection.name,
        image_url: collection.image ?? null,
      });
    }

    skinRows.push({
      id: skin.id,
      name: skin.name,
      weapon: skin.weapon?.name ?? skin.name.split('|')[0]?.trim() ?? 'Unknown',
      collection_id: collection?.id ?? null,
      rarity: mapApiRarity(skin.rarity?.id, skin.rarity?.name),
      min_float: skin.min_float ?? 0,
      max_float: skin.max_float ?? 1,
      stattrak: !!skin.stattrak,
      souvenir: !!skin.souvenir,
      image_url: skin.image ?? null,
      paint_index: skin.paint_index ?? null,
    });
  }

  return {
    collections: [...collectionsMap.values()],
    skins: skinRows,
  };
}

async function upsertCollections(
  sql: ReturnType<typeof neon>,
  collections: CollectionRow[],
): Promise<void> {
  for (const batch of chunk(collections, 100)) {
    const ids = batch.map((c) => c.id);
    const names = batch.map((c) => c.name);
    const images = batch.map((c) => c.image_url);

    await sql`
      INSERT INTO collections (id, name, image_url, updated_at)
      SELECT t.id, t.name, t.image_url, NOW()
      FROM UNNEST(
        ${ids}::text[],
        ${names}::text[],
        ${images}::text[]
      ) AS t(id, name, image_url)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        image_url = EXCLUDED.image_url,
        updated_at = NOW()
    `;
  }
}

async function upsertSkins(sql: ReturnType<typeof neon>, skins: SkinRow[]): Promise<void> {
  for (const batch of chunk(skins, 100)) {
    const ids = batch.map((s) => s.id);
    const names = batch.map((s) => s.name);
    const weapons = batch.map((s) => s.weapon);
    const collectionIds = batch.map((s) => s.collection_id);
    const rarities = batch.map((s) => s.rarity);
    const minFloats = batch.map((s) => s.min_float);
    const maxFloats = batch.map((s) => s.max_float);
    const stattraks = batch.map((s) => s.stattrak);
    const souvenirs = batch.map((s) => s.souvenir);
    const images = batch.map((s) => s.image_url);
    const paintIndexes = batch.map((s) => s.paint_index);

    await sql`
      INSERT INTO skins (
        id,
        name,
        weapon,
        collection_id,
        rarity,
        min_float,
        max_float,
        stattrak,
        souvenir,
        image_url,
        paint_index,
        source,
        updated_at
      )
      SELECT
        t.id,
        t.name,
        t.weapon,
        t.collection_id,
        t.rarity,
        t.min_float,
        t.max_float,
        t.stattrak,
        t.souvenir,
        t.image_url,
        t.paint_index,
        'bymykel',
        NOW()
      FROM UNNEST(
        ${ids}::text[],
        ${names}::text[],
        ${weapons}::text[],
        ${collectionIds}::text[],
        ${rarities}::text[],
        ${minFloats}::numeric[],
        ${maxFloats}::numeric[],
        ${stattraks}::boolean[],
        ${souvenirs}::boolean[],
        ${images}::text[],
        ${paintIndexes}::text[]
      ) AS t(
        id,
        name,
        weapon,
        collection_id,
        rarity,
        min_float,
        max_float,
        stattrak,
        souvenir,
        image_url,
        paint_index
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        weapon = EXCLUDED.weapon,
        collection_id = EXCLUDED.collection_id,
        rarity = EXCLUDED.rarity,
        min_float = EXCLUDED.min_float,
        max_float = EXCLUDED.max_float,
        stattrak = EXCLUDED.stattrak,
        souvenir = EXCLUDED.souvenir,
        image_url = EXCLUDED.image_url,
        paint_index = EXCLUDED.paint_index,
        source = EXCLUDED.source,
        updated_at = NOW()
    `;
  }
}

async function seed(): Promise<void> {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error('DATABASE_URL não encontrada no .env');
  }

  const sql = neon(url);
  const apiSkins = await fetchWeaponSkins();
  const { collections, skins } = buildRows(apiSkins);

  console.log(`Importando ${collections.length} coleções e ${skins.length} skins...`);

  await upsertCollections(sql, collections);
  await upsertSkins(sql, skins);

  const counts = await sql<{ table_name: string; total: number }[]>`
    SELECT 'collections' AS table_name, COUNT(*)::int AS total FROM collections
    UNION ALL
    SELECT 'skins' AS table_name, COUNT(*)::int AS total FROM skins
  `;

  console.log('Seed concluído:');
  for (const row of counts) {
    console.log(`- ${row.table_name}: ${row.total}`);
  }
}

seed().catch((error) => {
  console.error('Erro no seed:', error);
  process.exit(1);
});
