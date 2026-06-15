import { getRarityByOffset } from '@ct/common';
import type {
  Collection,
  ContractInput,
  ContractRule,
  ContractValidationResult,
  SkinItem,
} from '@ct/types';

function isSouvenirInput(input: ContractInput): boolean {
  return !!(input.item.souvenir || input.listing.souvenir);
}

function collectionHasOutput(
  collection: Collection,
  outputRarity: SkinItem['rarity'],
  stattrak: boolean,
  souvenir: boolean,
): boolean {
  return collection.items.some(
    (item) =>
      item.rarity === outputRarity &&
      item.stattrak === stattrak &&
      !!item.souvenir === souvenir,
  );
}

/**
 * Valida entradas contra uma ContractRule configurável.
 * A engine nunca assume inputCount fixo — sempre lê de rule.inputCount.
 */
export function validateContractInputs(
  inputs: ContractInput[],
  targetSkin: SkinItem,
  rule: ContractRule,
  collections: Collection[],
): ContractValidationResult {
  const base = { ruleId: rule.id };

  if (inputs.length !== rule.inputCount) {
    return {
      ...base,
      valid: false,
      reason: `Contrato exige ${rule.inputCount} entradas, recebeu ${inputs.length}.`,
    };
  }

  if (rule.outputRules.matchSouvenir) {
    const souvenirValues = new Set(inputs.map(isSouvenirInput));
    if (souvenirValues.size !== 1) {
      return { ...base, valid: false, reason: 'Todas as entradas devem ser Souvenir ou todas normais.' };
    }
    const [inputSouvenir] = [...souvenirValues];
    if (inputSouvenir !== !!targetSkin.souvenir) {
      return {
        ...base,
        valid: false,
        reason: targetSkin.souvenir
          ? 'Saída Souvenir exige entradas Souvenir.'
          : 'Saída normal exige entradas sem Souvenir.',
      };
    }
  }

  const requiredRarity =
    rule.rarityRules.requiredInputRarity ??
    getRarityByOffset(targetSkin.rarity, rule.rarityRules.inputTierOffset);

  if (!requiredRarity) {
    return { ...base, valid: false, reason: `Skin alvo (${targetSkin.rarity}) não possui trade up válido.` };
  }

  if (rule.rarityRules.uniformInputRarity) {
    const rarities = new Set(inputs.map((input) => input.item.rarity));
    if (rarities.size !== 1) {
      return { ...base, valid: false, reason: 'Todas as entradas devem ter a mesma raridade.' };
    }
    const [inputRarity] = [...rarities];
    if (inputRarity !== requiredRarity) {
      return {
        ...base,
        valid: false,
        reason: `Entradas devem ser ${requiredRarity}, não ${inputRarity}.`,
      };
    }
  }

  if (rule.outputRules.matchStatTrak) {
    const stValues = new Set(inputs.map((input) => input.item.stattrak));
    if (stValues.size !== 1) {
      return { ...base, valid: false, reason: 'Todas as entradas devem ser StatTrak ou todas normais.' };
    }
    const [inputSt] = [...stValues];
    if (inputSt !== targetSkin.stattrak) {
      return {
        ...base,
        valid: false,
        reason: targetSkin.stattrak
          ? 'Saída StatTrak exige entradas StatTrak.'
          : 'Saída normal exige entradas sem StatTrak.',
      };
    }
  }

  const blocked = new Set(rule.collectionRules.blockedCollectionIds);
  const collectionMap = new Map(collections.map((c) => [c.id, c]));
  const collectionIds = new Set(inputs.map((input) => input.item.collectionId));

  for (const collectionId of collectionIds) {
    if (blocked.has(collectionId)) {
      const collection = collectionMap.get(collectionId);
      return {
        ...base,
        valid: false,
        reason: `Coleção "${collection?.name ?? collectionId}" não é elegível para este contrato.`,
      };
    }

    if (rule.collectionRules.requireOutputInSameCollection) {
      const collection = collectionMap.get(collectionId);
      if (collection && !collectionHasOutput(
        collection,
        targetSkin.rarity,
        targetSkin.stattrak,
        !!targetSkin.souvenir,
      )) {
        return {
          ...base,
          valid: false,
          reason: `Coleção "${collection.name}" não possui saída ${targetSkin.rarity}.`,
        };
      }
    }
  }

  return { ...base, valid: true };
}

export function assertValidContractInputs(
  inputs: ContractInput[],
  targetSkin: SkinItem,
  rule: ContractRule,
  collections: Collection[],
): void {
  const result = validateContractInputs(inputs, targetSkin, rule, collections);
  if (!result.valid) {
    throw new Error(result.reason ?? 'Contrato inválido.');
  }
}
