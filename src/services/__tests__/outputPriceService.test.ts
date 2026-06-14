import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SkinItem } from '../../models/types';
import { resolveOutputPrice, clearOutputPriceCache } from '../outputPriceService';
import { marketService } from '../marketService';
import { priceService } from '../priceService';

vi.mock('../marketService', () => ({
  marketService: {
    getBestListings: vi.fn(),
  },
}));

vi.mock('../priceService', () => ({
  priceService: {
    getOutputPriceSync: vi.fn(() => 100),
    getPriceSync: vi.fn(() => 0),
    getFallbackPrice: vi.fn(() => 80),
  },
}));

const sampleItem: SkinItem = {
  id: 'skin-1',
  name: 'AK-47 | Redline',
  weapon: 'AK-47',
  collectionId: 'col-1',
  rarity: 'classified',
  minFloat: 0.1,
  maxFloat: 0.7,
  stattrak: false,
};

describe('resolveOutputPrice', () => {
  beforeEach(() => {
    clearOutputPriceCache();
    vi.clearAllMocks();
  });

  it('usa listing exata quando float está dentro da tolerância', async () => {
    vi.mocked(marketService.getBestListings).mockResolvedValue([
      {
        id: '1',
        itemId: 'skin-1',
        marketHashName: 'AK-47 | Redline (Field-Tested)',
        marketplace: 'csfloat',
        price: 45,
        currency: 'BRL',
        float: 0.251,
        wear: 'Field-Tested',
        stattrak: false,
      },
    ]);

    const result = await resolveOutputPrice(sampleItem, 0.252, 'csfloat');

    expect(result.source).toBe('listing_exact');
    expect(result.price).toBe(45);
    expect(result.floatAvailable).toBe(true);
    expect(result.marketVerified).toBe(true);
  });

  it('usa listing comparável quando float esperado é melhor que o mercado', async () => {
    vi.mocked(marketService.getBestListings).mockResolvedValue([
      {
        id: '1',
        itemId: 'skin-1',
        marketHashName: 'AK-47 | Redline (Field-Tested)',
        marketplace: 'csfloat',
        price: 38,
        currency: 'BRL',
        float: 0.31,
        wear: 'Field-Tested',
        stattrak: false,
      },
    ]);

    const result = await resolveOutputPrice(sampleItem, 0.28, 'csfloat');

    expect(result.source).toBe('listing_comparable');
    expect(result.price).toBe(38);
    expect(result.floatAvailable).toBe(true);
  });

  it('aplica desconto quando só existem floats melhores que o esperado', async () => {
    vi.mocked(marketService.getBestListings).mockResolvedValue([
      {
        id: '1',
        itemId: 'skin-1',
        marketHashName: 'AK-47 | Redline (Field-Tested)',
        marketplace: 'csfloat',
        price: 50,
        currency: 'BRL',
        float: 0.18,
        wear: 'Field-Tested',
        stattrak: false,
      },
    ]);

    const result = await resolveOutputPrice(sampleItem, 0.25, 'csfloat');

    expect(result.source).toBe('wear_tier');
    expect(result.floatAvailable).toBe(false);
    expect(result.price).toBe(46);
  });

  it('usa fallback conservador sem listings', async () => {
    vi.mocked(marketService.getBestListings).mockResolvedValue([]);
    vi.mocked(priceService.getPriceSync).mockReturnValue(0);
    vi.mocked(priceService.getFallbackPrice).mockReturnValue(80);

    const result = await resolveOutputPrice(sampleItem, 0.25, 'csfloat');

    expect(result.source).toBe('fallback');
    expect(result.floatAvailable).toBe(false);
    expect(result.price).toBe(68);
  });
});
