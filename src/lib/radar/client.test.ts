import { describe, expect, it, vi } from "vitest";
import fixture from "./fixture-rainviewer.json";
import { fetchRadar } from "./client";

describe("fetchRadar", () => {
  it("fetches the RainViewer manifest with an 8-second timeout", async () => {
    const fetchImpl = vi.fn(async () => Response.json(fixture));
    const result = await fetchRadar(fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.rainviewer.com/public/weather-maps.json", {
      next: { revalidate: 300 }, signal: expect.any(AbortSignal),
    });
    expect(result.provider).toBe("rainviewer");
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
