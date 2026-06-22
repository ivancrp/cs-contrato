import { createId } from '@ct/common';
import type { CacheAdapter } from '@ct/common';
import type { TradeUpContract } from '@ct/types';

export interface SharedContractPayload {
  version: 1;
  savedAt: string;
  targetSkin: {
    id: string;
    name: string;
    weapon: string;
    imageUrl?: string;
    rarity?: string;
    collectionId?: string;
    minFloat?: number;
    maxFloat?: number;
    stattrak?: boolean;
  };
  wear?: string;
  collectionLabels?: Record<string, string>;
  contract: TradeUpContract & {
    tier?: string;
    tierLabel?: string;
    aiScore?: number;
  };
}

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dias

function shareKey(id: string): string {
  return `contract:share:${id}`;
}

export async function saveSharedContract(
  cache: CacheAdapter,
  payload: Omit<SharedContractPayload, 'version' | 'savedAt'>,
): Promise<{ id: string }> {
  const id = createId('share');
  const record: SharedContractPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...payload,
  };
  await cache.set(shareKey(id), record, SHARE_TTL_SECONDS);
  return { id };
}

export async function loadSharedContract(
  cache: CacheAdapter,
  id: string,
): Promise<SharedContractPayload | null> {
  if (!id || id.length > 64) return null;
  return cache.get<SharedContractPayload>(shareKey(id));
}
