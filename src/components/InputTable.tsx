import { useState } from 'react';
import type { ContractInput } from '../models/types';
import { formatCurrency, formatFloat } from '../utils/format';
import { getCollectionName, getItemRarityLabel } from '../contracts/tradeUpCalculator';
import { SkinImage } from './SkinImage';
import { InputGrid } from './InputGrid';
import { SkinListingLinks } from './SkinListingLinks';

interface InputTableProps {
  inputs: ContractInput[];
}

type SortKey = 'name' | 'price' | 'float' | 'collection';

export function InputTable({ inputs }: InputTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [asc, setAsc] = useState(true);

  const sorted = [...inputs].sort((a, b) => {
    const dir = asc ? 1 : -1;
    switch (sortKey) {
      case 'name': return dir * a.item.name.localeCompare(b.item.name);
      case 'price': return dir * (a.listing.price - b.listing.price);
      case 'float': return dir * (a.listing.float - b.listing.float);
      case 'collection': return dir * getCollectionName(a.item.collectionId).localeCompare(getCollectionName(b.item.collectionId));
      default: return 0;
    }
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setAsc(!asc);
    else { setSortKey(key); setAsc(true); }
  };

  return (
    <>
      <div className="input-grid-mobile">
        <InputGrid inputs={sorted} />
      </div>
      <div className="table-responsive input-table-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-img" />
              <th onClick={() => toggleSort('name')}>Nome</th>
              <th onClick={() => toggleSort('collection')}>Coleção</th>
              <th>Raridade</th>
              <th>ST</th>
              <th onClick={() => toggleSort('float')}>Float</th>
              <th onClick={() => toggleSort('price')}>Preço</th>
              <th>Marketplace</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((input, i) => (
              <tr key={i}>
                <td className="col-img">
                  <SkinImage name={input.item.name} rarity={input.item.rarity} size="md" />
                </td>
                <td className="skin-name-cell">{input.item.name}</td>
                <td>{getCollectionName(input.item.collectionId)}</td>
                <td>
                  <span className={`rarity-badge rarity-${input.item.rarity}`}>
                    {getItemRarityLabel(input.item)}
                  </span>
                </td>
                <td>{input.item.stattrak ? '✓' : '-'}</td>
                <td>{formatFloat(input.listing.float)}</td>
                <td>{formatCurrency(input.listing.price)}</td>
                <td className="market-tag">{input.listing.marketplace}</td>
                <td>
                  <SkinListingLinks
                    compact
                    marketplace={input.listing.marketplace}
                    params={{
                      skinName: input.item.name,
                      stattrak: input.item.stattrak,
                      float: input.listing.float,
                      wear: input.listing.wear,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
