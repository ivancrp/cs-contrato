import { describe, it, expect } from 'vitest';
import { findSkinByName, getAllSkins } from '../../data/collections';

describe('catalog', () => {
  it('Nova | Dark Sigil (Kilowatt) é Mil-Spec, não Restricted', () => {
    const skin = findSkinByName('Nova | Dark Sigil', true);
    expect(skin).toBeDefined();
    expect(skin?.collectionId).toBe('kilowatt');
    expect(skin?.rarity).toBe('mil-spec');
  });

  it('MAC-10 | Ensnared (Dreams & Nightmares) é Mil-Spec, não Restricted', () => {
    const skin = findSkinByName('MAC-10 | Ensnared', false);
    expect(skin).toBeDefined();
    expect(skin?.collectionId).toBe('dreams-nightmares');
    expect(skin?.rarity).toBe('mil-spec');
  });

  it('não duplica Nova | Dark Sigil na Revolution', () => {
    const matches = getAllSkins().filter(
      (skin) => skin.name === 'Nova | Dark Sigil' && skin.stattrak,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.collectionId).toBe('kilowatt');
  });
});
