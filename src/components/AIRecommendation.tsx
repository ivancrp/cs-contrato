import type { AIRecommendation as AIRec } from '../services/aiAdvisor';
import { ScoreStars } from './ScoreStars';

interface AIRecommendationProps {
  recommendation: AIRec;
  contracts: { tier: string; tierLabel: string; aiScore: number }[];
}

export function AIRecommendation({ recommendation, contracts }: AIRecommendationProps) {
  const recommended = contracts.find((c) => c.tier === recommendation.recommendedTier);

  return (
    <div className="ai-recommendation card">
      <div className="ai-recommendation-header">
        <span className="ai-badge">IA</span>
        <h2>Recomendação Inteligente</h2>
      </div>

      <div className="ai-recommendation-main">
        <div className="ai-recommended-tier">
          <span className="ai-tier-label">{recommendation.recommendedLabel}</span>
          {recommended && <ScoreStars score={recommended.aiScore} />}
        </div>
        <p className="ai-summary">{recommendation.summary}</p>
      </div>

      <div className="ai-insights-grid">
        {recommendation.tierInsights.map((insight) => (
          <div
            key={insight.tier}
            className={`ai-insight-card ${insight.tier === recommendation.recommendedTier ? 'recommended' : ''}`}
          >
            <div className="ai-insight-header">
              <strong>{TIER_LABELS[insight.tier] ?? insight.title}</strong>
              {insight.tier === recommendation.recommendedTier && (
                <span className="ai-pick-badge">Escolha IA</span>
              )}
            </div>
            <p className="ai-insight-reason">{insight.reason}</p>
            {insight.pros.length > 0 && (
              <ul className="ai-pros">
                {insight.pros.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {insight.cons.length > 0 && (
              <ul className="ai-cons">
                {insight.cons.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TIER_LABELS: Record<string, string> = {
  budget: '$ Menor custo',
  one_target: '◎ 1 skin da coleção alvo',
  float_safe: '◎ Float ideal (econômico)',
  balanced: '$$ Equilibrado',
  premium: '$$$ Maior chance',
};
