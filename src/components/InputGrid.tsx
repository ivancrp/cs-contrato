import type { ContractInput } from '../models/types';
import { formatCurrency, formatFloat } from '../utils/format';
import { SkinImage } from './SkinImage';
import { InspectButton } from './InspectButton';

interface InputGridProps {
  inputs: ContractInput[];
  /** Preview compacto nos cards — sem botão de inspeção. */
  preview?: boolean;
}

/** Grid visual das 10 skins de entrada — responsivo mobile/desktop. */
export function InputGrid({ inputs, preview = false }: InputGridProps) {
  return (
    <div className={`input-grid${preview ? ' input-grid-preview' : ''}`}>
      {inputs.map((input, i) => (
        <div key={i} className="input-grid-item">
          <SkinImage name={input.item.name} rarity={input.item.rarity} size="sm" />
          <div className="input-grid-info">
            <span className="input-grid-name">{input.item.name}</span>
            <span className="input-grid-meta">
              {formatFloat(input.listing.float)} · {formatCurrency(input.listing.price)}
            </span>
            {!preview && (
              <InspectButton
                compact
                params={{
                  skinName: input.item.name,
                  stattrak: input.item.stattrak,
                  float: input.listing.float,
                  wear: input.listing.wear,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
