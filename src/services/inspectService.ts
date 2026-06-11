import { generate } from '@vlydev/cs2-masked-inspect-ts';
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

/** Abre o link de inspeção no CS2 (requer Steam + CS2 instalados). */
export function openInspectInGame(inspectUrl: string): void {
  window.location.href = inspectUrl;
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

/** URL de busca no CSFloat com float máximo. */
export function getCSFloatSearchUrl(params: InspectParams): string {
  const hashName = buildMarketHashName(params.skinName, params.stattrak ?? false);
  const q = new URLSearchParams({
    market_hash_name: hashName,
    ...(params.float !== undefined ? { max_float: String(params.float) } : {}),
  });
  return `https://csfloat.com/search?${q.toString()}`;
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
