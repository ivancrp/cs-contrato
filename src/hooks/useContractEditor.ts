'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeScenarios,
  calculateEVMetrics,
  calculateFloatMetrics,
  floatToWear,
} from '@ct/engine';
import type { SkinItem } from '@ct/types';
import type { EnrichedTradeUpContract } from '@/components/TradeUpResults';
import { buildContractFromInputs } from '@/lib/trade-up-api';

function clampFloat(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyLocalInputEdit(
  contract: EnrichedTradeUpContract,
  index: number,
  field: 'float' | 'price',
  rawValue: number,
  targetSkin: Pick<SkinItem, 'id' | 'minFloat' | 'maxFloat'>,
): EnrichedTradeUpContract {
  const inputs = contract.inputs.map((input, idx) => {
    if (idx !== index) return input;
    if (field === 'float') {
      const float = clampFloat(rawValue, input.item.minFloat, input.item.maxFloat);
      return {
        ...input,
        listing: {
          ...input.listing,
          float,
          wear: floatToWear(float),
        },
      };
    }
    return {
      ...input,
      listing: {
        ...input.listing,
        price: Math.max(0, rawValue),
      },
    };
  });

  const floatMetrics = calculateFloatMetrics(inputs, targetSkin as SkinItem);
  const avgNorm = floatMetrics.averageNormalizedFloat;

  const outputs = contract.outputs.map((output) => {
    const range = output.item.maxFloat - output.item.minFloat;
    const expectedFloat = output.item.minFloat + avgNorm * range;
    const clamped = Math.min(Math.max(expectedFloat, output.item.minFloat), output.item.maxFloat);
    return {
      ...output,
      expectedFloat: Math.round(clamped * 10000) / 10000,
      expectedWear: floatToWear(clamped),
    };
  });

  const totalCost = inputs.reduce((sum, input) => sum + input.listing.price, 0);
  const evMetrics = calculateEVMetrics(outputs, totalCost, targetSkin.id);
  const { worstCase, bestCase } = analyzeScenarios(outputs, totalCost);

  return {
    ...contract,
    inputs,
    outputs,
    floatMetrics,
    evMetrics,
    worstCase,
    bestCase,
  };
}

export function useContractEditor(
  initial: EnrichedTradeUpContract,
  targetSkin: Pick<SkinItem, 'id' | 'minFloat' | 'maxFloat' | 'stattrak'>,
) {
  const [contract, setContract] = useState(initial);
  const [editMode, setEditMode] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestInputsRef = useRef(initial.inputs);

  useEffect(() => {
    setContract(initial);
    latestInputsRef.current = initial.inputs;
  }, [initial]);

  const syncWithServer = useCallback(async () => {
    setRecalculating(true);
    setError(null);
    try {
      const rebuilt = await buildContractFromInputs(
        latestInputsRef.current,
        targetSkin.id,
        targetSkin.stattrak,
      );
      setContract((prev) => ({
        ...prev,
        ...rebuilt,
        tier: prev.tier,
        tierLabel: prev.tierLabel,
        aiScore: prev.aiScore,
        algorithmUsed: prev.algorithmUsed,
        inputsVerified: prev.inputsVerified,
        inputsLive: prev.inputsLive,
        unverifiedInputNames: prev.unverifiedInputNames,
        priceDeltaFromVerification: prev.priceDeltaFromVerification,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao recalcular');
    } finally {
      setRecalculating(false);
    }
  }, [targetSkin.id, targetSkin.stattrak]);

  const scheduleServerSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void syncWithServer();
    }, 500);
  }, [syncWithServer]);

  const updateInput = useCallback(
    (index: number, field: 'float' | 'price', value: number) => {
      setContract((prev) => {
        const next = applyLocalInputEdit(prev, index, field, value, targetSkin);
        latestInputsRef.current = next.inputs;
        return next;
      });
      scheduleServerSync();
    },
    [targetSkin, scheduleServerSync],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    contract,
    editMode,
    setEditMode,
    updateInput,
    recalculating,
    error,
    syncWithServer,
  };
}
