import { describe, expect, it } from "vitest";
import fixture from "./fixture-rainviewer.json";
import { toManifest } from "./rainviewer";

describe("toManifest", () => {
  it("converts the captured response into the latest 12 sorted radar frames", () => {
    const raw = structuredClone(fixture);
    raw.radar.past.reverse();
    const manifest = toManifest(raw);

    expect(manifest.provider).toBe("rainviewer");
    expect(manifest.generatedAt).toBe(new Date(fixture.generated * 1000).toISOString());
    expect(manifest.frames).toHaveLength(12);
    expect(manifest.frames[0]).toEqual({
      time: new Date(1790570400 * 1000).toISOString(),
      tileUrl: "https://tilecache.rainviewer.com/v2/radar/e9ba302ead93/256/{z}/{x}/{y}/2/1_1.png",
    });
    expect(manifest.frames.at(-1)?.time).toBe(new Date(1790577000 * 1000).toISOString());
    expect(manifest.satellite).toEqual([]);
    expect(manifest.maxZoom).toBe(7);
    expect(manifest.attribution).toEqual({ text: "Weather data by RainViewer", url: "https://www.rainviewer.com" });
  });

  it("uses the infrared tile template when satellite frames are available", () => {
    expect(toManifest({ ...fixture, satellite: { infrared: [{ time: 1790577000, path: "/v2/satellite/example" }] } }).satellite).toEqual([{
      time: new Date(1790577000 * 1000).toISOString(),
      tileUrl: "https://tilecache.rainviewer.com/v2/satellite/example/256/{z}/{x}/{y}/0/0_0.png",
    }]);
  });

  it("returns an empty provider for malformed responses", () => {
    expect(toManifest({ host: "invalid", radar: { past: [{}] } })).toMatchObject({
      provider: "none", frames: [], satellite: [],
    });
  });
});
