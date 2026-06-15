import { getRarityByOffset } from '@ct/common';
import type {
  Collection,
  ContractInput,
  ContractOutput,
  ContractRule,
  ProbabilityMetadata,
  Rarity,
  SkinItem,
} from '@ct/types';
import { calculateExpectedFloatForOutput } from '../float/float-engine.js';
import { floatToWear } from '../float/wear-engine.js';

/**
 * Probabilidades de saída CS2 — regra proporcional por coleção.
 *
 * Para cada coleção C com n inputs de N:
 *   P(saída de C) = n/N
 *   P(skin específica | saída de C) = 1 / |skins tier alvo em C|
 *
 * Fonte: mecânica documentada pela comunidade/Valve — metadata source: community
 */
export function calculateOutputProbabilities(
  inputs: ContractInput[],
  collections: Collection[],
  outputRarity: Rarity,
  stattrak: boolean,
  rule: ContractRule,
): Map<string, ProbabilityMetadata> {
  const probabilities = new Map<string, ProbabilityMetadata>();

  if (inputs.length !== rule.inputCount) return probabilities;

  const requiredInputRarity = getRarityByOffset(outputRarity, rule.rarityRules.inputTierOffset);
  if (!requiredInputRarity) return probabilities;

  const inputRarities = new Set(inputs.map((input) => input.item.rarity));
  if (rule.rarityRules.uniformInputRarity && (inputRarities.size !== 1 || !inputRarities.has(requiredInputRarity))) {
    return probabilities;
  }

  if (rule.outputRules.matchStatTrak && inputs.some((input) => input.item.stattrak !== stattrak)) {
    return probabilities;
  }

  const souvenirValues = new Set(inputs.map((input) => !!(input.item.souvenir || input.listing.souvenir)));
  if (rule.outputRules.matchSouvenir && souvenirValues.size !== 1) {
    return probabilities;
  }

  const [inputSouvenir] = [...souvenirValues];
  const collectionMap = new Map(collections.map((c) => [c.id, c]));
  const collectionCounts = new Map<string, number>();

  for (const input of inputs) {
    collectionCounts.set(input.item.collectionId, (collectionCounts.get(input.item.collectionId) ?? 0) + 1);
  }

  const totalInputs = inputs.length;
  const blocked = new Set(rule.collectionRules.blockedCollectionIds);

  for (const [colId, count] of collectionCounts) {
    if (blocked.has(colId)) continue;
    const collection = collectionMap.get(colId);
    if (!collection) continue;

    const outputSkins = collection.items.filter(
      (item) =>
        item.rarity === outputRarity &&
        item.stattrak === stattrak &&
        !!item.souvenir === inputSouvenir,
    );

    if (outputSkins.length === 0) continue;

    const collectionProb = rule.collectionRules.proportionalByCollectionCount
      ? count / totalInputs
      : 1 / collectionCounts.size;

    const perSkinProb = rule.outputRules.uniformWithinTier
      ? collectionProb / outputSkins.length
      : collectionProb;

    for (const skin of outputSkins) {
      const existing = probabilities.get(skin.id)?.probability ?? 0;
      const probability = existing + perSkinProb;
      probabilities.set(skin.id, {
        probability,
        source: 'community',
        confidence: 0.95,
        reference: 'CS2 trade-up: proportional by collection count, uniform within tier',
      });
    }
  }

  return probabilities;
}

export function buildContractOutputs(
  inputs: ContractInput[],
  collections: Collection[],
  outputRarity: Rarity,
  stattrak: boolean,
  targetSkinId: string,
  rule: ContractRule,
  priceLookup: (itemId: string, expectedFloat: number) => number,
): ContractOutput[] {
  const probabilities = calculateOutputProbabilities(
    inputs,
    collections,
    outputRarity,
    stattrak,
    rule,
  );

  const itemMap = new Map(
    collections.flatMap((c) => c.items.map((i) => [i.id, i])),
  );

  const outputs: ContractOutput[] = [];

  for (const [skinId, meta] of probabilities) {
    const item = itemMap.get(skinId);
    if (!item) continue;

    const expectedFloat = calculateExpectedFloatForOutput(inputs, item);

    outputs.push({
      item,
      probability: meta.probability,
      probabilityMeta: meta,
      expectedFloat,
      expectedWear: floatToWear(expectedFloat),
      price: priceLookup(item.id, expectedFloat),
      isTarget: skinId === targetSkinId,
    });
  }

  return outputs.sort((a, b) => b.probability - a.probability);
}

export function getPossibleOutputs(
  inputs: ContractInput[],
  collections: Collection[],
  outputRarity: Rarity,
  stattrak: boolean,
): SkinItem[] {
  const collectionMap = new Map(collections.map((c) => [c.id, c]));
  const involved = new Set(inputs.map((i) => i.item.collectionId));
  const outputs: SkinItem[] = [];

  for (const colId of involved) {
    const collection = collectionMap.get(colId);
    if (!collection) continue;
    outputs.push(
      ...collection.items.filter(
        (item) => item.rarity === outputRarity && item.stattrak === stattrak,
      ),
    );
  }

  return outputs;
}
