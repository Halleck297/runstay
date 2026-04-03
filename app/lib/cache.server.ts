/**
 * Simple in-memory cache with TTL for server-side use.
 *
 * Stores values in process memory — resets on deploy/restart.
 * Good for data that changes rarely (events list, FX rates, etc.).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get a value from cache, or compute and store it if missing/expired.
 *
 * @param key       Unique cache key
 * @param ttlMs     Time-to-live in milliseconds
 * @param compute   Async function to produce the value on cache miss
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.data;
  }

  const data = await compute();
  store.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Manually invalidate a cache entry (e.g. after admin creates a new event).
 */
export function invalidateCache(key: string) {
  store.delete(key);
}

/**
 * Invalidate all entries matching a prefix (e.g. "events:" clears all event caches).
 */
export function invalidateCacheByPrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}
