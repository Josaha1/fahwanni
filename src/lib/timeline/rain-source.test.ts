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

  it("uses model after now and radar exactly at now", () => {
    expect(rainSourceAt(now + 45 * MINUTE, radarTimes, now)).toEqual({ kind: "model" });
    expect(rainSourceAt(now, radarTimes, now))
      .toEqual({ kind: "radar", index: 5, frameTime: now - 10 * MINUTE });
  });
});
