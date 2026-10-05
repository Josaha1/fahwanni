import { describe, expect, it } from "vitest";
import { cappedDpr, sampleFrame, scissorRects, shouldRender } from "./scene-logic";
import { writeSceneState } from "./scene-state";

describe("render demand", () => {
  it("requires visibility and dirtiness or full-tier animation", () => {
    for (const tier of ["full", "reduced", "svg"] as const) {
      for (const visible of [false, true]) {
        for (const dirty of [false, true]) {
          for (const animating of [false, true]) {
            expect(shouldRender({ visible, dirty, animating }, tier))
              .toBe(tier !== "svg" && visible && (dirty || (tier === "full" && animating)));
          }
        }
      }
    }
  });
});

describe("scissor rectangles in logical pixels", () => {
  it("flips the DOM top origin to the GL bottom origin", () => {
    expect(scissorRects({ left: 20, top: 30, width: 100, height: 80 }, 390, 844)).toEqual({
      viewport: { x: 20, y: 734, width: 100, height: 80 }, scissor: { x: 20, y: 734, width: 100, height: 80 },
    });
  });

  it("clips the scissor on all edges without shrinking or moving the viewport", () => {
    expect(scissorRects({ left: -20, top: -30, width: 440, height: 900 }, 390, 844)).toEqual({
      viewport: { x: -20, y: -26, width: 440, height: 900 }, scissor: { x: 0, y: 0, width: 390, height: 844 },
    });
    expect(scissorRects({ left: 350, top: 800, width: 100, height: 80 }, 390, 844)).toEqual({
      viewport: { x: 350, y: -36, width: 100, height: 80 }, scissor: { x: 350, y: 0, width: 40, height: 44 },
    });
  });

  it.each([
    { left: -100, top: 0, width: 100, height: 80 }, { left: 390, top: 0, width: 100, height: 80 },
    { left: 0, top: -80, width: 100, height: 80 }, { left: 0, top: 844, width: 100, height: 80 },
    { left: 0, top: 0, width: 0, height: 80 }, { left: 0, top: 0, width: 100, height: -1 },
    { left: NaN, top: 0, width: 100, height: 80 },
  ])("rejects outside or invalid rect %o", (rect) => {
    expect(scissorRects(rect, 390, 844)).toBeNull();
  });
});

describe("DPR budget", () => {
  it("caps full at 1.5 and reduced at 1, retaining lower device ratios", () => {
    expect(cappedDpr(3, "full")).toBe(1.5);
    expect(cappedDpr(3, "reduced")).toBe(1);
    expect(cappedDpr(0.75, "full")).toBe(0.75);
    expect(cappedDpr(NaN, "full")).toBe(1);
  });
});

describe("frame watchdog", () => {
  it("keeps a pure rolling average of the last 30 valid samples", () => {
    const initial = { samples: [], avgFrameMs: 0 };
    const first = sampleFrame(initial, 16);
    expect(initial).toEqual({ samples: [], avgFrameMs: 0 });
    expect(sampleFrame(first, 50).avgFrameMs).toBe(33);
    for (const ms of [0, -1, Infinity, NaN]) expect(sampleFrame(first, ms)).toBe(first);
    let current = first;
    for (let i = 0; i < 30; i++) current = sampleFrame(current, 40);
    expect(current.samples).toHaveLength(30);
    expect(current.avgFrameMs).toBe(40);
  });
});

describe("scene state hook", () => {
  it("serializes view data into the Playwright attribute", () => {
    const attributes = new Map<string, string>();
    writeSceneState({ setAttribute: (name, value) => { attributes.set(name, value); } }, { day: "2026-10-05", pct: 110, mode: "full" });
    expect(JSON.parse(attributes.get("data-scene-state")!)).toEqual({ day: "2026-10-05", pct: 110, mode: "full" });
  });
});
