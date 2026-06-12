import type { OptimizationMode, TradeUpContract } from '../models/types';
import { formatCurrency, formatPercent } from '../utils/format';

export interface TierInsight {
  tier: TradeUpContract['tier'];
  title: string;
  reason: string;
  pros: string[];
  cons: string[];
  score: number;
}

export interface AIRecommendation {
  recommendedTier: TradeUpContract['tier'];
  recommendedLabel: string;
  summary: string;
  tierInsights: TierInsight[];
}

const TIER_LABELS: Record<string, string> = {
  budget: '$ Menor custo',
  one_target: '◎ 1 skin da coleção alvo',
  float_safe: '◎ Float ideal (econômico)',
  balanced: '$$ Equilibrado',
  premium: '$$$ Maior chance',
  target_60: '🎯 60% chance no alvo',
};

/**
 * Motor de recomendação IA — analisa métricas e sugere o melhor tier.
 */
export function generateAIRecommendation(
  contracts: TradeUpContract[],
): AIRecommendation {
  const tiers = contracts.filter((c) =>
    ['budget', 'one_target', 'float_safe', 'balanced', 'premium', 'target_60'].includes(c.tier),
  );
  const referenceBudget = Math.max(
    ...contracts.map((contract) => contract.evMetrics.totalCost),
    1,
  );

  const tierInsights = tiers.map((c) => buildTierInsight(c, referenceBudget));
  const ranked = [...tierInsights].sort((a, b) => b.score - a.score);

  const weights = MODE_WEIGHTS.balanced;
  const scored = tiers.map((c) => ({
    contract: c,
    score: computeTierScore(c, referenceBudget, weights),
  }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0]?.contract ?? tiers[0];
  const recommendedTier = best?.tier ?? 'balanced';

  const summary = buildSummary(best, tiers, referenceBudget);

  return {
    recommendedTier,
    recommendedLabel: TIER_LABELS[recommendedTier] ?? best?.tierLabel ?? '',
    summary,
    tierInsights: ranked,
  };
}

function buildTierInsight(contract: TradeUpContract, budget: number): TierInsight {
  const { evMetrics: ev, floatMetrics: fl } = contract;
  const pros: string[] = [];
  const cons: string[] = [];

  if (ev.totalCost <= budget * 0.6) {
    pros.push(`Custo baixo (${formatCurrency(ev.totalCost)}) — sobra margem no orçamento`);
  } else if (ev.totalCost <= budget) {
    pros.push(`Dentro do orçamento de ${formatCurrency(budget)}`);
  } else {
    cons.push(`Excede o orçamento em ${formatCurrency(ev.totalCost - budget)}`);
  }

  if (ev.targetChance >= 0.7) {
    pros.push(`Alta chance de drop (${formatPercent(ev.targetChance * 100)})`);
  } else if (ev.targetChance >= 0.4) {
    pros.push(`Chance moderada (${formatPercent(ev.targetChance * 100)})`);
  } else {
    cons.push(`Chance baixa (${formatPercent(ev.targetChance * 100)}) — mais arriscado`);
  }

  if (ev.roi > 0) {
    pros.push(`ROI positivo (${formatPercent(ev.roi)})`);
  } else {
    cons.push(`ROI negativo (${formatPercent(ev.roi)}) — perda esperada`);
  }

  if (fl.expectedOutputFloat <= 0.07) {
    pros.push('Float esperado em Factory New');
  }

  if (ev.riskScore > 50) {
    cons.push(`Risco elevado (score ${ev.riskScore.toFixed(0)})`);
  } else {
    pros.push(`Risco controlado (score ${ev.riskScore.toFixed(0)})`);
  }

  const titles: Record<string, string> = {
    budget: 'Economia máxima',
    balanced: 'Equilíbrio custo/chance',
    premium: 'Máxima chance de sucesso',
    target_60: 'Alta chance na skin alvo',
  };

  const reasons: Record<string, string> = {
    budget: 'Prioriza skins baratas de múltiplas coleções para minimizar investimento.',
    balanced: 'Combina custo moderado com boa probabilidade de obter a skin alvo.',
    premium: 'Investe mais em skins da coleção alvo para maximizar a chance de drop.',
    target_60: 'Concentra entradas na coleção com melhor odds para atingir pelo menos 60% na skin alvo.',
  };

  return {
    tier: contract.tier,
    title: titles[contract.tier] ?? contract.tierLabel,
    reason: reasons[contract.tier] ?? '',
    pros,
    cons,
    score: contract.aiScore,
  };
}

function computeTierScore(
  contract: TradeUpContract,
  budget: number,
  weights: { ev: number; chance: number; cost: number; risk: number },
): number {
  const ev = contract.evMetrics;
  const budgetFit = ev.totalCost <= budget ? 1 : Math.max(0, 1 - (ev.totalCost - budget) / budget);
  const roiNorm = Math.min(Math.max(ev.roi, -1), 1) * 0.5 + 0.5;

  return (
    weights.ev * roiNorm +
    weights.chance * ev.targetChance +
    weights.cost * budgetFit +
    weights.risk * (1 - ev.riskScore / 100)
  );
}

function buildSummary(
  best: TradeUpContract | undefined,
  all: TradeUpContract[],
  referenceBudget: number,
): string {
  if (!best) return 'Não foi possível gerar recomendação.';

  const cheapest = [...all].sort((a, b) => a.evMetrics.totalCost - b.evMetrics.totalCost)[0];
  const highestProfitChance = [...all].sort(
    (a, b) => b.evMetrics.breakEvenChance - a.evMetrics.breakEvenChance,
  )[0];
  const highestChance = [...all].sort((a, b) => b.evMetrics.targetChance - a.evMetrics.targetChance)[0];

  let extra = '';
  if (best.tier === 'budget' && cheapest) {
    extra = ` Economiza até ${formatCurrency(
      (highestChance?.evMetrics.totalCost ?? best.evMetrics.totalCost) - cheapest.evMetrics.totalCost,
    )} vs. o tier premium.`;
  } else if (best.tier === 'premium' && highestChance) {
    extra = ` Chance de ${formatPercent(highestChance.evMetrics.targetChance * 100)} na skin alvo.`;
  }

  if (highestProfitChance && highestProfitChance.id !== best.id) {
    extra += ` Maior chance de lucro: ${formatPercent(highestProfitChance.evMetrics.breakEvenChance * 100)}.`;
  }

  return (
    `Com base em ${all.length} contratos analisados (referência ${formatCurrency(referenceBudget)}), ` +
    `recomendamos **${TIER_LABELS[best.tier]}**. ` +
    `Custo ${formatCurrency(best.evMetrics.totalCost)}, ` +
    `chance de lucro ${formatPercent(best.evMetrics.breakEvenChance * 100)}, ` +
    `chance alvo ${formatPercent(best.evMetrics.targetChance * 100)}, ` +
    `ROI ${formatPercent(best.evMetrics.roi)}.${extra}`
  ).replace(/\*\*/g, '');
}

const MODE_WEIGHTS: Record<OptimizationMode, { ev: number; chance: number; cost: number; risk: number }> = {
  low_cost: { ev: 0.1, chance: 0.2, cost: 0.5, risk: 0.2 },
  balanced: { ev: 0.25, chance: 0.3, cost: 0.25, risk: 0.2 },
  high_chance: { ev: 0.2, chance: 0.45, cost: 0.15, risk: 0.2 },
  min_loss: { ev: 0.15, chance: 0.1, cost: 0.15, risk: 0.6 },
};
