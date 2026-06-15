import { fetchCatalog } from '@ct/parser';
import type { Collection, Crate, SkinItem } from '@ct/types';
import { getPrisma } from '../db/client.js';

export class CatalogRepository {
  async syncFromParser(): Promise<{ skins: number; collections: number; crates: number }> {
    const prisma = getPrisma();
    const catalog = await fetchCatalog();

    for (const collection of catalog.collections) {
      await prisma.collection.upsert({
        where: { id: collection.id },
        create: { id: collection.id, name: collection.name, imageUrl: collection.imageUrl },
        update: { name: collection.name, imageUrl: collection.imageUrl },
      });
    }

    for (const skin of catalog.skins) {
      await prisma.skin.upsert({
        where: { id: skin.id },
        create: {
          id: skin.id,
          name: skin.name,
          weapon: skin.weapon,
          collectionId: skin.collectionId,
          rarity: mapRarity(skin.rarity),
          minFloat: skin.minFloat,
          maxFloat: skin.maxFloat,
          stattrak: skin.stattrak,
          souvenir: skin.souvenir ?? false,
          paintIndex: skin.paintIndex,
          finishCatalog: skin.finishCatalog,
          imageUrl: skin.imageUrl,
        },
        update: {
          name: skin.name,
          weapon: skin.weapon,
          collectionId: skin.collectionId,
          rarity: mapRarity(skin.rarity),
          minFloat: skin.minFloat,
          maxFloat: skin.maxFloat,
          stattrak: skin.stattrak,
          souvenir: skin.souvenir ?? false,
          paintIndex: skin.paintIndex,
          finishCatalog: skin.finishCatalog,
          imageUrl: skin.imageUrl,
        },
      });
    }

    for (const crate of catalog.crates) {
      await prisma.crate.upsert({
        where: { id: crate.id },
        create: {
          id: crate.id,
          name: crate.name,
          collectionId: crate.collectionId,
          year: crate.year,
          status: crate.status,
          dropPool: crate.dropPool,
        },
        update: {
          name: crate.name,
          collectionId: crate.collectionId,
          year: crate.year,
          status: crate.status,
          dropPool: crate.dropPool,
        },
      });
    }

    return {
      skins: catalog.skins.length,
      collections: catalog.collections.length,
      crates: catalog.crates.length,
    };
  }

  async getCollections(): Promise<Collection[]> {
    const prisma = getPrisma();
    const rows = await prisma.collection.findMany({ include: { skins: true } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      imageUrl: row.imageUrl ?? undefined,
      items: row.skins.map(mapSkinRow),
    }));
  }

  async getSkins(): Promise<SkinItem[]> {
    const prisma = getPrisma();
    const rows = await prisma.skin.findMany();
    return rows.map(mapSkinRow);
  }

  async getCrates(): Promise<Crate[]> {
    const prisma = getPrisma();
    const rows = await prisma.crate.findMany({ include: { drops: true } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      collectionId: row.collectionId ?? undefined,
      year: row.year ?? undefined,
      status: row.status as Crate['status'],
      dropPool: row.dropPool ?? undefined,
      skins: row.drops.filter((d) => d.dropType === 'skin').map(mapDropRow),
      knives: row.drops.filter((d) => d.dropType === 'knife').map(mapDropRow),
      gloves: row.drops.filter((d) => d.dropType === 'glove').map(mapDropRow),
    }));
  }
}

function mapRarity(rarity: SkinItem['rarity']) {
  return rarity === 'mil-spec' ? 'mil_spec' : rarity;
}

function mapSkinRow(row: {
  id: string;
  name: string;
  weapon: string;
  collectionId: string;
  rarity: string;
  minFloat: { toNumber(): number };
  maxFloat: { toNumber(): number };
  stattrak: boolean;
  souvenir: boolean;
  paintIndex: string | null;
  finishCatalog: string | null;
  imageUrl: string | null;
}): SkinItem {
  return {
    id: row.id,
    name: row.name,
    weapon: row.weapon,
    collectionId: row.collectionId,
    rarity: row.rarity === 'mil_spec' ? 'mil-spec' : (row.rarity as SkinItem['rarity']),
    minFloat: row.minFloat.toNumber(),
    maxFloat: row.maxFloat.toNumber(),
    stattrak: row.stattrak,
    souvenir: row.souvenir,
    paintIndex: row.paintIndex ?? undefined,
    finishCatalog: row.finishCatalog ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
  };
}

function mapDropRow(drop: {
  skinId: string;
  probability: { toNumber(): number };
  source: string;
  confidence: { toNumber(): number } | null;
  reference: string | null;
}) {
  return {
    skinId: drop.skinId,
    probability: {
      probability: drop.probability.toNumber(),
      source: drop.source as 'official' | 'community' | 'estimated' | 'unknown',
      confidence: drop.confidence?.toNumber(),
      reference: drop.reference ?? undefined,
    },
  };
}
