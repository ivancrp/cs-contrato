import { useState } from 'react';
import type { CandidateListing } from '../algorithms/types';
import type { MinLossAnalysis, SimulationResult, SkinItem, TargetSearchParams, TradeUpContract } from '../models/types';
import { formatCurrency, formatFloat, formatPercent } from '../utils/format';
import { getItemRarityLabel } from '../contracts/tradeUpCalculator';
import { InputTable } from './InputTable';
import { OutputTable } from './OutputTable';
import { ScoreStars } from './ScoreStars';
import { SimulationPanel } from './SimulationPanel';
import { ContractResimulator } from './ContractResimulator';
import { InputGrid } from './InputGrid';

interface ContractCardProps {
  contract: TradeUpContract;
  onSimulate: (contract: TradeUpContract, iterations?: number) => SimulationResult;
  minLossAnalysis?: MinLossAnalysis;
  candidates?: CandidateListing[];
  targetSkin?: SkinItem;
  searchParams?: TargetSearchParams;
  onRecalculate?: (
    inputs: import('../models/types').ContractInput[],
    base: Pick<TradeUpContract, 'tier' | 'tierLabel' | 'algorithmUsed' | 'aiScore'>,
  ) => Promise<TradeUpContract>;
}

export function ContractCard({
  contract,
  onSimulate,
  minLossAnalysis,
  candidates,
  targetSkin,
  searchParams,
  onRecalculate,
}: ContractCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { evMetrics, floatMetrics } = contract;
  const otherSkinsChance = Math.max(0, 1 - evMetrics.targetChance);
  const unavailableOutputs = contract.outputs.filter((output) => output.floatAvailable === false).length;

  return (
    <div className={`contract-card card tier-${contract.tier}${expanded ? ' is-expanded' : ''}`}>
      <div className="contract-header">
        <div>
          <h3>{contract.tierLabel}</h3>
          <span className="algo-tag">Algoritmo: {contract.algorithmUsed}</span>
        </div>
        <ScoreStars score={contract.aiScore} />
      </div>

      <div className="input-preview">
        <span className="preview-label">
          10 entradas
          {contract.inputs[0] && (
            <>
              {contract.inputs[0].item.stattrak && ' · StatTrak™'}
              {` · ${getItemRarityLabel(contract.inputs[0].item)}`}
            </>
          )}
        </span>
        <InputGrid inputs={contract.inputs} preview />
      </div>

      <div className="metrics-grid">
        <div className="metric">
          <span className="label">Custo Total</span>
          <span className="value">{formatCurrency(evMetrics.totalCost)}</span>
        </div>
        <div className="metric">
          <span className="label">Chance de Lucro</span>
          <span className={`value highlight ${evMetrics.breakEvenChance >= 0.5 ? 'positive' : ''}`}>
            {formatPercent(evMetrics.breakEvenChance * 100)}
          </span>
        </div>
        <div className="metric">
          <span className="label">Chance Alvo</span>
          <span className="value">{formatPercent(evMetrics.targetChance * 100)}</span>
        </div>
        <div className="metric">
          <span className="label">Outras Saídas</span>
          <span className="value">{formatPercent(otherSkinsChance * 100)}</span>
        </div>
        <div className="metric">
          <span className="label">EV</span>
          <span className="value">{formatCurrency(evMetrics.expectedValue)}</span>
        </div>
        <div className="metric">
          <span className="label">ROI</span>
          <span className={`value ${evMetrics.roi >= 0 ? 'positive' : 'negative'}`}>
            {formatPercent(evMetrics.roi)}
          </span>
        </div>
        <div className="metric">
          <span className="label">Lucro Esperado</span>
          <span className={`value ${evMetrics.expectedProfit >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(evMetrics.expectedProfit)}
          </span>
        </div>
        <div className="metric">
          <span className="label">Risco</span>
          <span className="value">{evMetrics.riskScore.toFixed(1)}</span>
        </div>
        <div className="metric">
          <span className="label">Float Médio</span>
          <span className="value">{formatFloat(floatMetrics.averageInputFloat)}</span>
        </div>
        <div className="metric">
          <span className="label">Float Esperado</span>
          <span className="value">{formatFloat(floatMetrics.expectedOutputFloat)}</span>
        </div>
        <div className="metric">
          <span className="label">Wear Esperado</span>
          <span className="value">{floatMetrics.expectedWear}</span>
        </div>
        <div className="metric">
          <span className="label">Break-even</span>
          <span className={`value ${evMetrics.isBreakEven ? 'positive' : ''}`}>
            {formatPercent(evMetrics.breakEvenChance * 100)}
          </span>
        </div>
      </div>

      <div className="ev-details">
        <span>Margem: {formatPercent(evMetrics.marginPercent)}</span>
        {evMetrics.isBreakEven && <span className="break-even-tag">EV = Custo</span>}
        <span>Perda máx: {formatCurrency(evMetrics.maxLoss)}</span>
        <span>Perda média: {formatCurrency(evMetrics.averageLoss)}</span>
        <span>Ganho médio: {formatCurrency(evMetrics.averageGain)}</span>
      </div>

      <p className="collections-used">
        Coleções: {contract.collectionsUsed.join(', ')}
        {unavailableOutputs > 0 && (
          <span className="market-warning">
            {' '}· {unavailableOutputs} saída(s) sem float disponível no mercado
          </span>
        )}
      </p>

      {minLossAnalysis && contract.tier === 'min_loss' && (
        <div className="min-loss-analysis">
          <h4>Modo Menor Perda</h4>
          <div className="scenario worst">
            <strong>Pior cenário:</strong> {minLossAnalysis.worstCase.skin} — Perda: {formatCurrency(minLossAnalysis.worstCase.loss)}
          </div>
          <div className="scenario best">
            <strong>Melhor cenário:</strong> {minLossAnalysis.bestCase.skin} — Ganho: {formatCurrency(minLossAnalysis.bestCase.gain)}
          </div>
          <div className="min-loss-metrics">
            <span>EV sem alvo: {formatCurrency(minLossAnalysis.nonTargetExpectedValue)}</span>
            <span>ROI sem alvo: {formatPercent(minLossAnalysis.nonTargetRoi)}</span>
            <span>Lucro médio sem alvo: {formatCurrency(minLossAnalysis.nonTargetAverageProfit)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        className="btn ghost"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Ocultar detalhes' : 'Ver detalhes completos'}
      </button>

      {expanded && (
        <div className="contract-details">
          <h4>10 Skins de Entrada</h4>
          <InputTable inputs={contract.inputs} />
          <h4>Saídas Possíveis</h4>
          <OutputTable outputs={contract.outputs} />
          {candidates && targetSkin && searchParams && onRecalculate ? (
            <ContractResimulator
              contract={contract}
              candidates={candidates}
              targetSkin={targetSkin}
              searchParams={searchParams}
              onRecalculate={onRecalculate}
              onSimulate={onSimulate}
            />
          ) : (
            <SimulationPanel contract={contract} onSimulate={onSimulate} />
          )}
        </div>
      )}
    </div>
  );
}
