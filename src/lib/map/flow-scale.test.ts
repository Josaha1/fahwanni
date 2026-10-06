import { describe, expect, it } from "vitest";
import { flowBucket, flowColorRole, flowWidth } from "./flow-scale";

describe("flow scale", () => {
  it("uses a bounded logarithmic width with the specified endpoints", () => {
    expect(flowWidth(0)).toBe(1);
    expect(flowWidth(2000)).toBe(8);
    expect(flowWidth(4000)).toBe(8);
    expect(flowWidth(100)).toBeCloseTo(1 + 7 * Math.log1p(100) / Math.log1p(2000));
    const widths = [0, 1, 50, 100, 200, 1000, 2000].map(flowWidth);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });

  it("keeps an unreported release distinct from a reported zero", () => {
    expect(flowWidth(null)).toBe(1);
    expect(flowColorRole(null)).toBe("nodata");
    expect(flowColorRole(0)).toBe("water");
    expect(flowBucket(null)).toBe("none");
    expect(flowBucket(0)).toBe("none");
  });

  it.each([[99.9, "water"], [100, "release"], [2000, "release"]] as const)("colours %s as %s", (release, role) => {
    expect(flowColorRole(release)).toBe(role);
  });

  it.each([[0, "none"], [0.1, "slow"], [49.9, "slow"], [50, "mid"], [199.9, "mid"], [200, "fast"]] as const)("buckets %s as %s", (release, bucket) => {
    expect(flowBucket(release)).toBe(bucket);
  });
});
