import { describe, expect, it } from "vitest";
import { FLOW_DASH_STEPS, flowStep, flowWidth } from "./flow";

describe("flow line", () => {
  it("widens with the release and caps at 10 px", () => {
    expect([null, 0, -5, 35, 250, 1000, 5000].map(flowWidth)).toEqual([3, 3, 3, 4.5, 6.5, 10, 10]);
  });

  it("steps through the dash patterns and wraps", () => {
    expect(flowStep(0)).toBe(0);
    expect(flowStep(59)).toBe(0);
    expect(flowStep(60)).toBe(1);
    expect(flowStep(60 * FLOW_DASH_STEPS.length)).toBe(0);
  });

  it("keeps each dash pattern the same period", () => {
    for (const step of FLOW_DASH_STEPS) {
      expect(step.length).toBeGreaterThanOrEqual(3);
      expect(step.reduce((sum, value) => sum + value, 0)).toBe(7);
    }
  });
});
