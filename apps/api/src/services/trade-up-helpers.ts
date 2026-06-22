import { getRarityByOffset } from '@ct/common';
import { isTradeUpEligibleInputCollection } from '@ct/contracts';
import {
  floatToWear,
  maxInputFloatForTargetOutput,
  normalizeFloat,
  requiredNormalizedWear,
  defaultWearForSkin,
  isWearValidForSkin,
  resolveTargetMaxFloat,
  wearToMaxFloat,
  WEAR_BOUNDS,
} from '@ct/engine';
import type {
  Collection,
  ContractInput,
  Marketplace,
  MarketListing,
  SkinItem,
  WearTier,
} from '@ct/types';

export interface SearchCandidate {
  listingId: string;
  itemId: string;
  collectionId: string;
  rarity: SkinItem['rarity'];
  stattrak: boolean;
  price: number;
  float: number;
  normalizedFloat: number;
  floatFitScore: number;
  isTargetCollection: boolean;
  marketplace: Marketplace;
  purchaseUrl?: string;
  /** Listing verificado no CSFloat (não estimado por catálogo). */
  isLiveVerified?: boolean;
}

export interface TradeUpSearchParams {
  skinName: string;
  targetSkinId?: string;
  stattrak: boolean;
  wear: WearTier;
  maxFloat?: number;
  budget?: number;
  marketplace: Marketplace;
}

export function buildMarketHashName(name: string, stattrak: boolean, wear: WearTier): string {
  const prefix = stattrak ? 'StatTrak™ ' : '';
  return `${prefix}${name} (${wear})`;
}

/** Indica se a skin pode ser usada em contrato StatTrak. */
export function isStatTrakEligible(skin: SkinItem): boolean {
  if (skin.souvenir) return false;
  if (skin.stattrak) return true;
  return Boolean(skin.stattrakEligible);
}

/** Aplica modo StatTrak/souvenir da busca sobre a skin base do catálogo. */
export function withTradeUpStatTrak(skin: SkinItem, stattrak: boolean): SkinItem | null {
  if (skin.souvenir && stattrak) return null;
  if (!stattrak) {
    return { ...skin, stattrak: false, souvenir: skin.souvenir ?? false };
  }
  if (!isStatTrakEligible(skin)) return null;
  return { ...skin, stattrak: true, souvenir: false };
}

function matchesTradeUpStatTrak(item: SkinItem, wantsStatTrak: boolean): boolean {
  if (item.souvenir) return !wantsStatTrak;
  if (!wantsStatTrak) return !item.stattrak;
  return isStatTrakEligible(item);
}

/** Coleções com flags de StatTrak alinhadas ao contrato (outputs/inputs corretos na engine). */
export function normalizeCollectionsForTradeUp(
  collections: Collection[],
  stattrak: boolean,
  souvenir = false,
): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    items: collection.items
      .filter((item) => matchesTradeUpStatTrak(item, stattrak) && !!item.souvenir === souvenir)
      .map((item) => withTradeUpStatTrak(item, stattrak))
      .filter((item): item is SkinItem => item !== null),
  }));
}

export function resolveTargetWear(
  targetSkin: SkinItem,
  requestedWear: WearTier,
): { wear: WearTier; autoAdjusted: boolean } {
  if (isWearValidForSkin(targetSkin, requestedWear)) {
    return { wear: requestedWear, autoAdjusted: false };
  }
  return { wear: defaultWearForSkin(targetSkin), autoAdjusted: true };
}

export function findCollectionsForTarget(
  targetSkin: SkinItem,
  collections: Collection[],
): Collection[] {
  return collections.filter((col) => col.items.some((item) => item.id === targetSkin.id));
}

export function collectionHasTradeUpOutput(
  collection: Collection,
  outputRarity: SkinItem['rarity'],
  stattrak: boolean,
  souvenir = false,
): boolean {
  return collection.items.some(
    (item) =>
      item.rarity === outputRarity &&
      matchesTradeUpStatTrak(item, stattrak) &&
      !!item.souvenir === souvenir,
  );
}

export function splitInputSkinsByTargetCollection(
  targetSkin: SkinItem,
  inputSkins: SkinItem[],
  collections: Collection[],
): { targetSkins: SkinItem[]; fillerSkins: SkinItem[] } {
  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin, collections).map((c) => c.id),
  );
  const targetSkins = inputSkins.filter((s) => targetCollectionIds.has(s.collectionId));
  const fillerSkins = inputSkins.filter((s) => !targetCollectionIds.has(s.collectionId));
  return { targetSkins, fillerSkins };
}

export function findInputCandidates(
  targetSkin: SkinItem,
  maxFloat: number,
  collections: Collection[],
): SkinItem[] {
  const inputRarity = getRarityByOffset(targetSkin.rarity, -1);
  if (!inputRarity) return [];

  const targetCollectionIds = new Set(
    findCollectionsForTarget(targetSkin, collections).map((c) => c.id),
  );

  return collections.flatMap((col) =>
    col.items
      .filter(
        (item) =>
          item.rarity === inputRarity &&
          matchesTradeUpStatTrak(item, targetSkin.stattrak) &&
          !!item.souvenir === !!targetSkin.souvenir &&
          item.minFloat <= maxInputFloatForTargetOutput(maxFloat, item, targetSkin) &&
          isTradeUpEligibleInputCollection(item.collectionId, targetCollectionIds) &&
          collectionHasTradeUpOutput(
            col,
            targetSkin.rarity,
            targetSkin.stattrak,
            !!targetSkin.souvenir,
          ),
      )
      .map((item) => withTradeUpStatTrak(item, targetSkin.stattrak))
      .filter((item): item is SkinItem => item !== null),
  );
}

export function resolveTargetSkin(
  params: TradeUpSearchParams,
  skins: SkinItem[],
): SkinItem {
  const basePool = skins.filter((s) => !s.stattrak);

  if (params.targetSkinId) {
    const byId = basePool.find((s) => s.id === params.targetSkinId);
    if (byId) {
      const variant = withTradeUpStatTrak(byId, params.stattrak);
      if (!variant) {
        throw new Error(`Skin não disponível em StatTrak: ${byId.name}`);
      }
      return variant;
    }
  }

  const normalized = params.skinName.toLowerCase().trim();
  const exact = basePool.filter((s) => s.name.toLowerCase() === normalized);
  const candidates = exact.length > 0
    ? exact
    : basePool.filter((s) => s.name.toLowerCase().includes(normalized));

  if (candidates.length === 0) {
    throw new Error(`Skin não encontrada: ${params.skinName}`);
  }

  const variant = withTradeUpStatTrak(candidates[0], params.stattrak);
  if (!variant) {
    throw new Error(`Skin não disponível em StatTrak: ${params.skinName}`);
  }

  return variant;
}

export function estimateAutoBudget(candidates: SearchCandidate[]): number {
  if (candidates.length === 0) return 500;

  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const naiveFloor = sorted.slice(0, 10).reduce((sum, candidate) => sum + candidate.price, 0);

  const targetSorted = sorted.filter((candidate) => candidate.isTargetCollection);
  const fillerSorted = sorted.filter((candidate) => !candidate.isTargetCollection);

  if (targetSorted.length === 0) {
    return Math.ceil(naiveFloor * 1.8) || 500;
  }

  const targetPart = targetSorted.slice(0, 1).reduce((sum, candidate) => sum + candidate.price, 0);
  const fillerPart = fillerSorted.slice(0, 9).reduce((sum, candidate) => sum + candidate.price, 0);
  const constrainedFloor = targetPart + fillerPart;

  return Math.ceil(Math.max(constrainedFloor * 1.25, naiveFloor * 1.8)) || 500;
}

export function resolveSearchParams(
  params: TradeUpSearchParams,
  options?: { candidates?: SearchCandidate[]; targetSkin?: SkinItem },
): TradeUpSearchParams & {
  maxFloat: number;
  budget: number;
  wear: WearTier;
  wearAutoAdjusted: boolean;
} {
  const targetSkin = options?.targetSkin;
  const { wear, autoAdjusted } = targetSkin
    ? resolveTargetWear(targetSkin, params.wear)
    : { wear: params.wear, autoAdjusted: false };

  const maxFloat =
    params.maxFloat ??
    (targetSkin ? resolveTargetMaxFloat(targetSkin, wear) : wearToMaxFloat(wear));

  return {
    ...params,
    wear,
    maxFloat,
    wearAutoAdjusted: autoAdjusted,
    budget:
      params.budget ??
      (options?.candidates ? estimateAutoBudget(options.candidates) : 500),
  };
}

export function candidateToContractInput(
  candidate: SearchCandidate,
  item: SkinItem,
  marketplace: Marketplace,
): ContractInput {
  const wear = floatToWear(candidate.float);
  return {
    listing: {
      id: candidate.listingId,
      itemId: candidate.itemId,
      marketHashName: buildMarketHashName(item.name, item.stattrak, wear),
      marketplace: candidate.marketplace ?? marketplace,
      price: candidate.price,
      currency: 'BRL',
      float: candidate.float,
      wear,
      stattrak: item.stattrak,
      purchaseUrl: candidate.purchaseUrl,
    },
    item,
  };
}

export function buildPoolPriceLookup(
  candidates: SearchCandidate[],
  catalogPrices: Map<string, number>,
  skinsById: Map<string, SkinItem>,
  tradeUpStatTrak?: boolean,
): (itemId: string, expectedFloat: number) => number {
  const byItemWear = new Map<string, number>();
  const byItem = new Map<string, number>();

  for (const candidate of candidates) {
    const wear = floatToWear(candidate.float);
    const wearKey = `${candidate.itemId}:${wear}`;
    const existingWear = byItemWear.get(wearKey);
    if (!existingWear || candidate.price < existingWear) {
      byItemWear.set(wearKey, candidate.price);
    }

    const existingItem = byItem.get(candidate.itemId);
    if (!existingItem || candidate.price < existingItem) {
      byItem.set(candidate.itemId, candidate.price);
    }
  }

  return (itemId: string, expectedFloat: number): number => {
    const skin = skinsById.get(itemId);
    if (!skin) return 0;

    const wear = floatToWear(expectedFloat);
    const poolWearPrice = byItemWear.get(`${itemId}:${wear}`);
    if (poolWearPrice && poolWearPrice > 0) return poolWearPrice;

    const stattrak = tradeUpStatTrak ?? skin.stattrak;
    const hash = buildMarketHashName(skin.name, stattrak, wear);
    const direct = catalogPrices.get(hash);
    if (direct && direct > 0) return direct;

    const poolItemPrice = byItem.get(itemId);
    if (poolItemPrice && poolItemPrice > 0) return poolItemPrice;

    return 0;
  };
}

export function sortSkinsByCatalogPrice(
  skins: SkinItem[],
  catalogPrices: Map<string, number>,
): SkinItem[] {
  const wearOrder: WearTier[] = [
    'Battle-Scarred',
    'Well-Worn',
    'Field-Tested',
    'Minimal Wear',
    'Factory New',
  ];

  const minPriceForSkin = (skin: SkinItem): number => {
    let min = Infinity;
    for (const wear of wearOrder) {
      const hash = buildMarketHashName(skin.name, skin.stattrak, wear);
      const price = catalogPrices.get(hash);
      if (price && price > 0 && price < min) min = price;
    }
    return Number.isFinite(min) ? min : Infinity;
  };

  return [...skins].sort((a, b) => minPriceForSkin(a) - minPriceForSkin(b));
}

export function contractCombinationSignature(inputs: ContractInput[]): string {
  return inputs
    .map((input) => `${input.item.id}:${input.listing.float.toFixed(4)}`)
    .sort()
    .join('|');
}

export function computeFloorCost(candidates: SearchCandidate[]): number {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  return sorted.slice(0, 10).reduce((sum, c) => sum + c.price, 0);
}

export function buildIdealNorm(targetSkin: SkinItem, maxFloat: number): number {
  return requiredNormalizedWear(maxFloat, targetSkin);
}

/** Float máximo permitido em cada input para não ultrapassar o wear alvo na saída. */
export function maxAllowedInputFloat(
  targetSkin: SkinItem,
  targetOutputMaxFloat: number,
  inputSkin: SkinItem,
): number {
  return Math.min(
    inputSkin.maxFloat,
    maxInputFloatForTargetOutput(targetOutputMaxFloat, inputSkin, targetSkin),
  );
}

/** Float representativo no meio da faixa de wear compatível com o trade up. */
export function representativeFloatForWear(
  item: SkinItem,
  maxAllowed: number,
  wear: WearTier,
): number {
  const bounds = WEAR_BOUNDS[wear];
  const min = Math.max(bounds.min, item.minFloat);
  const max = Math.min(bounds.max, maxAllowed, item.maxFloat);
  if (min >= max) return Math.round(min * 10000) / 10000;
  return Math.round(((min + max) / 2) * 10000) / 10000;
}

export function steamMarketListingUrl(marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`;
}

export function buildCatalogListing(
  item: SkinItem,
  wear: WearTier,
  price: number,
  maxAllowed: number,
): MarketListing {
  const hash = buildMarketHashName(item.name, item.stattrak, wear);
  const floatValue = representativeFloatForWear(item, maxAllowed, wear);
  return {
    id: `catalog-${item.id}-${wear.replace(/\s+/g, '-')}`,
    itemId: item.id,
    marketHashName: hash,
    marketplace: 'bymykel',
    price,
    currency: 'BRL',
    float: floatValue,
    wear,
    stattrak: item.stattrak,
    purchaseUrl: steamMarketListingUrl(hash),
  };
}

export function toSearchCandidate(
  listing: ContractInput['listing'],
  item: SkinItem,
  idealNorm: number,
  isTargetCollection: boolean,
): SearchCandidate {
  const normalized = normalizeFloat(listing.float, item);
  return {
    listingId: listing.id,
    itemId: item.id,
    collectionId: item.collectionId,
    rarity: item.rarity,
    stattrak: item.stattrak,
    price: listing.price,
    float: listing.float,
    normalizedFloat: normalized,
    floatFitScore: Math.abs(normalized - idealNorm),
    isTargetCollection,
    marketplace: listing.marketplace,
    purchaseUrl: listing.purchaseUrl,
    isLiveVerified: listing.marketplace === 'csfloat' && listing.id.startsWith('csfloat-'),
  };
}
