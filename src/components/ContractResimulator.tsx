import { useMemo, useState } from 'react';
import type { CandidateListing } from '../algorithms/types';
import { combinationToInputs } from '../contracts/contractBuilder';
import { getCollectionName } from '../contracts/tradeUpCalculator';
import type {
  ContractInput,
  SimulationResult,
  SkinItem,
  TargetSearchParams,
  TradeUpContract,
} from '../models/types';
import { buildAlternativeOptions } from '../services/contractRecalcService';
import { formatCurrency, formatFloat } from '../utils/format';
import { SimulationPanel } from './SimulationPanel';

interface ContractResimulatorProps {
  contract: TradeUpContract;
  candidates: CandidateListing[];
  targetSkin: SkinItem;
  searchParams: TargetSearchParams;
  onRecalculate: (
    inputs: ContractInput[],
    base: Pick<TradeUpContract, 'tier' | 'tierLabel' | 'algorithmUsed' | 'aiScore'>,
  ) => Promise<TradeUpContract>;
  onSimulate: (
    contract: TradeUpContract,
    iterations?: number,
  ) => SimulationResult | Promise<SimulationResult>;
}

function candidateLabel(candidate: CandidateListing, itemName: string): string {
  return `${itemName} · ${formatFloat(candidate.float)} · ${formatCurrency(candidate.price)}`;
}

export function ContractResimulator({
  contract,
  candidates,
  searchParams,
  onRecalculate,
  onSimulate,
}: ContractResimulatorProps) {
  const [slotSelections, setSlotSelections] = useState<(string | null)[]>(
    () => contract.inputs.map((input) => input.listing.id),
  );
  const [activeContract, setActiveContract] = useState(contract);
  const [recalculated, setRecalculated] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidateByListingId = useMemo(() => {
    const map = new Map<string, CandidateListing>();
    for (const candidate of candidates) {
      map.set(candidate.listingId, candidate);
    }
    return map;
  }, [candidates]);

  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const input of contract.inputs) {
      map.set(input.item.id, input.item.name);
    }
    for (const candidate of candidates) {
      if (!map.has(candidate.itemId)) {
        const fromInput = contract.inputs.find((input) => input.item.id === candidate.itemId);
        if (fromInput) map.set(candidate.itemId, fromInput.item.name);
      }
    }
    return map;
  }, [contract.inputs, candidates]);

  const draftInputs = useMemo(() => {
    const selectedCandidates = slotSelections.map((listingId) => {
      if (!listingId) return null;
      return candidateByListingId.get(listingId) ?? null;
    });

    if (selectedCandidates.some((candidate) => !candidate)) return null;

    const indices = selectedCandidates.map((candidate) => {
      if (!candidate) return -1;
      return candidates.findIndex((entry) => entry.listingId === candidate.listingId);
    });

    if (indices.some((index) => index < 0)) return null;

    return combinationToInputs(indices, candidates, searchParams.marketplace);
  }, [slotSelections, candidateByListingId, candidates, searchParams.marketplace]);

  const hasChanges = slotSelections.some(
    (listingId, index) => listingId !== contract.inputs[index]?.listing.id,
  );

  const handleRecalculate = async () => {
    if (!draftInputs) {
      setError('Selecione listings válidas para todas as 10 entradas.');
      return;
    }

    setRecalculating(true);
    setError(null);

    try {
      const next = await onRecalculate(draftInputs, {
        tier: contract.tier,
        tierLabel: hasChanges ? `${contract.tierLabel} (personalizado)` : contract.tierLabel,
        algorithmUsed: contract.algorithmUsed,
        aiScore: contract.aiScore,
      });
      setActiveContract(next);
      setRecalculated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao recalcular contrato');
    } finally {
      setRecalculating(false);
    }
  };

  const handleReset = () => {
    setSlotSelections(contract.inputs.map((input) => input.listing.id));
    setActiveContract(contract);
    setRecalculated(false);
    setError(null);
  };

  return (
    <div className="contract-resimulator">
      <h4>Personalizar entradas e refazer simulação</h4>
      <p className="resimulator-hint">
        Troque skins de entrada por alternativas disponíveis no mercado e recalcule
        com preços reais de venda das saídas.
      </p>

      <div className="resimulator-slots">
        {contract.inputs.map((input, index) => {
          const options = buildAlternativeOptions(
            candidates,
            draftInputs ?? contract.inputs,
            index,
          );
          const currentListingId = slotSelections[index] ?? input.listing.id;

          return (
            <label key={`${input.listing.id}-${index}`} className="resimulator-slot">
              <span className="slot-label">
                #{index + 1} {input.item.name}
              </span>
              <select
                value={currentListingId}
                onChange={(event) => {
                  const next = [...slotSelections];
                  next[index] = event.target.value;
                  setSlotSelections(next);
                  setRecalculated(false);
                }}
                disabled={recalculating}
              >
                <option value={input.listing.id}>
                  Original · {formatFloat(input.listing.float)} · {formatCurrency(input.listing.price)}
                </option>
                {options
                  .filter((candidate) => candidate.listingId !== input.listing.id)
                  .slice(0, 25)
                  .map((candidate) => (
                    <option key={candidate.listingId} value={candidate.listingId}>
                      {candidateLabel(
                        candidate,
                        itemNameById.get(candidate.itemId) ?? input.item.name,
                      )}
                      {candidate.isTargetCollection ? ' · coleção alvo' : ''}
                    </option>
                  ))}
              </select>
              <span className="slot-collection">
                {getCollectionName(input.item.collectionId)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="resimulator-actions">
        <button
          type="button"
          className="btn secondary"
          onClick={handleRecalculate}
          disabled={recalculating || !hasChanges}
        >
          {recalculating ? 'Recalculando...' : 'Recalcular contrato'}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={handleReset}
          disabled={recalculating || (!hasChanges && !recalculated)}
        >
          Restaurar original
        </button>
      </div>

      {error && <p className="resimulator-error">{error}</p>}

      {recalculated && (
        <div className="resimulator-summary card nested">
          <strong>Contrato recalculado</strong>
          <div className="metrics-grid small">
            <div className="metric">
              <span className="label">Custo</span>
              <span className="value">{formatCurrency(activeContract.evMetrics.totalCost)}</span>
            </div>
            <div className="metric">
              <span className="label">EV realista</span>
              <span className="value">{formatCurrency(activeContract.evMetrics.expectedValue)}</span>
            </div>
            <div className="metric">
              <span className="label">Float esperado</span>
              <span className="value">{formatFloat(activeContract.floatMetrics.expectedOutputFloat)}</span>
            </div>
            <div className="metric">
              <span className="label">Chance alvo</span>
              <span className="value">
                {(activeContract.evMetrics.targetChance * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <SimulationPanel contract={activeContract} onSimulate={onSimulate} />
    </div>
  );
}
