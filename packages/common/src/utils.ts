/** Memoization simples com TTL opcional */
export function memoizeAsync<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyFn: (...args: TArgs) => string,
  ttlMs = 60_000,
): (...args: TArgs) => Promise<TResult> {
  const cache = new Map<string, { value: TResult; expiresAt: number }>();

  return async (...args: TArgs): Promise<TResult> => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    const value = await fn(...args);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
