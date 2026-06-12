import { getCollections } from '../data/collections';
import { isTradeUpEligibleInputCollection } from '../data/tradeUpCollections';
import type { ContractInput, Rarity, SkinItem } from '../models/types';
import { collectionHasTradeUpOutput, getInputRarityForTarget, isValidTradeUpInput } from './probability';

export const CONTRACT_INPUT_SIZE = 10;

export interface ContractValidationResult {
  valid: boolean;
  reason?: string;
}

function isSouvenirInput(input: ContractInput): boolean {
  return !!(input.item.souvenir || input.listing.souvenir);
}

/**
 * Valida regras oficiais de entrada do contrato CS2:
 * - exatamente 10 skins
 * - mesma raridade entre todas
 * - raridade um tier abaixo da skin alvo
 * - mesma versão StatTrak
 * - mesma versão Souvenir (todas Souvenir ou todas normais)
 * - cada coleção das entradas deve ter saída no tier alvo
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

  const souvenirValues = new Set(inputs.map(isSouvenirInput));
  if (souvenirValues.size !== 1) {
    return {
      valid: false,
      reason: 'Todas as entradas devem ser Souvenir ou todas normais.',
    };
  }

  const [inputSouvenir] = [...souvenirValues];
  if (inputSouvenir !== !!targetSkin.souvenir) {
    return {
      valid: false,
      reason: targetSkin.souvenir
        ? 'Saída Souvenir exige 10 entradas Souvenir.'
        : 'Saída normal exige 10 entradas sem Souvenir.',
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

  const collections = getCollections();
  const targetCollectionIds = new Set(
    collections
      .filter((collection) => collection.items.some((item) => item.id === targetSkin.id))
      .map((collection) => collection.id),
  );
  const collectionIds = new Set(inputs.map((input) => input.item.collectionId));
  for (const collectionId of collectionIds) {
    const collection = collections.find((entry) => entry.id === collectionId);
    if (!collection) continue;

    if (!isTradeUpEligibleInputCollection(collectionId, targetCollectionIds)) {
      return {
        valid: false,
        reason: `Coleção "${collection.name}" é limitada e não pode ser usada em trade up.`,
      };
    }

    if (
      !collectionHasTradeUpOutput(
        collection,
        targetSkin.rarity,
        targetSkin.stattrak,
        !!targetSkin.souvenir,
      )
    ) {
      return {
        valid: false,
        reason: `Coleção "${collection.name}" não possui saída ${targetSkin.rarity} para trade up.`,
      };
    }
  }

  if (inputs.some((input) => !isValidTradeUpInput(input.item, targetSkin, collections))) {
    return {
      valid: false,
      reason: 'Uma ou mais entradas pertencem a coleção sem tier superior válido.',
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

/** Skin alvo válida: possui entradas no tier inferior com trade up real na coleção. */
export function canBeTradeUpTarget(skin: SkinItem, inputPool: SkinItem[]): boolean {
  const requiredInputRarity = getInputRarityForTarget(skin.rarity);
  if (!requiredInputRarity) return false;

  const collections = getCollections();
  return inputPool.some(
    (item) =>
      item.rarity === requiredInputRarity &&
      item.stattrak === skin.stattrak &&
      !!item.souvenir === !!skin.souvenir &&
      isValidTradeUpInput(item, skin, collections),
  );
}

export function isSouvenirItem(item: SkinItem): boolean {
  return !!item.souvenir;
}
