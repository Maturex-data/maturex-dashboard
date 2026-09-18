export interface EtsyTableResponse {
  rows: Array<Record<string, unknown> & { id: string | number }>;
  total: number;
  totalPages: number;
  availableMonths: string[];
}

const MAX_CACHE_ENTRIES = 30;
const cache = new Map<string, EtsyTableResponse>();

export function getEtsyTableCache(key: string): EtsyTableResponse | undefined {
  const value = cache.get(key);
  if (!value) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function setEtsyTableCache(key: string, value: EtsyTableResponse): void {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function invalidateEtsyTableCache(): void {
  cache.clear();
}
