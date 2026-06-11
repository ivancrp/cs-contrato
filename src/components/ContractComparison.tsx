import type { TradeUpContract } from '../models/types';
import { formatCurrency, formatFloat, formatPercent } from '../utils/format';
import { ScoreStars } from './ScoreStars';

interface ContractComparisonProps {
  contracts: TradeUpContract[];
  recommendedTier?: TradeUpContract['tier'];
}

const METRICS = [
  { key: 'totalCost', label: 'Preço', format: (c: TradeUpContract) => formatCurrency(c.evMetrics.totalCost) },
  { key: 'targetChance', label: 'Chance', format: (c: TradeUpContract) => formatPercent(c.evMetrics.targetChance * 100) },
  { key: 'ev', label: 'EV', format: (c: TradeUpContract) => formatCurrency(c.evMetrics.expectedValue) },
  { key: 'roi', label: 'ROI', format: (c: TradeUpContract) => formatPercent(c.evMetrics.roi) },
  { key: 'float', label: 'Float', format: (c: TradeUpContract) => formatFloat(c.floatMetrics.expectedOutputFloat) },
  { key: 'profit', label: 'Lucro', format: (c: TradeUpContract) => formatCurrency(c.evMetrics.expectedProfit) },
  { key: 'loss', label: 'Perda média', format: (c: TradeUpContract) => formatCurrency(c.evMetrics.averageLoss) },
  { key: 'risk', label: 'Risco', format: (c: TradeUpContract) => c.evMetrics.riskScore.toFixed(1) },
] as const;

export function ContractComparison({ contracts, recommendedTier }: ContractComparisonProps) {
  if (contracts.length < 2) return null;

  return (
    <div className="comparison card">
      <h2>Comparação de Contratos</h2>

      {/* Cards em mobile */}
      <div className="comparison-cards-mobile">
        {contracts.map((c) => (
          <div
            key={c.id}
            className={`comparison-mobile-card tier-${c.tier} ${c.tier === recommendedTier ? 'recommended' : ''}`}
          >
            <div className="comparison-mobile-header">
              <span>{c.tierLabel}</span>
              <ScoreStars score={c.aiScore} />
            </div>
            {METRICS.map((m) => (
              <div key={m.key} className="comparison-mobile-row">
                <span className="metric-label">{m.label}</span>
                <span className="metric-value">{m.format(c)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Tabela em desktop */}
      <div className="table-responsive comparison-desktop">
        <div className="comparison-grid">
          <div className="comparison-header">
            <div className="metric-label">Métrica</div>
            {contracts.map((c) => (
              <div
                key={c.id}
                className={`contract-col-header ${c.tier === recommendedTier ? 'recommended' : ''}`}
              >
                <span>{c.tierLabel}</span>
                <ScoreStars score={c.aiScore} />
              </div>
            ))}
          </div>
          {METRICS.map((m) => (
            <div key={m.key} className="comparison-row">
              <div className="metric-label">{m.label}</div>
              {contracts.map((c) => (
                <div key={c.id} className="metric-value">{m.format(c)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
