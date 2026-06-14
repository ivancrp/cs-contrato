import type { ContractOutput } from '../models/types';
import { getCollectionName } from '../contracts/tradeUpCalculator';
import { formatCurrency, formatFloat, formatPercent } from '../utils/format';
import { SkinImage } from './SkinImage';
import { InspectButton } from './InspectButton';

interface OutputTableProps {
  outputs: ContractOutput[];
}

function priceSourceLabel(output: ContractOutput): string {
  if (output.floatAvailable) {
    return output.priceSource === 'listing_exact'
      ? 'Listing no float esperado'
      : 'Listing comparável no mercado';
  }
  if (output.priceSource === 'wear_tier') {
    return 'Float indisponível — preço do wear com desconto';
  }
  if (output.priceSource === 'catalog') {
    return 'Sem listings — estimativa conservadora';
  }
  return 'Preço estimado (float raro no mercado)';
}

export function OutputTable({ outputs }: OutputTableProps) {
  return (
    <>
      <div className="output-cards-mobile">
        {outputs.map((output) => (
          <div
            key={output.item.id}
            className={`output-card ${output.isTarget ? 'target' : ''}`}
          >
            <SkinImage name={output.item.name} rarity={output.item.rarity} size="md" />
            <div className="output-card-body">
              <div className="output-card-title">
                {output.isTarget && <span className="target-badge">ALVO</span>}
                {output.item.name}
              </div>
              <div className="output-card-meta">
                {getCollectionName(output.item.collectionId)}
              </div>
              <div className="output-card-stats">
                <span>{formatPercent(output.probability * 100)}</span>
                <span>{formatCurrency(output.price)}</span>
                <span>VE {formatCurrency(output.probability * output.price)}</span>
                <span>Float {formatFloat(output.expectedFloat)}</span>
                <span>{output.expectedWear}</span>
              </div>
              <span
                className={`market-verified-badge${output.floatAvailable ? '' : ' estimated'}`}
                title={priceSourceLabel(output)}
              >
                {output.floatAvailable ? '✓ float no mercado' : '~ float indisponível'}
                {output.theoreticalPrice != null && output.theoreticalPrice !== output.price && (
                  <> · teórico {formatCurrency(output.theoreticalPrice)}</>
                )}
              </span>
              <InspectButton
                compact
                params={{
                  skinName: output.item.name,
                  stattrak: output.item.stattrak,
                  float: output.expectedFloat,
                  wear: output.expectedWear,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="table-responsive output-table-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-img" />
              <th>Skin</th>
              <th>Coleção</th>
              <th>Float esperado</th>
              <th>Wear</th>
              <th>Preço</th>
              <th>Probabilidade</th>
              <th>Valor esperado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {outputs.map((output) => (
              <tr key={output.item.id} className={output.isTarget ? 'target-row' : ''}>
                <td className="col-img">
                  <SkinImage name={output.item.name} rarity={output.item.rarity} size="sm" />
                </td>
                <td className="skin-name-cell">
                  {output.isTarget && <span className="target-badge">ALVO</span>}
                  {output.item.name}
                </td>
                <td>{getCollectionName(output.item.collectionId)}</td>
                <td>{formatFloat(output.expectedFloat)}</td>
                <td>{output.expectedWear}</td>
                <td>
                  {formatCurrency(output.price)}
                  {output.theoreticalPrice != null && output.theoreticalPrice !== output.price && (
                    <span className="theoretical-price" title="Preço teórico interpolado">
                      {' '}(~{formatCurrency(output.theoreticalPrice)})
                    </span>
                  )}
                </td>
                <td>{formatPercent(output.probability * 100)}</td>
                <td>{formatCurrency(output.probability * output.price)}</td>
                <td>
                  <InspectButton
                    compact
                    params={{
                      skinName: output.item.name,
                      stattrak: output.item.stattrak,
                      float: output.expectedFloat,
                      wear: output.expectedWear,
                    }}
                  />
                  <span
                    className={`market-verified-badge compact${output.floatAvailable ? '' : ' estimated'}`}
                    title={priceSourceLabel(output)}
                  >
                    {output.floatAvailable ? '✓ mercado' : '~ indisponível'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
