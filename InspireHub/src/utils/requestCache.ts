interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pending = new Map<string, Promise<unknown>>();

  /**
   * Get cached data, returns null if expired or missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Set cache with TTL in seconds
   */
  set<T>(key: string, data: T, ttl = 30): void {
    this.cache.set(key, { data, expiry: Date.now() + ttl * 1000 });
  }

  /**
   * Deduplicate: if same request is in-flight, reuse its Promise
   */
  async dedupe<T>(key: string, fetcher: () => Promise<T>, ttl = 30): Promise<T> {
    // Return cached data if available
    const cached = this.get<T>(key);
    if (cached) return cached;

    // If same request is already in-flight, reuse it
    const pendingReq = this.pending.get(key);
    if (pendingReq) return pendingReq as Promise<T>;

    // Fire new request
    const promise = fetcher()
      .then((data) => {
        this.set(key, data, ttl);
        return data;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Invalidate by exact key or prefix pattern
   */
  invalidate(keyOrPrefix: string): void {
    if (this.cache.has(keyOrPrefix)) {
      this.cache.delete(keyOrPrefix);
      return;
    }
    // Prefix match
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

const requestCache = new RequestCache();
export default requestCache;
