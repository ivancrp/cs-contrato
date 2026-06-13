import { describe, it, expect } from 'vitest';
import { findSkinByName, getAllSkins } from '../../data/collections';
import {
  estimateAutoBudget,
  resolveSearchDefaults,
  resolveTargetSkin,
} from '../contractBuilder';
import { findInputCandidates } from '../tradeUpCalculator';
import type { CandidateListing } from '../../algorithms/types';

describe('resolveTargetSkin', () => {
  it('resolve por targetSkinId com prioridade sobre skinName', () => {
    const skin = findSkinByName('M4A1-S | Black Lotus', false);
    expect(skin).toBeDefined();

    const resolved = resolveTargetSkin({
      skinName: 'USP-S | Black Lotus',
      targetSkinId: skin!.id,
      stattrak: false,
      wear: 'Factory New',
      marketplace: 'all',
    });

    expect(resolved.id).toBe(skin!.id);
    expect(resolved.name).toBe('M4A1-S | Black Lotus');
  });
});

describe('resolveSearchDefaults', () => {
  it('deriva float e modo automaticamente', () => {
    const resolved = resolveSearchDefaults({
      skinName: 'M4A1-S | Black Lotus',
      stattrak: true,
      wear: 'Field-Tested',
      marketplace: 'all',
    });

    expect(resolved.maxFloat).toBe(0.38);
    expect(resolved.mode).toBe('balanced');
    expect(resolved.budget).toBe(500);
  });

  it('estima orçamento a partir do pool de candidatos', () => {
    const candidates: CandidateListing[] = Array.from({ length: 12 }, (_, index) => ({
      listingId: `item-${index}`,
      itemId: `skin-${index}`,
      collectionId: 'col-1',
      rarity: 'restricted',
      stattrak: true,
      price: 10 + index,
      float: 0.15,
      normalizedFloat: 0.15,
      floatFitScore: 0.08,
      isTargetCollection: index < 4,
      marketVerified: true,
    }));

    expect(estimateAutoBudget(candidates)).toBeGreaterThan(100);
  });
});

describe('findInputCandidates', () => {
  it('exclui skins de coleção sem tier superior para a alvo', () => {
    const searingRage = findSkinByName('AK-47 | Searing Rage', false);
    const amberFade = findSkinByName('R8 Revolver | Amber Fade', false);
    expect(searingRage).toBeDefined();
    expect(amberFade).toBeDefined();

    const covertTarget = getAllSkins().find(
      (skin) =>
        skin.rarity === 'covert' &&
        !skin.stattrak &&
        skin.collectionId === searingRage!.collectionId,
    );
    expect(covertTarget).toBeDefined();

    const candidates = findInputCandidates(covertTarget!, 0.38);
    const candidateIds = new Set(candidates.map((skin) => skin.id));

    expect(candidateIds.has(searingRage!.id)).toBe(true);
    expect(candidateIds.has(amberFade!.id)).toBe(false);
  });

  it('exclui skins de coleções limitadas para M4A1-S Fade', () => {
    const fade = findSkinByName('M4A1-S | Fade', false);
    const knight = findSkinByName('M4A1-S | Knight', false);
    expect(fade).toBeDefined();
    expect(knight).toBeDefined();

    const candidates = findInputCandidates(fade!, 0.07);
    const candidateIds = new Set(candidates.map((skin) => skin.id));

    expect(candidateIds.has(knight!.id)).toBe(false);
  });
});
