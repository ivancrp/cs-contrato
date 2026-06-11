import { describe, it, expect } from 'vitest';
import { generate } from '@vlydev/cs2-masked-inspect-ts';

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
