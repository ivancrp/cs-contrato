import type { WearTier } from '@ct/types';

export const WEAR_TIERS: WearTier[] = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
];

export const WEAR_ABBR: Record<WearTier, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

export const WEAR_ABBR_REVERSE: Record<string, WearTier> = {
  FN: 'Factory New',
  MW: 'Minimal Wear',
  FT: 'Field-Tested',
  WW: 'Well-Worn',
  BS: 'Battle-Scarred',
};

export function buildMarketHashName(name: string, stattrak: boolean, wear: WearTier): string {
  const prefix = stattrak ? 'StatTrak™ ' : '';
  return `${prefix}${name} (${wear})`;
}

export function steamMarketUrl(marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHashName)}`;
}

export function csfloatSearchUrl(marketHashName: string): string {
  return `https://csfloat.com/search?market_hash_name=${encodeURIComponent(marketHashName)}`;
}

export function priceSourceLabel(source: string): string {
  switch (source) {
    case 'csfloat':
      return 'CSFloat';
    case 'steam_scm':
    case 'bymykel':
    case 'steam':
      return 'Steam SCM';
    case 'skinport':
      return 'Skinport';
    default:
      return 'Mercado';
  }
}

export function priceSourceUrl(source: string, marketHashName: string): string {
  if (source === 'csfloat') return csfloatSearchUrl(marketHashName);
  return steamMarketUrl(marketHashName);
}

export function inspectHref(inspectLink: string): string {
  return inspectLink;
}

function parseInspectHex(inspectLink: string): string | null {
  const decoded = decodeURIComponent(inspectLink);
  const match = decoded.match(/csgo_econ_action_preview\s+([0-9A-F]+)/i);
  return match?.[1] ?? null;
}

/** Comando para colar no console do CS2 (`~`). */
export function inspectConsoleCommand(inspectLink: string): string | null {
  const hex = parseInspectHex(inspectLink);
  return hex ? `csgo_econ_action_preview ${hex}` : null;
}

export type InspectOpenResult = 'opened' | 'copied';

/** Abre link steam:// para inspecionar in-game (requer CS2/Steam instalado). */
export function openInspectInGame(inspectLink: string): InspectOpenResult {
  if (!inspectLink || typeof globalThis.window === 'undefined') return 'copied';

  try {
    const anchor = document.createElement('a');
    anchor.href = inspectLink;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return 'opened';
  } catch {
    // segue para fallback
  }

  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = inspectLink;
    document.body.appendChild(iframe);
    globalThis.setTimeout(() => iframe.remove(), 5000);
    return 'opened';
  } catch {
    // segue para fallback
  }

  const cmd = inspectConsoleCommand(inspectLink);
  if (cmd && globalThis.navigator.clipboard?.writeText) {
    void globalThis.navigator.clipboard.writeText(cmd);
  }

  return 'copied';
}
