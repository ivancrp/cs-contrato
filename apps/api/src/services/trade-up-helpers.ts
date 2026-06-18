import { getRarityByOffset } from '@ct/common';
import { isTradeUpEligibleInputCollection } from '@ct/contracts';
import {
  floatToWear,
  maxInputFloatForTargetOutput,
  normalizeFloat,
  requiredNormalizedWear,
  wearToMaxFloat,
  WEAR_BOUNDS,
} from '@ct/engine';
import type {
  Collection,
  ContractInput,
  Marketplace,
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

export function getWearTiersInRange(minFloat: number, maxFloat: number): WearTier[] {
  const tiers = Object.keys(WEAR_BOUNDS) as WearTier[];
  return tiers.filter((wear) => {
    const bounds = WEAR_BOUNDS[wear];
    return bounds.min <= maxFloat && bounds.max >= minFloat;
  });
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
  const floor = sorted.slice(0, 10).reduce((sum, c) => sum + c.price, 0);
  return Math.ceil(floor * 2.6) || 500;
}

export function resolveSearchParams(
  params: TradeUpSearchParams,
  candidates?: SearchCandidate[],
): TradeUpSearchParams & { maxFloat: number; budget: number } {
  return {
    ...params,
    maxFloat: params.maxFloat ?? wearToMaxFloat(params.wear),
    budget: params.budget ?? (candidates ? estimateAutoBudget(candidates) : 500),
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
