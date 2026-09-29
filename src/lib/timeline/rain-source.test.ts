import { describe, expect, it } from "vitest";
import { rainSourceAt } from "./rain-source";
import { MINUTE } from "./time";

const now = Date.parse("2026-09-29T08:00:00Z");
const radarTimes = Array.from({ length: 6 }, (_, index) => now - (60 - index * 10) * MINUTE);

describe("rain source at the radar/model seam", () => {
  it("snaps five minutes before now to the newest radar frame", () => {
    expect(rainSourceAt(now - 5 * MINUTE, radarTimes, now))
      .toEqual({ kind: "radar", index: 5, frameTime: now - 10 * MINUTE });
  });

  it("selects the closest frame 37 minutes before now", () => {
    expect(rainSourceAt(now - 37 * MINUTE, radarTimes, now))
      .toEqual({ kind: "radar", index: 2, frameTime: now - 40 * MINUTE });
  });

  it("shows no rain source more than 30 minutes before the first frame", () => {
    expect(rainSourceAt(radarTimes[0] - 31 * MINUTE, radarTimes, now)).toEqual({ kind: "none" });
    expect(rainSourceAt(now - MINUTE, [], now)).toEqual({ kind: "none" });
  });

  it("blends the newest radar frame into the model over the first hour", () => {
    for (const [lead, radarOpacity, modelOpacity] of [
      [1, 0.7 - 0.5 / 45, 0],
      [15, 0.7 - 0.5 * 15 / 45, 0],
      [30, 0.7 - 0.5 * 30 / 45, 1 / 3],
      [45, 0.2, 2 / 3],
      [46, 0, 31 / 45],
      [60, 0, 1],
    ]) {
      const source = rainSourceAt(now + lead * MINUTE, radarTimes, now);
      expect(source.kind).toBe("blend");
      if (source.kind !== "blend") continue;
      expect(source.index).toBe(5);
      expect(source.frameTime).toBe(now - 10 * MINUTE);
      expect(source.radarOpacity).toBeCloseTo(radarOpacity);
      expect(source.modelOpacity).toBeCloseTo(modelOpacity);
    }
  });

  it("uses the model when there is no radar frame or the first hour has passed", () => {
    expect(rainSourceAt(now + MINUTE, [], now)).toEqual({ kind: "model" });
    expect(rainSourceAt(now + 61 * MINUTE, radarTimes, now)).toEqual({ kind: "model" });
  });

  it("uses radar exactly at now", () => {
    expect(rainSourceAt(now, radarTimes, now))
      .toEqual({ kind: "radar", index: 5, frameTime: now - 10 * MINUTE });
  });
});
