import type { FastifyInstance } from 'fastify';
import type { CacheAdapter } from '@ct/common';
import { createId } from '@ct/common';

export interface PriceAlert {
  id: string;
  skinId: string;
  skinName: string;
  minRoi: number;
  channel: 'webhook' | 'email';
  target?: string;
  active: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

const ALERTS_KEY = 'alerts:active';

async function loadAlerts(cache: CacheAdapter): Promise<PriceAlert[]> {
  return (await cache.get<PriceAlert[]>(ALERTS_KEY)) ?? [];
}

async function saveAlerts(cache: CacheAdapter, alerts: PriceAlert[]): Promise<void> {
  await cache.set(ALERTS_KEY, alerts, 0);
}

export async function registerAlertRoutes(
  app: FastifyInstance,
  getCache: () => Promise<CacheAdapter>,
): Promise<void> {
  app.get('/alerts', async () => {
    const cache = await getCache();
    const alerts = await loadAlerts(cache);
    return { items: alerts, total: alerts.length };
  });

  app.post('/alerts', async (req, reply) => {
    const body = req.body as {
      skinId: string;
      skinName: string;
      minRoi?: number;
      channel?: PriceAlert['channel'];
      target?: string;
    };

    if (!body.skinId || !body.skinName) {
      return reply.status(400).send({ error: 'skinId e skinName são obrigatórios' });
    }

    const cache = await getCache();
    const alerts = await loadAlerts(cache);
    const alert: PriceAlert = {
      id: createId('alert'),
      skinId: body.skinId,
      skinName: body.skinName,
      minRoi: body.minRoi ?? 5,
      channel: body.channel ?? 'webhook',
      target: body.target,
      active: true,
      createdAt: new Date().toISOString(),
    };

    alerts.push(alert);
    await saveAlerts(cache, alerts);
    return alert;
  });

  app.delete('/alerts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const cache = await getCache();
    const alerts = await loadAlerts(cache);
    const next = alerts.filter((a) => a.id !== id);
    if (next.length === alerts.length) {
      return reply.status(404).send({ error: 'Alerta não encontrado' });
    }
    await saveAlerts(cache, next);
    return { ok: true };
  });
}

/** Verifica alertas contra oportunidades e dispara os que atingiram minRoi. */
export async function evaluateAlerts(
  cache: CacheAdapter,
  opportunities: Array<{ targetSkinId: string; roi: number }>,
): Promise<PriceAlert[]> {
  const alerts = await loadAlerts(cache);
  const triggered: PriceAlert[] = [];
  const now = new Date().toISOString();

  for (const alert of alerts) {
    if (!alert.active) continue;
    const match = opportunities.find((o) => o.targetSkinId === alert.skinId);
    if (match && match.roi >= alert.minRoi) {
      alert.lastTriggeredAt = now;
      triggered.push(alert);

      if (alert.channel === 'webhook' && alert.target) {
        try {
          await fetch(alert.target, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alertId: alert.id,
              skinId: alert.skinId,
              skinName: alert.skinName,
              roi: match.roi,
              minRoi: alert.minRoi,
              triggeredAt: now,
            }),
          });
        } catch {
          /* webhook opcional */
        }
      }
    }
  }

  if (triggered.length > 0) {
    await saveAlerts(cache, alerts);
  }

  return triggered;
}
