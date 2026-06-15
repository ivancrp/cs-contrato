import type { CacheAdapter } from './cache-adapter.js';

/** Cliente Redis minimalista via REST (Upstash) ou TCP */
export class RedisCacheAdapter implements CacheAdapter {
  private client: RedisClient;

  constructor(url: string) {
    this.client = createRedisClient(url);
  }

  async ping(): Promise<void> {
    await this.client.ping();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }
}

interface RedisClient {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<number>;
}

function createRedisClient(url: string): RedisClient {
  if (url.startsWith('https://')) {
    return createUpstashClient(url);
  }
  return createTcpRedisClient(url);
}

/** Upstash REST API */
function createUpstashClient(baseUrl: string): RedisClient {
  const token = process.env.REDIS_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

  async function command<T>(cmd: string[]): Promise<T> {
    const res = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`Redis command failed: ${res.status}`);
    const data = (await res.json()) as { result: T };
    return data.result;
  }

  return {
    ping: () => command<string>(['PING']),
    get: (key) => command<string | null>(['GET', key]),
    set: async (key, value) => { await command(['SET', key, value]); },
    setex: async (key, ttl, value) => { await command(['SETEX', key, String(ttl), value]); },
    del: async (key) => { await command(['DEL', key]); },
    exists: (key) => command<number>(['EXISTS', key]),
  };
}

/** TCP Redis via ioredis-like minimal — lazy import */
function createTcpRedisClient(_url: string): RedisClient {
  throw new Error(
    'TCP Redis requer REDIS_URL Upstash REST ou configure REDIS_URL=https://...',
  );
}
