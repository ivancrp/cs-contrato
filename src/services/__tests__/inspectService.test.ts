import { describe, it, expect } from 'vitest';
import { generate } from '@vlydev/cs2-masked-inspect-ts';
import {
  getBuffSearchUrl,
  getCSFloatSearchUrl,
  getMarketplaceLabel,
  getMarketplaceSearchUrl,
  getSkinportSearchUrl,
  getSteamMarketUrl,
} from '../inspectService';

describe('inspect link generation', () => {
  it('gera link steam:// válido para AK-47', () => {
    const url = generate(7, 474, 306, 0.15, { rarity: 6, quality: 0 });
    expect(url).toContain('steam://rungame/730/');
    expect(url).toContain('csgo_econ_action_preview');
  });

  it('gera link com quality StatTrak', () => {
    const url = generate(7, 474, 100, 0.07, { rarity: 6, quality: 9 });
    expect(url.startsWith('steam://')).toBe(true);
  });
});

describe('marketplace search urls', () => {
  const params = {
    skinName: 'AK-47 | Redline',
    stattrak: false,
    float: 0.18,
    wear: 'Field-Tested',
  };

  it('gera URL do Steam Market com wear', () => {
    const url = getSteamMarketUrl(params);
    expect(url).toContain('steamcommunity.com/market/listings/730/');
    expect(url).toContain('Field-Tested');
  });

  it('gera URL do CSFloat com max_float', () => {
    const url = getCSFloatSearchUrl(params);
    expect(url).toContain('csfloat.com/search');
    expect(url).toContain('max_float=0.18');
  });

  it('gera URL do Skinport e Buff', () => {
    expect(getSkinportSearchUrl(params)).toContain('skinport.com/market?search=');
    expect(getBuffSearchUrl(params)).toContain('buff.163.com/market/csgo');
  });

  it('resolve marketplace da listing', () => {
    expect(getMarketplaceLabel('csfloat')).toBe('CSFloat');
    expect(getMarketplaceSearchUrl(params, 'skinport')).toContain('skinport.com');
    expect(getMarketplaceSearchUrl(params, 'all')).toContain('csfloat.com');
  });
});
