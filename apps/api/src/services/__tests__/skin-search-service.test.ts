import { describe, expect, it } from 'vitest';
import type { SkinItem } from '@ct/types';
import { searchSkins } from '../skin-search-service.js';

const sample: SkinItem[] = [
  {
    id: 'ak-hydro',
    name: 'AK-47 | Hydroponic',
    weapon: 'AK-47',
    collectionId: 'c1',
    rarity: 'classified',
    minFloat: 0,
    maxFloat: 1,
    stattrak: false,
  },
  {
    id: 'm4-nightmare',
    name: 'M4A1-S | Nightmare',
    weapon: 'M4A1-S',
    collectionId: 'c2',
    rarity: 'classified',
    minFloat: 0,
    maxFloat: 1,
    stattrak: false,
  },
  {
    id: 'm4-print',
    name: 'M4A1-S | Printstream',
    weapon: 'M4A1-S',
    collectionId: 'c3',
    rarity: 'covert',
    minFloat: 0,
    maxFloat: 1,
    stattrak: false,
  },
];

describe('searchSkins', () => {
  it('retorna skins M4A1-S para query M4A1-S', () => {
    const results = searchSkins(sample, 'M4A1-S', { stattrak: false, limit: 12 });
    expect(results.every((s) => s.weapon === 'M4A1-S')).toBe(true);
    expect(results.some((s) => s.name.includes('AK-47'))).toBe(false);
  });

  it('retorna AK-47 para query ak', () => {
    const results = searchSkins(sample, 'ak', { stattrak: false, limit: 12 });
    expect(results[0]?.weapon).toBe('AK-47');
  });
});
