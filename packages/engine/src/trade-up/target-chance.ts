import type { Collection, SkinItem } from '@ct/types';

export interface TargetCollectionContext {
  collectionId: string;
  outputSkinCount: number;
}

export interface TargetChancePlan {
  collectionId: string;
  inputCount: number;
  expectedChance: number;
  outputSkinCount: number;
}

function getTargetCollectionContexts(
  targetSkin: SkinItem,
  collections: Collection[],
): TargetCollectionContext[] {
  return collections
    .filter((collection) => collection.items.some((item) => item.id === targetSkin.id))
    .map((collection) => {
      const outputSkins = collection.items.filter(
        (item) =>
          item.rarity === targetSkin.rarity &&
          item.stattrak === targetSkin.stattrak &&
          !!item.souvenir === !!targetSkin.souvenir,
      );
      return {
        collectionId: collection.id,
        outputSkinCount: outputSkins.length,
      };
    })
    .filter((context) => context.outputSkinCount > 0);
}

export function maxAchievableTargetChance(
  targetSkin: SkinItem,
  collections: Collection[],
): number {
  const contexts = getTargetCollectionContexts(targetSkin, collections);
  if (contexts.length === 0) return 0;

  const minOutputCount = Math.min(...contexts.map((context) => context.outputSkinCount));
  return 1 / minOutputCount;
}

export function planInputsForTargetChance(
  targetSkin: SkinItem,
  collections: Collection[],
  minChance = 0.6,
): TargetChancePlan | null {
  const contexts = getTargetCollectionContexts(targetSkin, collections)
    .sort((a, b) => a.outputSkinCount - b.outputSkinCount);

  const best = contexts[0];
  if (!best) return null;

  const maxChance = 10 / (10 * best.outputSkinCount);
  if (maxChance < minChance) return null;

  const inputCount = Math.ceil(minChance * 10 * best.outputSkinCount);
  if (inputCount > 10) return null;

  return {
    collectionId: best.collectionId,
    inputCount,
    expectedChance: inputCount / 10 / best.outputSkinCount,
    outputSkinCount: best.outputSkinCount,
  };
}

export function getTargetChanceFromOutputs(
  outputs: { item: { id: string }; probability: number }[],
  targetSkinId: string,
): number {
  return outputs
    .filter((output) => output.item.id === targetSkinId)
    .reduce((sum, output) => sum + output.probability, 0);
}
