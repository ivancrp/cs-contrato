import type { SkinItem } from '@ct/types';

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
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
): SkinItem[] {
  const q = normalizeQuery(query);
  if (q.length < 2) return [];

  const limit = Math.min(Math.max(options.limit ?? 12, 1), 100);
  let pool = skins;

  if (options.stattrak !== undefined) {
    pool = pool.filter((skin) => skin.stattrak === options.stattrak);
  }

  const seen = new Set<string>();
  const ranked: Array<{ skin: SkinItem; score: number }> = [];

  for (const skin of pool) {
    const score = scoreSkin(skin, q);
    if (score <= 0) continue;

    const dedupeKey = `${skin.name}|${skin.stattrak}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    ranked.push({ skin, score });
  }

  return ranked
    .sort((a, b) => b.score - a.score || a.skin.name.localeCompare(b.skin.name))
    .slice(0, limit)
    .map((entry) => entry.skin);
}
