import { useState } from 'react';
import type { SimulationResult, TradeUpContract } from '../models/types';
import { formatCurrency, formatPercent } from '../utils/format';
import { Histogram } from './Histogram';

interface SimulationPanelProps {
  contract: TradeUpContract;
  onSimulate: (contract: TradeUpContract) => SimulationResult;
}

export function SimulationPanel({ contract, onSimulate }: SimulationPanelProps) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleSimulate = () => {
    setRunning(true);
    setTimeout(() => {
      const sim = onSimulate(contract);
      setResult(sim);
      setRunning(false);
    }, 100);
  };

  const targetRate = result
    ? (result.targetObtained / result.iterations) * 100
    : 0;

  return (
    <div className="simulation-panel card">
      <h3>Simulação Monte Carlo</h3>
      <button
        type="button"
        className="btn secondary"
        onClick={handleSimulate}
        disabled={running}
      >
        {running ? 'Simulando...' : 'Simular 100.000 contratos'}
      </button>

      {result && (
        <div className="sim-results">
          <div className="metrics-grid small">
            <div className="metric">
              <span className="label">Skin alvo obtida</span>
              <span className="value">{result.targetObtained.toLocaleString()}</span>
              <span className="sub">{formatPercent(targetRate)}</span>
            </div>
            <div className="metric">
              <span className="label">Lucro médio</span>
              <span className={`value ${result.averageProfit >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(result.averageProfit)}
              </span>
            </div>
            <div className="metric">
              <span className="label">Perda média</span>
              <span className="value negative">{formatCurrency(result.averageLoss)}</span>
            </div>
          </div>

          <h4>Distribuição de saídas</h4>
          <table className="data-table compact">
            <thead>
              <tr><th>Skin</th><th>Quantidade</th><th>%</th></tr>
            </thead>
            <tbody>
              {Object.entries(result.outputCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{count.toLocaleString()}</td>
                    <td>{formatPercent((count / result.iterations) * 100)}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <h4>Histograma de lucro/prejuízo</h4>
          <Histogram data={result.histogram} />
        </div>
      )}
    </div>
  );
}
