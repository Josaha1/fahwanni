import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixture-rainviewer.json";
import { fetchRadar } from "./client";

const newest = fixture.radar.past[fixture.radar.past.length - 1].time;
const manifestAt = (time: number) => ({
  ...fixture,
  radar: { past: fixture.radar.past.map((frame) => ({ ...frame, time: frame.time + time - newest })) },
});

afterEach(() => vi.useRealTimers());

describe("fetchRadar", () => {
  it("fetches a fresh RainViewer manifest once with an 8-second timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime((newest + 5 * 60) * 1000);
    const fetchImpl = vi.fn(async () => Response.json(fixture));
    const result = await fetchRadar(fetchImpl as typeof fetch, Date.now);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith("https://api.rainviewer.com/public/weather-maps.json", {
      next: { revalidate: 300 }, signal: expect.any(AbortSignal),
    });
    expect(result).toMatchObject({ provider: "rainviewer", stale: false });
  });

  it("refetches a 25-minute-old manifest and keeps the newer frames", async () => {
    vi.useFakeTimers();
    vi.setSystemTime((newest + 25 * 60) * 1000);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json(fixture))
      .mockResolvedValueOnce(Response.json(manifestAt(newest + 20 * 60)));

    const result = await fetchRadar(fetchImpl as typeof fetch, Date.now);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://api.rainviewer.com/public/weather-maps.json", {
      cache: "no-store", signal: expect.any(AbortSignal),
    });
    expect(result.frames.at(-1)?.time).toBe(new Date((newest + 20 * 60) * 1000).toISOString());
    expect(result.stale).toBe(false);
  });

  it("keeps the first manifest when the refetch has older frames", async () => {
    vi.useFakeTimers();
    vi.setSystemTime((newest + 25 * 60) * 1000);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json(fixture))
      .mockResolvedValueOnce(Response.json(manifestAt(newest - 5 * 60)));

    const result = await fetchRadar(fetchImpl as typeof fetch, Date.now);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.frames.at(-1)?.time).toBe(new Date(newest * 1000).toISOString());
    expect(result.stale).toBe(false);
  });

  it("refetches when the cached response is not a RainViewer manifest", async () => {
    vi.useFakeTimers();
    vi.setSystemTime((newest + 5 * 60) * 1000);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ invalid: true }))
      .mockResolvedValueOnce(Response.json(fixture));

    const result = await fetchRadar(fetchImpl as typeof fetch, Date.now);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ provider: "rainviewer", stale: false });
  });

  it("uses the first manifest when the second fetch fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime((newest + 40 * 60) * 1000);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json(fixture))
      .mockRejectedValueOnce(new Error("offline"));

    const result = await fetchRadar(fetchImpl as typeof fetch, Date.now);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.frames.at(-1)?.time).toBe(new Date(newest * 1000).toISOString());
    expect(result.stale).toBe(true);
  });

  it("marks the result stale when both responses are over 30 minutes old", async () => {
    vi.useFakeTimers();
    vi.setSystemTime((newest + 40 * 60) * 1000);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json(fixture))
      .mockResolvedValueOnce(Response.json(manifestAt(newest + 5 * 60)));

    const result = await fetchRadar(fetchImpl as typeof fetch, Date.now);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.frames.at(-1)?.time).toBe(new Date((newest + 5 * 60) * 1000).toISOString());
    expect(result.stale).toBe(true);
  });

  it.each([
    vi.fn(async () => { throw new Error("offline"); }),
    vi.fn(async () => new Response(null, { status: 503 })),
    vi.fn(async () => Response.json({ invalid: true })),
  ])("returns an empty manifest when the source fails", async (fetchImpl) => {
    await expect(fetchRadar(fetchImpl as typeof fetch)).resolves.toMatchObject({
      provider: "none", frames: [], satellite: [],
    });
  });
});
