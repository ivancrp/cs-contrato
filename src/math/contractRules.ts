import type { ContractInput, Rarity, SkinItem } from '../models/types';
import { getInputRarityForTarget } from './probability';

export const CONTRACT_INPUT_SIZE = 10;

export interface ContractValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Valida regras oficiais de entrada do contrato CS2:
 * - exatamente 10 skins
 * - mesma raridade entre todas
 * - raridade um tier abaixo da skin alvo
 * - mesma versão StatTrak
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

  const stattrakMismatch = inputs.some((input) => input.item.stattrak !== targetSkin.stattrak);
  if (stattrakMismatch) {
    return {
      valid: false,
      reason: 'Entradas devem ter a mesma versão StatTrak da skin alvo.',
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
