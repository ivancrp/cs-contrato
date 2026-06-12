export const COLLECTIONS_API_URL =
  'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/collections.json';

type ApiCrate = { id: string; name: string };
type ApiCollectionMeta = { id: string; name: string; crates?: ApiCrate[] };

/** Coleções mapa/operação conhecidas sem weapon case (fallback offline). */
const LIMITED_STATIC_BLOCK = new Set([
  'collection-set-xpshop-wpn-01',
  'collection-set-cobblestone',
  'collection-set-norse',
  'collection-set-stmarc',
  'collection-set-gods-and-monsters',
  'collection-set-kimono',
  'collection-set-cache',
  'collection-set-overpass',
  'collection-set-bank',
  'collection-set-canals',
  'collection-set-baggage',
  'collection-set-italy',
  'collection-set-lake',
  'collection-set-safehouse',
  'collection-set-militia',
  'collection-set-aztec',
  'collection-set-office',
  'collection-set-assault',
  'collection-set-alpha',
  'collection-set-dust',
  'collection-set-inferno',
  'collection-set-mirage',
  'collection-set-nuke',
  'collection-set-train',
  'collection-set-vertigo',
]);

let weaponCaseCollections = new Set<string>();
let metadataLoaded = false;

const SOUVENIR_CRATE = /souvenir package/i;
const LIMITED_NAME = /limited edition/i;

function isWeaponCase(crateName: string): boolean {
  if (SOUVENIR_CRATE.test(crateName)) return false;
  return /\bweapon case\b/i.test(crateName) || /\bcase\b/i.test(crateName);
}

function isWeaponCaseCollection(meta: ApiCollectionMeta): boolean {
  if (LIMITED_NAME.test(meta.name)) return false;
  const crates = meta.crates ?? [];
  return crates.some((crate) => isWeaponCase(crate.name));
}

export async function refreshTradeUpCollectionEligibility(): Promise<void> {
  try {
    const response = await fetch(COLLECTIONS_API_URL);
    if (!response.ok) return;

    const metadata = (await response.json()) as ApiCollectionMeta[];
    weaponCaseCollections = new Set(
      metadata.filter(isWeaponCaseCollection).map((collection) => collection.id),
    );
    metadataLoaded = true;
  } catch {
    // Mantém fallback estático.
  }
}

/**
 * Entradas só podem vir de coleções com weapon case ativo
 * ou da mesma coleção da skin alvo (ex.: Sport & Field para M4A1-S Fade).
 */
export function isTradeUpEligibleInputCollection(
  collectionId: string,
  targetCollectionIds: ReadonlySet<string>,
): boolean {
  if (targetCollectionIds.has(collectionId)) return true;
  if (LIMITED_STATIC_BLOCK.has(collectionId)) return false;
  if (!metadataLoaded) return true;
  return weaponCaseCollections.has(collectionId);
}

export function isTradeUpCollectionMetadataLoaded(): boolean {
  return metadataLoaded;
}
