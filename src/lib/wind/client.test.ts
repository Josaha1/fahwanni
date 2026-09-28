import { expect, it, vi } from "vitest";
import { fetchWindGrid } from "./client";

it("returns null on a 429 without caching the error", async () => {
  const fetchImpl = vi.fn(async (...args: Parameters<typeof fetch>) => {
    expect(args[1]).toMatchObject({ next: { revalidate: 10800 }, signal: expect.any(AbortSignal) });
    expect(args[1]).not.toHaveProperty("cache", "no-store");
    return new Response(null, { status: 429 });
  });

  await expect(fetchWindGrid(fetchImpl as typeof fetch)).resolves.toBeNull();
  expect(fetchImpl).toHaveBeenCalled();
});
