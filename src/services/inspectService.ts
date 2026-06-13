import { generate } from '@vlydev/cs2-masked-inspect-ts';
import type { Marketplace } from '../models/types';
import { buildMarketHashName } from '../utils/format';
import { skinMetadataService } from './skinMetadataService';

/** Quality 9 = StatTrak™ no CS2 */
const STATTRAK_QUALITY = 9;
const NORMAL_QUALITY = 0;

export interface InspectParams {
  skinName: string;
  stattrak?: boolean;
  float?: number;
  paintSeed?: number;
  wear?: string;
}

/**
 * Gera link steam:// para inspecionar skin no CS2.
 * Usa defindex + paintindex da CSGO-API e float/seed do contrato.
 */
export async function generateInspectLink(params: InspectParams): Promise<string | null> {
  const meta = await skinMetadataService.resolve(params.skinName, params.stattrak ?? false);
  if (!meta) return null;

  const paintWear = Math.min(Math.max(params.float ?? 0.15, 0), 1);
  const paintSeed = params.paintSeed ?? 1;

  return generate(meta.defIndex, meta.paintIndex, paintSeed, paintWear, {
    rarity: meta.rarity,
    quality: params.stattrak ? STATTRAK_QUALITY : NORMAL_QUALITY,
  });
}

/** Abre o link de inspeção no CS2 sem sair da página do app. */
export function openInspectInGame(inspectUrl: string): void {
  const anchor = document.createElement('a');
  anchor.href = inspectUrl;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/** URL do Steam Market para a skin com wear específico. */
export function getSteamMarketUrl(params: InspectParams): string {
  const hashName = buildMarketHashName(
    params.skinName,
    params.stattrak ?? false,
    params.wear,
  );
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(hashName)}`;
}

/** URL de busca no CSFloat com def_index, paint_index e max_float (formato do site). */
export interface CSFloatSearchOptions {
  defIndex: number;
  paintIndex: number;
  maxFloat: number;
  stattrak?: boolean;
}

export function buildCSFloatSearchUrl(options: CSFloatSearchOptions): string {
  const q = new URLSearchParams({
    sort_by: 'lowest_price',
    max_float: String(options.maxFloat),
    type: 'buy_now',
    def_index: String(options.defIndex),
    paint_index: String(options.paintIndex),
  });
  if (options.stattrak) {
    q.set('category', '2');
  }
  return `https://csfloat.com/search?${q.toString()}`;
}

/** Monta URL CSFloat a partir do catálogo de metadados (def/paint index). */
export function getCSFloatSearchUrlForSkin(params: InspectParams): string | null {
  const meta = skinMetadataService.getSync(params.skinName, params.stattrak ?? false);
  if (!meta) return null;

  return buildCSFloatSearchUrl({
    defIndex: meta.defIndex,
    paintIndex: meta.paintIndex,
    maxFloat: params.float ?? 0.15,
    stattrak: params.stattrak,
  });
}

/** @deprecated Prefer buildCSFloatSearchUrl com def_index/paint_index. */
export function getCSFloatExactSearchUrl(params: InspectParams): string {
  const fromMeta = getCSFloatSearchUrlForSkin(params);
  if (fromMeta) return fromMeta;

  const hashName = buildMarketHashName(params.skinName, params.stattrak ?? false, params.wear);
  const q = new URLSearchParams({
    sort_by: 'lowest_price',
    max_float: String(params.float ?? 0.15),
    type: 'buy_now',
    market_hash_name: hashName,
  });
  return `https://csfloat.com/search?${q.toString()}`;
}

/** URL de busca no CSFloat com float máximo (fallback por nome). */
export function getCSFloatSearchUrl(params: InspectParams): string {
  const fromMeta = getCSFloatSearchUrlForSkin(params);
  if (fromMeta) return fromMeta;

  const hashName = buildMarketHashName(params.skinName, params.stattrak ?? false);
  const q = new URLSearchParams({
    sort_by: 'lowest_price',
    type: 'buy_now',
    market_hash_name: hashName,
    ...(params.float !== undefined ? { max_float: String(params.float) } : {}),
  });
  return `https://csfloat.com/search?${q.toString()}`;
}

/** URL de compra/busca conforme marketplace e listing do contrato. */
export function getListingPurchaseUrl(
  params: InspectParams,
  marketplace: Marketplace,
  purchaseUrl?: string,
): string | null {
  if (purchaseUrl) return purchaseUrl;

  switch (marketplace) {
    case 'csfloat':
    case 'all':
      return getCSFloatSearchUrlForSkin(params) ?? getCSFloatExactSearchUrl(params);
    case 'steam':
      return getSteamMarketUrl(params);
    case 'skinport':
      return getSkinportSearchUrl(params);
    case 'buff':
      return getBuffSearchUrl(params);
    default:
      return getCSFloatSearchUrlForSkin(params);
  }
}

function stripWearFromHashName(hashName: string): string {
  return hashName.replace(/\s*\([^)]+\)$/, '').trim();
}

/** URL de busca no Skinport. */
export function getSkinportSearchUrl(params: InspectParams): string {
  const hashName = buildMarketHashName(params.skinName, params.stattrak ?? false);
  return `https://skinport.com/market?search=${encodeURIComponent(stripWearFromHashName(hashName))}`;
}

/** URL de busca no Buff163. */
export function getBuffSearchUrl(params: InspectParams): string {
  const hashName = buildMarketHashName(params.skinName, params.stattrak ?? false);
  return `https://buff.163.com/market/csgo#tab=selling&search=${encodeURIComponent(stripWearFromHashName(hashName))}`;
}

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  steam: 'Steam',
  csfloat: 'CSFloat',
  skinport: 'Skinport',
  buff: 'Buff',
  pricempire: 'Pricempire',
  all: 'CSFloat',
};

export function getMarketplaceLabel(marketplace: Marketplace): string {
  return MARKETPLACE_LABELS[marketplace] ?? 'Mercado';
}

/** URL de busca no marketplace onde a skin foi encontrada. */
export function getMarketplaceSearchUrl(
  params: InspectParams,
  marketplace: Marketplace,
): string {
  switch (marketplace) {
    case 'steam':
      return getSteamMarketUrl(params);
    case 'csfloat':
      return getCSFloatSearchUrl(params);
    case 'skinport':
      return getSkinportSearchUrl(params);
    case 'buff':
      return getBuffSearchUrl(params);
    case 'all':
    case 'pricempire':
    default:
      return getCSFloatSearchUrl(params);
  }
}

/** Copia texto para clipboard. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
