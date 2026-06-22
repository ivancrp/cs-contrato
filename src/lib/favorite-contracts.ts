import type { EnrichedTradeUpContract, TradeUpSearchResult } from '@/components/TradeUpResults';

export interface FavoriteContract {
  id: string;
  createdAt: string;
  label: string;
  targetSkinName: string;
  tierLabel: string;
  totalCost: number;
  roi: number;
  payload: FavoriteContractPayload;
}

export interface FavoriteContractPayload {
  targetSkin: TradeUpSearchResult['targetSkin'] & { stattrak?: boolean };
  wear?: string;
  collectionLabels?: Record<string, string>;
  contract: EnrichedTradeUpContract;
}

const STORAGE_KEY = 'ct-favorite-contracts';

function readAll(): FavoriteContract[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteContract[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: FavoriteContract[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listFavoriteContracts(): FavoriteContract[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function isContractFavorited(contractId: string): boolean {
  return readAll().some((item) => item.payload.contract.id === contractId);
}

export function addFavoriteContract(payload: FavoriteContractPayload): FavoriteContract {
  const existing = readAll();
  const duplicate = existing.find((item) => item.payload.contract.id === payload.contract.id);
  if (duplicate) return duplicate;

  const favorite: FavoriteContract = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    label: `${payload.targetSkin.name} · ${payload.contract.tierLabel}`,
    targetSkinName: payload.targetSkin.name,
    tierLabel: payload.contract.tierLabel,
    totalCost: payload.contract.evMetrics.totalCost,
    roi: payload.contract.evMetrics.roi,
    payload,
  };

  writeAll([favorite, ...existing]);
  return favorite;
}

export function removeFavoriteContract(id: string): void {
  writeAll(readAll().filter((item) => item.id !== id));
}

export function removeFavoriteByContractId(contractId: string): void {
  writeAll(readAll().filter((item) => item.payload.contract.id !== contractId));
}
