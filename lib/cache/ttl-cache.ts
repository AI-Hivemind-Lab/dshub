export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();

  constructor(
    private ttlMs: number,
    private now: () => number = Date.now,
    private maxEntries = 1000,
  ) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry || entry.expires <= this.now()) return undefined;
    return entry.value;
  }

  /** Returns the value even if expired (used to serve stale data on errors). */
  peek(key: string): V | undefined {
    return this.store.get(key)?.value;
  }

  set(key: string, value: V): void {
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: this.now() + this.ttlMs });
  }
}
