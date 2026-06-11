import { useEffect, useState } from 'react';
import { AIRecommendation } from './components/AIRecommendation';
import { priceService } from './services/priceService';
import { skinImageService } from './services/skinImageService';
import { skinMetadataService } from './services/skinMetadataService';
import { catalogStore } from './data/catalogStore';
import { InspectButton } from './components/InspectButton';
import { ContractCard } from './components/ContractCard';
import { ContractComparison } from './components/ContractComparison';
import { SearchForm } from './components/SearchForm';
import { SkinImage } from './components/SkinImage';
import type { TargetSearchParams, TradeUpContract } from './models/types';
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
  const [bestContract, setBestContract] = useState<TradeUpContract | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (params: TargetSearchParams) => {
    setLoading(true);
    setError(null);
    setBestContract(null);
    setSearchParams(params);
    try {
      const res = await tradeUpService.search(params);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular contratos');
    } finally {
      setLoading(false);
    }
  };

  const handleFindBest = async (params: TargetSearchParams) => {
    setLoading(true);
    setError(null);
    setSearchParams(params);
    try {
      const best = await tradeUpService.findBest(params);
      setBestContract(best);
      if (!result) {
        const res = await tradeUpService.search(params);
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao encontrar melhor contrato');
    } finally {
      setLoading(false);
    }
  };

  const allContracts = [
    ...(result?.contracts ?? []),
    ...(bestContract ? [bestContract] : []),
    ...(result?.minLossContract ? [result.minLossContract] : []),
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>
            <span className="logo">⚡</span>
            CS2 Trade Up Optimizer
          </h1>
          <p>Calcule o melhor contrato de troca com EV, float e otimização IA</p>
        </div>
      </header>

      <main className="main">
        <SearchForm
          onSearch={handleSearch}
          onFindBest={handleFindBest}
          onSearchSkins={(q, st) => tradeUpService.searchSkins(q, st)}
          loading={loading}
        />

        {error && <div className="error-banner">{error}</div>}

        {result && (
          <section className="results">
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
              {allContracts.map((contract) => (
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
        <p>Preços via Steam Community Market (ByMykel tracker) • Otimização IA com 3 estratégias distintas</p>
      </footer>
    </div>
  );
}

export default App;
