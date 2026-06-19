import { describe, expect, it } from 'vitest';
import {
  defaultWearForSkin,
  getWearTiersForSkin,
  isWearValidForSkin,
  resolveTargetMaxFloat,
} from '../wear-engine.js';

describe('wear-engine skin bounds', () => {
  const fade = { minFloat: 0, maxFloat: 0.08 };

  it('M4A1-S Fade não existe em Field-Tested', () => {
    expect(isWearValidForSkin(fade, 'Field-Tested')).toBe(false);
    expect(getWearTiersForSkin(fade)).toEqual(['Factory New', 'Minimal Wear']);
  });

  it('usa Factory New como wear padrão para Fade', () => {
    expect(defaultWearForSkin(fade)).toBe('Factory New');
  });

  it('limita maxFloat da busca ao wear e ao max da skin', () => {
    expect(resolveTargetMaxFloat(fade, 'Factory New')).toBe(0.07);
    expect(resolveTargetMaxFloat(fade, 'Minimal Wear')).toBe(0.08);
  });
});
