import type { Rarity } from '../models/types';

const RARITY_COLORS: Record<Rarity, string> = {
  consumer: '#b0c3d9',
  industrial: '#5e98d9',
  'mil-spec': '#4b69ff',
  restricted: '#8847ff',
  classified: '#d32ce6',
  covert: '#eb4b4b',
  extraordinary: '#e4ae39',
};

/**
 * Gera SVG inline como fallback quando CDN Steam está bloqueado.
 */
export function generateSkinSvgFallback(name: string, rarity?: Rarity): string {
  const color = rarity ? RARITY_COLORS[rarity] : '#4f8cff';
  const shortName = name.length > 22 ? `${name.slice(0, 20)}…` : name;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" viewBox="0 0 128 96">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#243044"/>
        <stop offset="100%" stop-color="#1a2332"/>
      </linearGradient>
    </defs>
    <rect width="128" height="96" rx="6" fill="url(#g)" stroke="${color}" stroke-width="2"/>
    <rect x="24" y="20" width="80" height="28" rx="4" fill="${color}" opacity="0.25"/>
    <rect x="30" y="52" width="68" height="6" rx="2" fill="${color}" opacity="0.5"/>
    <rect x="38" y="62" width="52" height="4" rx="2" fill="#8b9cb3" opacity="0.4"/>
    <text x="64" y="38" text-anchor="middle" fill="${color}" font-size="9" font-family="system-ui,sans-serif" font-weight="600">${escapeXml(shortName)}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
