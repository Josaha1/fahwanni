import { expect, it, vi } from "vitest";
import { fetchStorms } from "./client";
import type { StormSnapshot } from "./client";
import { GET } from "../../app/api/storms/route";

vi.mock("./client", () => ({ fetchStorms: vi.fn() }));

it("returns and caches an inactive storm response for 15 minutes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const empty: StormSnapshot = { active: false, storms: [], sources: { jma: "ok", gdacs: "ok" }, updatedAt: "2026-09-28T06:00:00Z" };
  vi.mocked(fetchStorms).mockResolvedValue(empty);
  try {
    const first = await GET();
    expect(await first.json()).toEqual(empty);
    expect(first.headers.get("Cache-Control")).toBe("public, s-maxage=900, stale-while-revalidate=1800");
    vi.setSystemTime(15 * 60 * 1000 - 1);
    await GET();
    expect(fetchStorms).toHaveBeenCalledOnce();
    vi.setSystemTime(15 * 60 * 1000);
    await GET();
    expect(fetchStorms).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
