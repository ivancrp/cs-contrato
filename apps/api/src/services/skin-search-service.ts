import type { SkinItem } from '@ct/types';

export interface SearchSkinsResult {
  results: SkinItem[];
  total: number;
}

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesWeaponQuery(weapon: string, query: string): boolean {
  const normalizedQuery = normalizeToken(query);
  if (!normalizedQuery) return false;

  const normalizedWeapon = normalizeToken(weapon);
  return (
    normalizedWeapon === normalizedQuery ||
    normalizedWeapon.startsWith(normalizedQuery) ||
    normalizedQuery.startsWith(normalizedWeapon)
  );
}

function dedupeSkins(skins: SkinItem[]): SkinItem[] {
  const seen = new Set<string>();
  const unique: SkinItem[] = [];

  for (const skin of skins) {
    const key = `${skin.name}|${skin.stattrak}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(skin);
  }

  return unique;
}

function scoreSkin(skin: SkinItem, q: string): number {
  const name = skin.name.toLowerCase();
  const weapon = skin.weapon.toLowerCase();

  if (name === q || weapon === q) return 100;
  if (name.startsWith(q) || weapon.startsWith(q)) return 90;
  if (name.includes(q)) return 75;
  if (weapon.includes(q)) return 60;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => name.includes(t) || weapon.includes(t))) {
    return 50;
  }

  return 0;
}

export function searchSkins(
  skins: SkinItem[],
  query: string,
  options: { stattrak?: boolean; limit?: number } = {},
): SearchSkinsResult {
  const q = normalizeQuery(query);
  if (q.length < 2) return { results: [], total: 0 };

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  let pool = skins;

  if (options.stattrak !== undefined) {
    pool = pool.filter((skin) => skin.stattrak === options.stattrak);
  }

  const weaponMatches = dedupeSkins(
    pool
      .filter((skin) => matchesWeaponQuery(skin.weapon, q))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  if (!q.includes('|') && weaponMatches.length > 0) {
    return {
      results: weaponMatches.slice(0, limit),
      total: weaponMatches.length,
    };
  }

  const ranked: Array<{ skin: SkinItem; score: number }> = [];

  for (const skin of pool) {
    const score = scoreSkin(skin, q);
    if (score <= 0) continue;
    ranked.push({ skin, score });
  }

  const sorted = dedupeSkins(
    ranked
      .sort((a, b) => b.score - a.score || a.skin.name.localeCompare(b.skin.name))
      .map((entry) => entry.skin),
  );

  return {
    results: sorted.slice(0, limit),
    total: sorted.length,
  };
}
