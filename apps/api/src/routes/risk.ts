import type { FastifyInstance } from 'fastify';
import type { TradeUpContract } from '@ct/types';
import { analyzeScenarios, calculateEVMetrics } from '@ct/engine';

export async function registerRiskRoutes(app: FastifyInstance): Promise<void> {
  app.post('/risk', async (req, reply) => {
    const body = req.body as { contract?: TradeUpContract };

    if (!body.contract?.outputs?.length) {
      return reply.status(400).send({
        error: 'Envie { contract: TradeUpContract } com outputs calculados',
      });
    }

    const { contract } = body;
    const totalCost = contract.evMetrics?.totalCost ??
      contract.inputs.reduce((s, i) => s + i.listing.price, 0);

    const targetId =
      contract.outputs.find((o) => o.isTarget)?.item.id ??
      contract.outputs[0].item.id;

    const evMetrics = calculateEVMetrics(contract.outputs, totalCost, targetId);
    const scenarios = analyzeScenarios(contract.outputs, totalCost);

    return {
      riskScore: evMetrics.riskScore,
      sharpeRatio: evMetrics.sharpeRatio,
      standardDeviation: evMetrics.standardDeviation,
      lossChance: evMetrics.lossChance,
      breakEvenChance: evMetrics.breakEvenChance,
      worstCase: scenarios.worstCase,
      bestCase: scenarios.bestCase,
      evMetrics,
    };
  });
}
