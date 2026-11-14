// Tiny in-memory TTL cache with request de-duplication.
// Protects your free API quotas: identical calls within the TTL hit memory, not the API.
type Entry<T> = { value: T; expires: number };

const g = globalThis as unknown as {
  __kickvoltCache?: Map<string, Entry<unknown>>;
  __kickvoltInflight?: Map<string, Promise<unknown>>;
};
const store = (g.__kickvoltCache ??= new Map());
const inflight = (g.__kickvoltInflight ??= new Map());

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
