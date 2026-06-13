import type { ContractInput } from '../models/types';
import { formatCurrency, formatFloat } from '../utils/format';
import { SkinImage } from './SkinImage';
import { SkinListingLinks } from './SkinListingLinks';

interface InputGridProps {
  inputs: ContractInput[];
  /** Layout compacto nos cards de contrato. */
  preview?: boolean;
}

/** Grid visual das 10 skins de entrada — responsivo mobile/desktop. */
export function InputGrid({ inputs, preview = false }: InputGridProps) {
  return (
    <div className={`input-grid${preview ? ' input-grid-preview' : ''}`}>
      {inputs.map((input, i) => (
        <div key={i} className="input-grid-item">
          <div className="input-grid-header">
            <span className="input-grid-name" title={input.item.name}>
              {input.item.stattrak && <span className="st-badge">ST</span>}
              {input.item.name}
            </span>
            <span className="input-grid-wear">({input.listing.wear})</span>
            <span className="input-grid-rarity">{input.item.rarity.replace('-', ' ')}</span>
          </div>
          <SkinImage
            name={input.item.name}
            rarity={input.item.rarity}
            size="md"
            className="input-grid-img"
          />
          <div className="input-grid-info">
            <span className="input-grid-price">{formatCurrency(input.listing.price)}</span>
            <span className="input-grid-meta">{formatFloat(input.listing.float)}</span>
            <SkinListingLinks
              compact={preview}
              marketplace={input.listing.marketplace}
              price={input.listing.price}
              params={{
                skinName: input.item.name,
                stattrak: input.item.stattrak,
                float: input.listing.float,
                wear: input.listing.wear,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
