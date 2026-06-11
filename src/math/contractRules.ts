import type { ContractInput, Rarity, SkinItem } from '../models/types';
import { getInputRarityForTarget } from './probability';

export const CONTRACT_INPUT_SIZE = 10;

export interface ContractValidationResult {
  valid: boolean;
  reason?: string;
}

function hasSouvenir(input: ContractInput): boolean {
  return !!(input.item.souvenir || input.listing.souvenir);
}

/**
 * Valida regras oficiais de entrada do contrato CS2:
 * - exatamente 10 skins
 * - mesma raridade entre todas
 * - raridade um tier abaixo da skin alvo
 * - mesma versão StatTrak
 * - sem Souvenir
 */
export function validateContractInputs(
  inputs: ContractInput[],
  targetSkin: SkinItem,
): ContractValidationResult {
  if (inputs.length !== CONTRACT_INPUT_SIZE) {
    return {
      valid: false,
      reason: `Contrato exige ${CONTRACT_INPUT_SIZE} entradas, recebeu ${inputs.length}.`,
    };
  }

  if (inputs.some(hasSouvenir)) {
    return {
      valid: false,
      reason: 'Souvenir não pode ser utilizado em Trade Up.',
    };
  }

  const requiredRarity = getInputRarityForTarget(targetSkin.rarity);
  if (!requiredRarity) {
    return {
      valid: false,
      reason: `Skin alvo (${targetSkin.rarity}) não possui trade up válido.`,
    };
  }

  const rarities = new Set(inputs.map((input) => input.item.rarity));
  if (rarities.size !== 1) {
    return {
      valid: false,
      reason: 'Todas as entradas devem ter a mesma raridade.',
    };
  }

  const [inputRarity] = [...rarities];
  if (inputRarity !== requiredRarity) {
    return {
      valid: false,
      reason: `Entradas devem ser ${requiredRarity}, não ${inputRarity}.`,
    };
  }

  const stattrakValues = new Set(inputs.map((input) => input.item.stattrak));
  if (stattrakValues.size !== 1) {
    return {
      valid: false,
      reason: 'Todas as entradas devem ser StatTrak ou todas normais.',
    };
  }

  const [inputStatTrak] = [...stattrakValues];
  if (inputStatTrak !== targetSkin.stattrak) {
    return {
      valid: false,
      reason: targetSkin.stattrak
        ? 'Saída StatTrak exige 10 entradas StatTrak.'
        : 'Saída normal exige 10 entradas sem StatTrak.',
    };
  }

  if (inputs.some((input) => input.listing.stattrak !== input.item.stattrak)) {
    return {
      valid: false,
      reason: 'Listagem de mercado inconsistente com a versão StatTrak da skin.',
    };
  }

  return { valid: true };
}

export function assertValidContractInputs(
  inputs: ContractInput[],
  targetSkin: SkinItem,
): void {
  const result = validateContractInputs(inputs, targetSkin);
  if (!result.valid) {
    throw new Error(result.reason ?? 'Contrato inválido.');
  }
}

export function getRequiredInputRarity(targetSkin: SkinItem): Rarity | null {
  return getInputRarityForTarget(targetSkin.rarity);
}

/** Skin alvo válida: possui raridade inferior com entradas disponíveis no catálogo. */
export function canBeTradeUpTarget(skin: SkinItem, inputPool: SkinItem[]): boolean {
  if (skin.souvenir) return false;

  const requiredInputRarity = getInputRarityForTarget(skin.rarity);
  if (!requiredInputRarity) return false;

  return inputPool.some(
    (item) =>
      !item.souvenir &&
      item.rarity === requiredInputRarity &&
      item.stattrak === skin.stattrak,
  );
}

export function isSouvenirItem(item: SkinItem): boolean {
  return !!item.souvenir;
}
