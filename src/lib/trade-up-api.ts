import { API_BASE } from '@/lib/api';
import type { EnrichedTradeUpContract, TradeUpSearchResult } from '@/components/TradeUpResults';
import type { ContractInput, TradeUpContract } from '@ct/types';

export interface SharedContractPayload {
  version: 1;
  savedAt: string;
  targetSkin: TradeUpSearchResult['targetSkin'] & { stattrak?: boolean };
  wear?: string;
  collectionLabels?: Record<string, string>;
  contract: EnrichedTradeUpContract;
}

export async function buildContractFromInputs(
  inputs: ContractInput[],
  targetSkinId: string,
  stattrak?: boolean,
): Promise<TradeUpContract> {
  const res = await fetch(`${API_BASE}/contracts/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs, targetSkinId, stattrak }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha ao recalcular contrato');
  return data as TradeUpContract;
}

export async function shareContract(
  payload: Omit<SharedContractPayload, 'version' | 'savedAt'>,
): Promise<string> {
  const res = await fetch(`${API_BASE}/contracts/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha ao compartilhar contrato');
  return data.id as string;
}

export async function loadSharedContract(shareId: string): Promise<SharedContractPayload> {
  const res = await fetch(`${API_BASE}/contracts/share/${encodeURIComponent(shareId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Contrato não encontrado');
  return data as SharedContractPayload;
}

export function buildShareUrl(shareId: string): string {
  if (typeof window === 'undefined') return `/trade-up?share=${shareId}`;
  return `${window.location.origin}/trade-up?share=${shareId}`;
}

export function sharedPayloadToSearchResult(
  payload: SharedContractPayload,
): TradeUpSearchResult {
  return {
    targetSkin: payload.targetSkin,
    wear: payload.wear,
    contracts: [payload.contract],
    collectionLabels: payload.collectionLabels,
    marketAvailability: {
      listingsFound: payload.contract.inputs.length,
      priceSource: 'catalog',
    },
  };
}
