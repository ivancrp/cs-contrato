import { describe, it, expect, beforeEach } from 'vitest';
import { findSkinByName, getAllSkins } from '../../data/collections';
import { resolveTargetSkin } from '../../contracts/contractBuilder';
import { canBeTradeUpTarget } from '../../math/contractRules';
import { skinSearchService } from '../../services/skinSearchService';

describe('skinSearchService', () => {
  beforeEach(() => {
    skinSearchService.invalidateIndex();
  });

  it('encontra M4A1-S | Black Lotus na busca da API', async () => {
    const results = await skinSearchService.search('Black Lotus', false);
    const match = results.find((skin) => skin.name === 'M4A1-S | Black Lotus');
    expect(match).toBeDefined();
    expect(match?.rarity).toBe('classified');
    expect(match?.collectionName).toContain('Kilowatt');
  });

  it('exclui skins sem raridade inferior para trade up', async () => {
    const consumerSkin = getAllSkins().find((skin) => skin.rarity === 'consumer' && !skin.souvenir);
    expect(consumerSkin).toBeDefined();

    const results = await skinSearchService.search('', false, 200);
    const catalog = getAllSkins();
    expect(canBeTradeUpTarget(consumerSkin!, catalog)).toBe(false);
    expect(results.every((skin) => canBeTradeUpTarget(skin, catalog))).toBe(true);
    expect(results.some((skin) => skin.rarity === 'consumer')).toBe(false);
  });

  it('índice cacheado retorna os mesmos alvos válidos que canBeTradeUpTarget', () => {
    const catalog = getAllSkins();
    skinSearchService.warmIndex();

    const fromIndex = skinSearchService.searchSync('', false, catalog.length);
    const expectedIds = new Set(
      catalog.filter((skin) => !skin.stattrak && canBeTradeUpTarget(skin, catalog)).map((s) => s.id),
    );
    const fromIndexIds = new Set(fromIndex.map((skin) => skin.id));

    expect(fromIndexIds).toEqual(expectedIds);
  });

  it('resolveTargetSkin usa targetSkinId quando informado', () => {
    const skin = findSkinByName('M4A1-S | Black Lotus', false);
    expect(skin).toBeDefined();

    const resolved = resolveTargetSkin({
      skinName: 'USP-S | Black Lotus',
      targetSkinId: skin!.id,
      stattrak: false,
      wear: 'Factory New',
      maxFloat: 0.07,
      budget: 100,
      marketplace: 'all',
      mode: 'balanced',
    });

    expect(resolved.id).toBe(skin!.id);
    expect(resolved.name).toBe('M4A1-S | Black Lotus');
  });
});
