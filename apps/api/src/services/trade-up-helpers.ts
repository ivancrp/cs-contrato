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
      item.stattrak === stattrak &&
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
    col.items.filter(
      (item) =>
        item.rarity === inputRarity &&
        item.stattrak === targetSkin.stattrak &&
        !!item.souvenir === !!targetSkin.souvenir &&
        item.minFloat <= maxInputFloatForTargetOutput(maxFloat, item, targetSkin) &&
        isTradeUpEligibleInputCollection(item.collectionId, targetCollectionIds) &&
        collectionHasTradeUpOutput(
          col,
          targetSkin.rarity,
          targetSkin.stattrak,
          !!targetSkin.souvenir,
        ),
    ),
  );
}

export function resolveTargetSkin(
  params: TradeUpSearchParams,
  skins: SkinItem[],
): SkinItem {
  if (params.targetSkinId) {
    const byId = skins.find((s) => s.id === params.targetSkinId);
    if (byId) return byId;
  }

  const normalized = params.skinName.toLowerCase().trim();
  const pool = skins.filter((s) => s.stattrak === params.stattrak);
  const exact = pool.filter((s) => s.name.toLowerCase() === normalized);
  const candidates = exact.length > 0
    ? exact
    : pool.filter((s) => s.name.toLowerCase().includes(normalized));

  if (candidates.length === 0) {
    throw new Error(`Skin não encontrada: ${params.skinName}`);
  }

  return candidates[0];
}

export function estimateAutoBudget(candidates: SearchCandidate[]): number {
  if (candidates.length === 0) return 500;

  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const naiveFloor = sorted.slice(0, 10).reduce((sum, candidate) => sum + candidate.price, 0);

  const targetSorted = sorted.filter((candidate) => candidate.isTargetCollection);
  const fillerSorted = sorted.filter((candidate) => !candidate.isTargetCollection);

  if (targetSorted.length === 0) {
    return Math.ceil(naiveFloor * 2.6) || 500;
  }

  const targetPart = targetSorted.slice(0, 1).reduce((sum, candidate) => sum + candidate.price, 0);
  const fillerPart = fillerSorted.slice(0, 9).reduce((sum, candidate) => sum + candidate.price, 0);
  const constrainedFloor = targetPart + fillerPart;

  return Math.ceil(Math.max(naiveFloor * 2.6, constrainedFloor * 1.35)) || 500;
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
  };
}
