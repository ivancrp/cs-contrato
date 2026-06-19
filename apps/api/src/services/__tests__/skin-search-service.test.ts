import { describe, expect, it } from 'vitest';
import type { SkinItem } from '@ct/types';
import { searchSkins } from '../skin-search-service.js';

function akSkin(name: string, id: string): SkinItem {
  return {
    id,
    name: `AK-47 | ${name}`,
    weapon: 'AK-47',
    collectionId: 'c1',
    rarity: 'classified',
    minFloat: 0,
    maxFloat: 1,
    stattrak: false,
  };
}

const sample: SkinItem[] = [
  akSkin('Hydroponic', 'ak-hydro'),
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
    const { results } = searchSkins(sample, 'M4A1-S', { stattrak: false, limit: 12 });
    expect(results.every((s) => s.weapon === 'M4A1-S')).toBe(true);
    expect(results.some((s) => s.name.includes('AK-47'))).toBe(false);
  });

  it('retorna AK-47 para query ak', () => {
    const { results } = searchSkins(sample, 'ak', { stattrak: false, limit: 12 });
    expect(results[0]?.weapon).toBe('AK-47');
  });

  it('retorna todas as AK-47 quando busca pela arma', () => {
    const manyAk = Array.from({ length: 20 }, (_, index) =>
      akSkin(`Skin ${index + 1}`, `ak-${index}`),
    );
    const { results, total } = searchSkins(manyAk, 'AK-47', { stattrak: false, limit: 100 });
    expect(total).toBe(20);
    expect(results).toHaveLength(20);
  });
});
