export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

/** Cache em memória com TTL — fallback quando Redis indisponível */
export class MemoryCacheAdapter implements CacheAdapter {
  private store = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Factory: Redis se REDIS_URL disponível, senão memória */
export async function createCacheAdapter(): Promise<CacheAdapter> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return new MemoryCacheAdapter();
  }

  try {
    const { RedisCacheAdapter } = await import('./redis-cache.js');
    const adapter = new RedisCacheAdapter(redisUrl);
    await adapter.ping();
    return adapter;
  } catch {
    console.warn('[cache] Redis indisponível — usando fallback em memória');
    return new MemoryCacheAdapter();
  }
}
