import { useEffect, useMemo, useState } from 'react';
import { catalogStore } from '../data/catalogStore';
import { SkinImage } from './SkinImage';
import { skinMetadataService } from '../services/skinMetadataService';
import { priceService } from '../services/priceService';
import {
  buildStatTrakComparisons,
  getStatTrakDeals,
  WEAR_TIERS,
  type StatTrakComparison,
} from '../services/stattrakComparisonService';
import { getCSFloatSearchUrl, getSteamMarketUrl } from '../services/inspectService';
import { formatCurrency, formatPercent } from '../utils/format';
import type { WearTier } from '../models/types';

type ViewMode = 'deals' | 'all';
type SortKey = 'savingsPercent' | 'savings' | 'normalPrice' | 'stattrakPrice' | 'skinName';

export function StatTrakDealsPage() {
  const [loading, setLoading] = useState(true);
  const [comparisons, setComparisons] = useState<StatTrakComparison[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('deals');
  const [wearFilter, setWearFilter] = useState<WearTier | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('savingsPercent');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      await Promise.all([
        catalogStore.refresh(),
        priceService.preload(),
        skinMetadataService.preload(),
      ]);
      if (cancelled) return;

      setComparisons(buildStatTrakComparisons());
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const deals = useMemo(() => getStatTrakDeals(comparisons), [comparisons]);

  const filteredRows = useMemo(() => {
    const base = viewMode === 'deals' ? deals : comparisons;
    const query = search.trim().toLowerCase();

    return base.filter((row) => {
      if (wearFilter !== 'all' && row.wear !== wearFilter) return false;
      if (query && !row.skinName.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [comparisons, deals, viewMode, wearFilter, search]);

  const sortedRows = useMemo(() => {
    const rows = [...filteredRows];
    rows.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'skinName':
          diff = a.skinName.localeCompare(b.skinName);
          break;
        case 'normalPrice':
          diff = a.normalPrice - b.normalPrice;
          break;
        case 'stattrakPrice':
          diff = a.stattrakPrice - b.stattrakPrice;
          break;
        case 'savings':
          diff = a.savings - b.savings;
          break;
        case 'savingsPercent':
        default:
          diff = a.savingsPercent - b.savingsPercent;
          break;
      }
      return sortAsc ? diff : -diff;
    });
    return rows;
  }, [filteredRows, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
      return;
    }
    setSortKey(key);
    setSortAsc(key === 'skinName');
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortAsc ? ' ↑' : ' ↓';
  };

  const updatedAt = priceService.getLastUpdated();

  return (
    <div className="stattrak-deals-page">
      <section className="card stattrak-intro">
        <h2>StatTrak vs Normal</h2>
        <p>
          Compara preços do Steam Community Market (via ByMykel) entre versões normais e StatTrak™.
          Destaque para skins em que a StatTrak está mais barata que a normal — oportunidades raras
          no mercado.
        </p>
        {updatedAt && (
          <p className="stattrak-meta">
            Preços atualizados em {new Date(updatedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </section>

      <section className="card stattrak-stats">
        <div className="stattrak-stat">
          <span className="stattrak-stat-value">{comparisons.length}</span>
          <span className="stattrak-stat-label">Comparações com preço</span>
        </div>
        <div className="stattrak-stat highlight">
          <span className="stattrak-stat-value">{deals.length}</span>
          <span className="stattrak-stat-label">StatTrak mais baratas</span>
        </div>
        <div className="stattrak-stat">
          <span className="stattrak-stat-value">
            {deals.length > 0 ? formatPercent(deals[0].savingsPercent, 1) : '—'}
          </span>
          <span className="stattrak-stat-label">Maior economia (%)</span>
        </div>
      </section>

      <section className="card stattrak-filters">
        <div className="stattrak-filter-row">
          <label>
            Exibir
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
            >
              <option value="deals">Só StatTrak mais baratas</option>
              <option value="all">Todas as comparações</option>
            </select>
          </label>

          <label>
            Desgaste
            <select
              value={wearFilter}
              onChange={(e) => setWearFilter(e.target.value as WearTier | 'all')}
            >
              <option value="all">Todos</option>
              {WEAR_TIERS.map((wear) => (
                <option key={wear} value={wear}>
                  {wearLabel(wear)}
                </option>
              ))}
            </select>
          </label>

          <label className="stattrak-search-field">
            Buscar skin
            <input
              type="search"
              placeholder="Ex: AK-47 | Redline"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </section>

      {loading ? (
        <div className="card stattrak-loading">Carregando preços do mercado…</div>
      ) : sortedRows.length === 0 ? (
        <div className="card stattrak-empty">
          Nenhuma comparação encontrada com os filtros atuais.
        </div>
      ) : (
        <section className="card table-responsive">
          <table className="data-table stattrak-table">
            <thead>
              <tr>
                <th>Skin</th>
                <th onClick={() => handleSort('skinName')}>
                  Nome{sortIndicator('skinName')}
                </th>
                <th>Desgaste</th>
                <th onClick={() => handleSort('normalPrice')}>
                  Normal{sortIndicator('normalPrice')}
                </th>
                <th onClick={() => handleSort('stattrakPrice')}>
                  StatTrak{sortIndicator('stattrakPrice')}
                </th>
                <th onClick={() => handleSort('savings')}>
                  Diferença{sortIndicator('savings')}
                </th>
                <th onClick={() => handleSort('savingsPercent')}>
                  Economia %{sortIndicator('savingsPercent')}
                </th>
                <th>Comprar StatTrak</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <StatTrakRow key={`${row.skinName}-${row.wear}`} row={row} />
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function StatTrakRow({ row }: { row: StatTrakComparison }) {
  const inspectParams = { skinName: row.skinName, stattrak: true, wear: row.wear };
  const steamUrl = getSteamMarketUrl(inspectParams);
  const csfloatUrl = getCSFloatSearchUrl(inspectParams);

  return (
    <tr className={row.stattrakCheaper ? 'stattrak-deal-row' : ''}>
      <td>
        <SkinImage name={row.skinName} rarity={row.rarity} size="sm" />
      </td>
      <td className="stattrak-skin-name">{row.skinName}</td>
      <td>{wearLabel(row.wear)}</td>
      <td>{formatCurrency(row.normalPrice)}</td>
      <td className={row.stattrakCheaper ? 'price-cheaper' : ''}>
        {formatCurrency(row.stattrakPrice)}
      </td>
      <td className={row.stattrakCheaper ? 'savings-positive' : 'savings-negative'}>
        {row.stattrakCheaper ? '−' : '+'}
        {formatCurrency(Math.abs(row.savings))}
      </td>
      <td className={row.stattrakCheaper ? 'savings-positive' : 'savings-negative'}>
        {row.stattrakCheaper ? '−' : '+'}
        {formatPercent(Math.abs(row.savingsPercent), 1)}
      </td>
      <td>
        <div className="stattrak-buy-links">
          <a
            href={steamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-inspect link buy"
          >
            Steam
          </a>
          <a
            href={csfloatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-inspect link buy"
          >
            CSFloat
          </a>
        </div>
      </td>
    </tr>
  );
}

function wearLabel(wear: WearTier): string {
  const labels: Record<WearTier, string> = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS',
  };
  return labels[wear];
}
