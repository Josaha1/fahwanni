import { afterEach, expect, it, vi } from "vitest";
import fixture from "./fixture-rid.json";
import { fetchDams } from "./client";

afterEach(() => vi.useRealTimers());

it("fetches the RID large-dam report and marks it stale after 36 h", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${fixture.date}T11:59:00+07:00`));
  const fetchImpl = vi.fn(async () => Response.json(fixture));

  const payload = await fetchDams(fetchImpl as typeof fetch);

  expect(fetchImpl).toHaveBeenCalledOnce();
  expect(fetchImpl).toHaveBeenCalledWith("https://app.rid.go.th/reservoir/api/dam/public",
    { next: { revalidate: 3600 }, signal: expect.any(AbortSignal) });
  expect(payload).toMatchObject({ dataDate: fixture.date, stale: false });
  expect(payload?.dams).toHaveLength(35);

  vi.setSystemTime(new Date(Date.parse(`${fixture.date}T00:00:00+07:00`) + 36 * 3_600_000 + 1000));
  expect((await fetchDams(fetchImpl as typeof fetch))?.stale).toBe(true);
});

it("returns null on a 429, malformed response, or no known dams", async () => {
  for (const response of [
    new Response(null, { status: 429 }),
    Response.json("garbage"),
    Response.json({ date: "2026-09-29", data: [] }),
  ]) {
    const fetchImpl = vi.fn(async () => response);
    await expect(fetchDams(fetchImpl as typeof fetch)).resolves.toBeNull();
  }
});
