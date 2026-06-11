import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeSkinName } from '../../utils/format';

describe('skin image aliases', () => {
  it('mapeia SCAR-20 Fracture para Fragments', () => {
    const aliases: Record<string, string> = {
      'scar-20 | fracture': 'SCAR-20 | Fragments',
    };
    const key = normalizeSkinName('SCAR-20 | Fracture');
    expect(aliases[key]).toBe('SCAR-20 | Fragments');
  });
});

describe('SKIN_IMAGE_MAP', () => {
  beforeEach(() => {
    // static map includes Fragments
  });

  it('contém URL para SCAR-20 | Fragments', async () => {
    const { SKIN_IMAGE_MAP } = await import('../../data/skinImages');
    expect(SKIN_IMAGE_MAP['SCAR-20 | Fragments']).toContain('steamstatic.com');
    expect(SKIN_IMAGE_MAP['SCAR-20 | Fracture']).toBe(SKIN_IMAGE_MAP['SCAR-20 | Fragments']);
  });
});
