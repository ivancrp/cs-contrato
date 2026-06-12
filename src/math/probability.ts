import { isTradeUpEligibleInputCollection } from '../data/tradeUpCollections';
import type { Collection, ContractInput, ContractOutput, Rarity, SkinItem } from '../models/types';
import { getNextRarity } from '../utils/rarity';
import { calculateExpectedFloatForOutput } from './float';
import { floatToWear } from './wear';
import { CONTRACT_INPUT_SIZE } from './contractRules';

function getTargetCollectionIds(targetSkin: SkinItem, collections: Collection[]): Set<string> {
  return new Set(
    collections
      .filter((collection) => collection.items.some((item) => item.id === targetSkin.id))
      .map((collection) => collection.id),
  );
}

/** Coleção possui skin de saída no tier alvo (ex.: Covert para entradas Classified). */
export function collectionHasTradeUpOutput(
  collection: Collection,
  outputRarity: Rarity,
  stattrak: boolean,
  souvenir = false,
): boolean {
  return collection.items.some(
    (item) =>
      item.rarity === outputRarity &&
      item.stattrak === stattrak &&
      !!item.souvenir === souvenir,
  );
}

/** Entrada válida: mesma versão da alvo e coleção com tier superior disponível. */
export function isValidTradeUpInput(
  item: SkinItem,
  targetSkin: SkinItem,
  collections: Collection[],
): boolean {
  const collection = collections.find((entry) => entry.id === item.collectionId);
  if (!collection) return false;

  const targetCollectionIds = getTargetCollectionIds(targetSkin, collections);
  if (!isTradeUpEligibleInputCollection(item.collectionId, targetCollectionIds)) {
    return false;
  }

  return collectionHasTradeUpOutput(
    collection,
    targetSkin.rarity,
    targetSkin.stattrak,
    !!targetSkin.souvenir,
  );
}

/**
 * Obtém skins de saída possíveis baseado nas coleções das entradas.
 * Regra CS2: cada coleção presente contribui proporcionalmente ao pool de saída.
 */
export function getPossibleOutputs(
  inputs: ContractInput[],
  collections: Collection[],
  outputRarity: Rarity,
  stattrak: boolean,
): SkinItem[] {
  const collectionMap = new Map(collections.map((c) => [c.id, c]));
  const involvedCollections = new Set(inputs.map((i) => i.item.collectionId));
  const outputs: SkinItem[] = [];

  for (const colId of involvedCollections) {
    const collection = collectionMap.get(colId);
    if (!collection) continue;
    const tierItems = collection.items.filter(
      (item) => item.rarity === outputRarity && item.stattrak === stattrak,
    );
    outputs.push(...tierItems);
  }

  return outputs;
}

/**
 * Calcula probabilidade de cada skin de saída.
 *
 * Para cada coleção C com n inputs de 10:
 *   P(saída de C) = n/10
 *   P(skin específica | saída de C) = 1 / |skins tier+1 em C|
 *
 * @param inputs - 10 entradas do contrato
 * @param collections - Catálogo de coleções
 * @param outputRarity - Raridade da skin alvo
 * @param stattrak - Se o output é StatTrak
 */
export function calculateOutputProbabilities(
  inputs: ContractInput[],
  collections: Collection[],
  outputRarity: Rarity,
  stattrak: boolean,
): Map<string, number> {
  const requiredInputRarity = getInputRarityForTarget(outputRarity);
  if (!requiredInputRarity || inputs.length !== CONTRACT_INPUT_SIZE) {
    return new Map();
  }

  const inputRarities = new Set(inputs.map((input) => input.item.rarity));
  if (inputRarities.size !== 1 || !inputRarities.has(requiredInputRarity)) {
    return new Map();
  }

  if (inputs.some((input) => input.item.stattrak !== stattrak)) {
    return new Map();
  }

  const souvenirValues = new Set(inputs.map((input) => !!(input.item.souvenir || input.listing.souvenir)));
  if (souvenirValues.size !== 1) {
    return new Map();
  }

  const [inputSouvenir] = [...souvenirValues];

  const collectionMap = new Map(collections.map((c) => [c.id, c]));
  const collectionCounts = new Map<string, number>();

  for (const input of inputs) {
    const count = collectionCounts.get(input.item.collectionId) ?? 0;
    collectionCounts.set(input.item.collectionId, count + 1);
  }

  const probabilities = new Map<string, number>();
  const totalInputs = inputs.length || 10;

  for (const [colId, count] of collectionCounts) {
    const collection = collectionMap.get(colId);
    if (!collection) continue;

    const outputSkins = collection.items.filter(
      (item) =>
        item.rarity === outputRarity &&
        item.stattrak === stattrak &&
        !!item.souvenir === inputSouvenir,
    );

    if (outputSkins.length === 0) continue;

    const collectionProb = count / totalInputs;
    const perSkinProb = collectionProb / outputSkins.length;

    for (const skin of outputSkins) {
      const existing = probabilities.get(skin.id) ?? 0;
      probabilities.set(skin.id, existing + perSkinProb);
    }
  }

  return probabilities;
}

/**
 * Monta lista de saídas com probabilidades e floats esperados.
 */
export function buildContractOutputs(
  inputs: ContractInput[],
  collections: Collection[],
  outputRarity: Rarity,
  stattrak: boolean,
  targetSkinId: string,
  priceLookup: (itemId: string, expectedFloat: number) => number,
): ContractOutput[] {
  const probabilities = calculateOutputProbabilities(
    inputs,
    collections,
    outputRarity,
    stattrak,
  );
  const collectionMap = new Map(
    collections.flatMap((c) => c.items.map((i) => [i.id, i])),
  );

  const outputs: ContractOutput[] = [];

  for (const [skinId, probability] of probabilities) {
    const item = collectionMap.get(skinId);
    if (!item) continue;

    const expectedFloat = calculateExpectedFloatForOutput(inputs, item);

    outputs.push({
      item,
      probability,
      expectedFloat,
      expectedWear: floatToWear(expectedFloat),
      price: priceLookup(item.id, expectedFloat),
      isTarget: skinId === targetSkinId,
    });
  }

  return outputs.sort((a, b) => b.probability - a.probability);
}

/**
 * Encontra raridade de entrada necessária para uma skin alvo.
 */
export function getInputRarityForTarget(targetRarity: Rarity): Rarity | null {
  return getNextRarity(targetRarity, -1);
}
