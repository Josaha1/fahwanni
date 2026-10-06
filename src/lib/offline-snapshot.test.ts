import { describe, expect, it, vi } from "vitest";
import { oldestCachedAt, reportCached, subscribeCached } from "./offline-snapshot";

describe("offline snapshot", () => {
  it("reports the oldest saved time and clears it when a source is live again", () => {
    const listener = vi.fn();
    const stop = subscribeCached(listener);
    reportCached("/api/dams", "2026-10-06T01:00:00.000Z");
    reportCached("/api/flood-now", "2026-10-05T23:00:00.000Z");
    expect(oldestCachedAt()).toBe("2026-10-05T23:00:00.000Z");
    reportCached("/api/flood-now", null);
    expect(oldestCachedAt()).toBe("2026-10-06T01:00:00.000Z");
    reportCached("/api/dams", "not a date");
    expect(oldestCachedAt()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(4);
    stop();
  });
});
