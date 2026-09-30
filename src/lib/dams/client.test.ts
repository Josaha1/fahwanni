import { afterEach, expect, it, vi } from "vitest";
import fixture from "./fixture-rid.json";
import { fetchDams } from "./client";

afterEach(() => vi.useRealTimers());

const partialToday = {
  ...fixture,
  date: "2026-09-30",
  data: fixture.data.map((group) => ({
    ...group,
    dam: group.dam.map((dam) => {
      const index = fixture.data.flatMap(({ dam }) => dam).findIndex(({ id }) => id === dam.id);
      return index < 24 ? { ...dam, volume: null, percent_storage: null } :
        dam.id === "100505" ? { ...dam, volume: dam.volume + 1 } : dam;
    }),
  })),
};

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

it("fills missing registered dams from yesterday while retaining today's values and report date", async () => {
  const fetchImpl = vi.fn(async (url: string) => Response.json(url.endsWith("/2026-09-29") ? fixture : partialToday));

  const payload = await fetchDams(fetchImpl as typeof fetch);

  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://app.rid.go.th/reservoir/api/dam/public/2026-09-29",
    { next: { revalidate: 3600 }, signal: expect.any(AbortSignal) });
  expect(payload?.dataDate).toBe("2026-09-30");
  expect(payload?.dams).toHaveLength(35);
  expect(payload?.dams.filter(({ date }) => date === "2026-09-29")).toHaveLength(24);
  expect(payload?.dams.filter(({ date }) => date === "2026-09-30")).toHaveLength(11);
  expect(payload?.dams.find(({ id }) => id === "200101")?.date).toBe("2026-09-29");
  expect(payload?.dams.find(({ id }) => id === "100505")).toMatchObject({
    date: "2026-09-30", storageMcm: 339,
  });
});

it("keeps today's dams when yesterday's request fails", async () => {
  const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json(partialToday)).mockRejectedValueOnce(new Error("offline"));

  const payload = await fetchDams(fetchImpl as typeof fetch);

  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(payload?.dataDate).toBe("2026-09-30");
  expect(payload?.dams).toHaveLength(11);
  expect(payload?.dams.every(({ date }) => date === "2026-09-30")).toBe(true);
});

it("does not use a report older than yesterday", async () => {
  const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json(partialToday))
    .mockResolvedValueOnce(Response.json({ ...fixture, date: "2026-09-28" }));

  const payload = await fetchDams(fetchImpl as typeof fetch);

  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(payload?.dams).toHaveLength(11);
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
