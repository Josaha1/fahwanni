import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

it("is off (204) without a key and never calls Windy", async () => {
  vi.stubEnv("WINDY_WEBCAMS_KEY", "");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const response = await (await import("./route")).GET(new Request("http://x/api/webcams?lat=7.88&lon=98.39"));
  expect(response.status).toBe(204);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("sends the key as a header and keeps only active webcams with https image + page links", async () => {
  vi.stubEnv("WINDY_WEBCAMS_KEY", "test-key");
  const fetchMock = vi.fn(async () => Response.json({ webcams: [
    { webcamId: 1, title: "Patong Beach", status: "active", location: { city: "Patong", latitude: 7.89, longitude: 98.29 },
      images: { current: { preview: "https://images-webcams.windy.com/1/preview.jpg" } }, urls: { detail: "https://www.windy.com/webcams/1" } },
    { webcamId: 2, status: "inactive", location: { latitude: 7.9, longitude: 98.3 }, images: { current: { preview: "https://x/2.jpg" } }, urls: { detail: "https://x/2" } },
  ] }));
  vi.stubGlobal("fetch", fetchMock);
  const payload = await (await (await import("./route")).GET(new Request("http://x/api/webcams?lat=7.88&lon=98.39"))).json();
  expect(payload.webcams).toEqual([expect.objectContaining({ id: "1", title: "Patong Beach", page: "https://www.windy.com/webcams/1" })]);
  expect((fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1].headers["x-windy-api-key"]).toBe("test-key");
});
