import { describe, it, expect } from 'vitest';
import { findSkinByName } from '../../data/collections';
import { validateContractInputs, CONTRACT_INPUT_SIZE } from '../contractRules';
import type { ContractInput, SkinItem } from '../../models/types';

function requireSkin(name: string, stattrak: boolean): SkinItem {
  const skin = findSkinByName(name, stattrak);
  if (!skin) throw new Error(`Skin não encontrada no catálogo: ${name} (ST=${stattrak})`);
  return skin;
}

function makeInput(item: SkinItem, overrides?: Partial<SkinItem>): ContractInput {
  const resolved = { ...item, ...overrides };
  return {
    listing: {
      id: `${resolved.id}-listing`,
      itemId: resolved.id,
      marketHashName: resolved.name,
      marketplace: 'csfloat',
      price: 10,
      currency: 'BRL',
      float: 0.05,
      wear: 'Factory New',
      stattrak: resolved.stattrak,
    },
    item: resolved,
  };
}

describe('validateContractInputs', () => {
  const target = requireSkin('M4A1-S | Black Lotus', true);
  const restrictedInput = requireSkin('M4A4 | Etch Lord', true);
  const milSpecInput = requireSkin('Nova | Dark Sigil', true);

  it('aceita 10 entradas da mesma raridade exigida', () => {
    const inputs = Array.from({ length: CONTRACT_INPUT_SIZE }, () =>
      makeInput(restrictedInput),
    );

    expect(validateContractInputs(inputs, target)).toEqual({ valid: true });
  });

  it('rejeita entradas com raridades misturadas', () => {
    const inputs = [
      ...Array.from({ length: 5 }, () => makeInput(restrictedInput)),
      ...Array.from({ length: 5 }, () => makeInput(milSpecInput)),
    ];

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('mesma raridade');
  });

  it('rejeita entradas com raridade acima do tier exigido', () => {
    const inputs = Array.from({ length: CONTRACT_INPUT_SIZE }, () => makeInput(target));

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('restricted');
  });

  it('rejeita entradas normais quando a saída alvo é StatTrak', () => {
    const normalInput = requireSkin('M4A4 | Etch Lord', false);
    const inputs = [
      ...Array.from({ length: 5 }, () => makeInput(restrictedInput)),
      ...Array.from({ length: 5 }, () => makeInput(normalInput)),
    ];

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('StatTrak');
  });

  it('rejeita entradas StatTrak quando a saída alvo é normal', () => {
    const normalTarget = requireSkin('M4A1-S | Black Lotus', false);
    const inputs = Array.from({ length: CONTRACT_INPUT_SIZE }, () =>
      makeInput(restrictedInput),
    );

    const result = validateContractInputs(inputs, normalTarget);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('sem StatTrak');
  });

  it('rejeita contrato com quantidade diferente de 10', () => {
    const inputs = Array.from({ length: 9 }, () => makeInput(restrictedInput));

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('10');
  });

  it('rejeita entradas Souvenir', () => {
    const inputs = Array.from({ length: CONTRACT_INPUT_SIZE }, () =>
      makeInput(restrictedInput, { souvenir: true }),
    );

    const result = validateContractInputs(inputs, target);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Souvenir');
  });
});
