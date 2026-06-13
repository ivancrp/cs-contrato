import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWearTiersInRange } from '../../math/wear';
import { fetchCSFloatListings } from '../csfloatApi';

describe('getWearTiersInRange', () => {
  it('retorna wears que intersectam o intervalo de float', () => {
    expect(getWearTiersInRange(0.1, 0.2)).toEqual(['Minimal Wear', 'Field-Tested']);
    expect(getWearTiersInRange(0, 0.069)).toEqual(['Factory New']);
  });
});

describe('fetchCSFloatListings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mapeia listings da API CSFloat para MarketListing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'abc123',
              price: 1500,
              item: {
                asset_id: 'asset-1',
                float_value: 0.18,
                market_hash_name: 'AK-47 | Redline (Field-Tested)',
              },
            },
          ],
        }),
      }),
    );

    const listings = await fetchCSFloatListings(
      'AK-47 | Redline (Field-Tested)',
      0.38,
      0.15,
    );

    expect(listings).toHaveLength(1);
    expect(listings[0]?.marketplace).toBe('csfloat');
    expect(listings[0]?.float).toBe(0.18);
    expect(listings[0]?.price).toBeCloseTo(82.5);
    expect(listings[0]?.id).toBe('csfloat-abc123');
  });

  it('filtra floats fora do intervalo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'x1',
              price: 1000,
              item: {
                asset_id: 'a1',
                float_value: 0.5,
                market_hash_name: 'AK-47 | Redline (Battle-Scarred)',
              },
            },
          ],
        }),
      }),
    );

    const listings = await fetchCSFloatListings(
      'AK-47 | Redline (Battle-Scarred)',
      0.38,
      0.15,
    );

    expect(listings).toHaveLength(0);
  });
});
