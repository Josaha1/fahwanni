import { afterEach, expect, it, vi } from "vitest";
import fixture from "@/lib/dams/fixture-dwr.json";

const scheduled = vi.hoisted(() => [] as Array<() => unknown>);
const rid = vi.hoisted(() => ({ dams: [] as { lat: number; lon: number; nameTh?: string }[] }));
vi.mock("next/server", () => ({ after: (task: () => unknown) => { scheduled.push(task); } }));
const net = vi.hoisted(() => ({ get: (async () => { throw new Error("unset"); }) as (url: string) => Promise<unknown>, calls: 0 }));
vi.mock("@/lib/dams/client", () => ({ fetchDams: async () => ({ dams: rid.dams }) }));
vi.mock("@/lib/net/fetch-json-with-ca", () => ({ fetchJsonWithCa: (url: string) => { net.calls++; return net.get(url); } }));

const bodies: Record<string, unknown> = {
  MediumSizeWaterResourcesInfo: fixture.medium.info, MediumSizeWaterResources: fixture.medium.obs,
  SmallSizeWaterResourcesInfo: fixture.small.info, SmallSizeWaterResources: fixture.small.obs,
};

afterEach(() => { vi.resetModules(); scheduled.length = 0; rid.dams = []; net.calls = 0; });

it("serves DWR reservoirs with attribution and drops only same-named places within 2 km of an RID dam", async () => {
  net.get = async (url) => bodies[url.split("/").pop()!];
  const first = fixture.medium.info.waterResources[0].waterResourcesMetadata;
  const second = fixture.medium.info.waterResources[1].waterResourcesMetadata;
  rid.dams = [
    { lat: first.latitude + 0.005, lon: first.longitude, nameTh: first.waterResourcesName },
    // close by but a different name: kept
    { lat: second.latitude + 0.005, lon: second.longitude, nameTh: "เขื่อนอื่น" },
  ];
  const response = await (await import("./route")).GET();
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.source).toBe("กรมทรัพยากรน้ำ (DWR) open data · CC BY");
  expect(payload.reservoirs.some((item: { code: string }) => item.code === first.waterResourcesCode)).toBe(false);
  expect(payload.reservoirs.some((item: { code: string }) => item.code === second.waterResourcesCode)).toBe(true);
  expect(payload.reservoirs.length).toBe(fixture.medium.info.waterResources.length + fixture.small.info.waterResources.length - 1);
  expect(net.calls).toBe(4);
});

it("returns 503 no-store when DWR fails and nothing is cached", async () => {
  net.get = async () => { throw new Error("HTTP 502"); };
  const response = await (await import("./route")).GET();
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
