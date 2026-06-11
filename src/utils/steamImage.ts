/** Tamanhos suportados pelo CDN Steam */
const SIZE_MAP = { sm: '128fx96f', md: '256fx192f', lg: '360fx360f' } as const;

/** Extrai hash da URL Steam economy */
export function extractSteamImageHash(url: string): string | null {
  const match = url.match(/\/economy\/image\/([^/]+)/i);
  return match?.[1] ?? null;
}

/**
 * Normaliza URL do CDN Steam e aplica tamanho.
 */
export function buildSteamImageUrl(
  baseUrl: string,
  size: keyof typeof SIZE_MAP = 'md',
): string {
  if (!baseUrl || baseUrl.startsWith('data:')) return baseUrl;

  const hash = extractSteamImageHash(baseUrl) ?? baseUrl;
  const dim = SIZE_MAP[size];
  return `/steam-img/economy/image/${hash}/${dim}`;
}

/**
 * URLs para tentativa em ordem: proxy local → CDNs diretos.
 */
export function getSteamImageFallbacks(
  baseUrl: string,
  size: keyof typeof SIZE_MAP = 'md',
): string[] {
  if (!baseUrl || baseUrl.startsWith('data:')) return [baseUrl];

  const hash = extractSteamImageHash(baseUrl);
  if (!hash) return [baseUrl];

  const dim = SIZE_MAP[size];
  const hosts = [
    '', // proxy via /steam-img (vite dev/preview)
    'https://community.fastly.steamstatic.com',
    'https://community.cloudflare.steamstatic.com',
    'https://community.akamai.steamstatic.com',
  ];

  return hosts.map((host) =>
    host === ''
      ? `/steam-img/economy/image/${hash}/${dim}`
      : `${host}/economy/image/${hash}/${dim}`,
  );
}
