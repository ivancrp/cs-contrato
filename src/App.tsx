import { useEffect, useRef, useState } from 'react';
import { AIRecommendation } from './components/AIRecommendation';
import { priceService } from './services/priceService';
import { skinImageService } from './services/skinImageService';
import { skinMetadataService } from './services/skinMetadataService';
import { catalogStore } from './data/catalogStore';
import { InspectButton } from './components/InspectButton';
import { ContractCard } from './components/ContractCard';
import { ContractComparison } from './components/ContractComparison';
import { SearchForm } from './components/SearchForm';
import { LoadingModal } from './components/LoadingModal';
import { SkinImage } from './components/SkinImage';
import type { TargetSearchParams } from './models/types';
import { tradeUpService } from './services/tradeUpService';
import type { TradeUpSearchResult } from './services/tradeUpService';
import './App.css';

function App() {
  useEffect(() => {
    catalogStore.refresh();
    skinImageService.preload();
    skinMetadataService.preload();
    priceService.preload();
  }, []);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeUpSearchResult | null>(null);
  const [searchParams, setSearchParams] = useState<TargetSearchParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const handleSearch = async (params: TargetSearchParams) => {
    const currentSearch = ++searchSeq.current;
    setLoading(true);
    setError(null);
    setSearchParams(params);
    try {
      const res = await tradeUpService.search(params);
      if (currentSearch !== searchSeq.current) return;
      setResult(res);
    } catch (e) {
      if (currentSearch !== searchSeq.current) return;
      setError(e instanceof Error ? e.message : 'Erro ao calcular contratos');
    } finally {
      if (currentSearch === searchSeq.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>
            <span className="logo">⚡</span>
            CS2 Trade Up Optimizer
          </h1>
          <p>Calcule contratos de troca com custo, chance de lucro e otimização automática</p>
        </div>
      </header>

      <main className="main">
        <LoadingModal
          open={loading}
          skinName={searchParams?.skinName}
          wear={searchParams?.wear}
        />

        <SearchForm
          onSearch={handleSearch}
          loading={loading}
        />

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <section className="results">
            <div className="market-availability-banner card">
              <strong>Mercado consultado internamente</strong>
              <p>
                {result.marketAvailability.listingsFound} listings com float compatível
                em {result.marketAvailability.skinsWithListings} skins de entrada
                {result.marketAvailability.liveListings > 0 && (
                  <>
                    {' '}
                    ({result.marketAvailability.liveListings} com float real via API)
                  </>
                )}
                . Nenhum redirecionamento — os contratos usam apenas skins verificadas.
              </p>
            </div>

            <div className="target-info card">
              <div className="target-info-content">
                <SkinImage
                  name={result.targetSkin.name}
                  rarity={result.targetSkin.rarity}
                  size="lg"
                  className="target-skin-img"
                />
                <div>
                  <h2>Skin Alvo</h2>
                  <p className="target-name">
                    {result.targetSkin.stattrak && 'StatTrak™ '}
                    {result.targetSkin.name}
                  </p>
                  <p className="target-collections">
                    Coleções possíveis: {result.collections.join(' • ')}
                  </p>
                  <InspectButton
                    params={{
                      skinName: result.targetSkin.name,
                      stattrak: searchParams?.stattrak ?? result.targetSkin.stattrak,
                      float: searchParams?.maxFloat ?? 0.07,
                      wear: searchParams?.wear ?? 'Factory New',
                    }}
                  />
                </div>
              </div>
            </div>

            <AIRecommendation
              recommendation={result.aiRecommendation}
              contracts={result.contracts}
            />

            <ContractComparison
              contracts={result.contracts}
              recommendedTier={result.aiRecommendation.recommendedTier}
            />

            <div className="contracts-grid">
              {result.contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onSimulate={(c, iterations) => tradeUpService.simulate(c, iterations)}
                  minLossAnalysis={contract.tier === 'min_loss' ? result.minLossAnalysis : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Preços via Steam Community Market (ByMykel tracker) • Múltiplos contratos gerados automaticamente</p>
      </footer>
    </div>
  );
}

export default App;
