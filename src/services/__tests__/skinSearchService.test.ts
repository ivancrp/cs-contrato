import { describe, it, expect } from 'vitest';
import { findSkinByName, getAllSkins } from '../../data/collections';
import { resolveTargetSkin } from '../../contracts/contractBuilder';
import { canBeTradeUpTarget } from '../../math/contractRules';
import { skinSearchService } from '../../services/skinSearchService';

describe('skinSearchService', () => {
  it('encontra M4A1-S | Black Lotus na busca da API', async () => {
    const results = await skinSearchService.search('Black Lotus', false);
    const match = results.find((skin) => skin.name === 'M4A1-S | Black Lotus');
    expect(match).toBeDefined();
    expect(match?.rarity).toBe('classified');
    expect(match?.collectionName).toContain('Kilowatt');
  });

  it('exclui skins sem raridade inferior para trade up', async () => {
    const catalog = getAllSkins();
    const consumerSkin = catalog.find((skin) => skin.rarity === 'consumer' && !skin.souvenir);
    expect(consumerSkin).toBeDefined();
    expect(canBeTradeUpTarget(consumerSkin!, catalog)).toBe(false);

    const results = await skinSearchService.search('', false, 200);
    expect(results.every((skin) => canBeTradeUpTarget(skin, catalog))).toBe(true);
    expect(results.some((skin) => skin.rarity === 'consumer')).toBe(false);
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
