import type { WeatherSnapshot } from "./types";

const FRESH_MS = 10 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

export class WeatherCache<T = WeatherSnapshot> {
  private readonly entries = new Map<string, { snapshot: T; storedAt: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 200,
    private readonly freshMs = FRESH_MS,
  ) {}

  getFresh(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry && this.now() - entry.storedAt < this.freshMs ? entry.snapshot : undefined;
  }

  getStale(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry && this.now() - entry.storedAt < STALE_MS ? entry.snapshot : undefined;
  }

  set(key: string, snapshot: T): void {
    this.entries.delete(key);
    this.entries.set(key, { snapshot, storedAt: this.now() });
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }
}
