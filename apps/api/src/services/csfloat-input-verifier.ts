import { calculateEVMetrics, analyzeScenarios } from '@ct/engine';
import { fetchCsfloatListings } from '@ct/pricing';
import type { ContractInput, SkinItem, TradeUpContract } from '@ct/types';
import { buildMarketHashName, maxAllowedInputFloat } from './trade-up-helpers.js';

const FLOAT_MATCH_TOLERANCE = 0.003;
const VERIFY_BATCH = 4;

export interface InputVerificationResult {
  inputs: ContractInput[];
  verifiedCount: number;
  liveCount: number;
  unverifiedNames: string[];
  priceDelta: number;
}

function csfloatPurchaseUrl(listingId: string): string {
  const id = listingId.replace(/^csfloat-/, '');
  return `https://csfloat.com/item/${id}`;
}

function pickBestListing(
  listings: Awaited<ReturnType<typeof fetchCsfloatListings>>,
  targetFloat: number,
  maxAllowedFloat: number,
): (typeof listings)[number] | null {
  if (listings.length === 0) return null;

  const compatible = listings.filter((l) => l.float <= maxAllowedFloat + 0.0001);
  const pool = compatible.length > 0 ? compatible : listings;

  const exactMatch = pool.find(
    (l) => Math.abs(l.float - targetFloat) <= FLOAT_MATCH_TOLERANCE,
  );
  if (exactMatch) return exactMatch;

  return pool.sort(
    (a, b) =>
      Math.abs(a.float - targetFloat) - Math.abs(b.float - targetFloat) ||
      a.price - b.price,
  )[0];
}

async function verifySingleInput(
  input: ContractInput,
  targetSkin: SkinItem,
  targetMaxFloat: number,
): Promise<{ input: ContractInput; verified: boolean }> {
  const maxAllowed = maxAllowedInputFloat(targetSkin, targetMaxFloat, input.item);
  const wear = input.listing.wear;
  const hash = buildMarketHashName(input.item.name, input.item.stattrak, wear);

  try {
    const floatWindow = Math.max(0.02, FLOAT_MATCH_TOLERANCE * 3);
    const listings = await fetchCsfloatListings({
      marketHashName: hash,
      maxFloat: Math.min(maxAllowed, input.listing.float + floatWindow),
      minFloat: Math.max(input.item.minFloat, input.listing.float - floatWindow),
      limit: 10,
    });

    const best = pickBestListing(listings, input.listing.float, maxAllowed);
    if (!best) return { input, verified: false };

    const verifiedInput: ContractInput = {
      item: input.item,
      listing: {
        ...best,
        itemId: input.item.id,
        purchaseUrl: csfloatPurchaseUrl(best.id),
      },
    };

    return { input: verifiedInput, verified: true };
  } catch {
    return { input, verified: false };
  }
}

/** Revalida cada input do contrato no CSFloat e substitui por listing real com preço atual. */
export async function verifyContractInputsOnCsfloat(
  inputs: ContractInput[],
  targetSkin: SkinItem,
  targetMaxFloat: number,
): Promise<InputVerificationResult> {
  if (!process.env.CSFLOAT_API_KEY) {
    return {
      inputs,
      verifiedCount: 0,
      liveCount: inputs.filter((i) => i.listing.marketplace === 'csfloat').length,
      unverifiedNames: [],
      priceDelta: 0,
    };
  }

  const originalCost = inputs.reduce((sum, i) => sum + i.listing.price, 0);
  const verifiedInputs: ContractInput[] = [];
  const unverifiedNames: string[] = [];
  let verifiedCount = 0;

  for (let i = 0; i < inputs.length; i += VERIFY_BATCH) {
    const batch = inputs.slice(i, i + VERIFY_BATCH);
    const results = await Promise.all(
      batch.map((input) => verifySingleInput(input, targetSkin, targetMaxFloat)),
    );

    for (const result of results) {
      verifiedInputs.push(result.input);
      if (result.verified) {
        verifiedCount++;
      } else {
        unverifiedNames.push(result.input.item.name);
      }
    }
  }

  const newCost = verifiedInputs.reduce((sum, i) => sum + i.listing.price, 0);

  return {
    inputs: verifiedInputs,
    verifiedCount,
    liveCount: verifiedCount,
    unverifiedNames,
    priceDelta: Math.round((newCost - originalCost) * 100) / 100,
  };
}

export function applyVerifiedInputsToContract(
  contract: TradeUpContract,
  verification: InputVerificationResult,
  targetSkinId: string,
): TradeUpContract {
  const totalCost = verification.inputs.reduce((sum, i) => sum + i.listing.price, 0);
  const evMetrics = calculateEVMetrics(contract.outputs, totalCost, targetSkinId);
  const scenarios = analyzeScenarios(contract.outputs, totalCost);

  return {
    ...contract,
    inputs: verification.inputs,
    evMetrics,
    worstCase: scenarios.worstCase,
    bestCase: scenarios.bestCase,
  };
}
