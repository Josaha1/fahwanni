import { describe, expect, it, vi } from "vitest";
import { forceGlFromSearch, glTier, readRendererString, type GlSignals } from "./gl-tier";

const normal: GlSignals = { lite: false, reducedMotion: false, webgl2: true, contextLosses: 0, forceGl: false };

describe("GL fallback ladder", () => {
  it("defaults to full when optional hardware signals are unavailable", () => {
    expect(glTier(normal)).toBe("full");
  });

  it.each([
    { lite: true }, { reducedMotion: true }, { webgl2: false }, { contextLosses: 2 }, { contextLosses: 3 },
    { rendererString: "ANGLE (Google, Vulkan SwiftShader Device)" },
    { rendererString: "llvmpipe (LLVM 18.1.8, 256 bits)" }, { rendererString: "SOFTWARE Rasterizer" },
  ])("selects SVG for %o, before reduced triggers", (signals) => {
    expect(glTier({ ...normal, deviceMemory: 2, avgFrameMs: 40, ...signals })).toBe("svg");
  });

  it.each([[4, 33, "reduced"], [2, 10, "reduced"], [8, 33, "full"], [8, 33.01, "reduced"],
    [8, 16, "full"]] as const)("memory %s, frame %s → %s", (deviceMemory, avgFrameMs, tier) => {
    expect(glTier({ ...normal, deviceMemory, avgFrameMs })).toBe(tier);
  });

  it("allows the test override to bypass only the software check", () => {
    const forced = { ...normal, forceGl: true, rendererString: "SwiftShader" };
    expect(glTier(forced)).toBe("full");
    expect(glTier({ ...forced, deviceMemory: 4 })).toBe("reduced");
    for (const signals of [{ lite: true }, { reducedMotion: true }, { webgl2: false }, { contextLosses: 2 }]) {
      expect(glTier({ ...forced, ...signals })).toBe("svg");
    }
    expect(glTier({ ...normal, contextLosses: 1 })).toBe("full");
  });

  it.each([["?gl=force", true], ["?x=1&gl=force", true], ["?gl=true", false], ["?forceGl=true", false],
    ["?gl=Force", false], ["", false]])("reads only gl=force from %s", (search, expected) => {
    expect(forceGlFromSearch(search)).toBe(expected);
  });
});

describe("debug renderer info", () => {
  function context(extension: unknown, value: unknown, fail = false) {
    return {
      getExtension: vi.fn(() => { if (fail) throw new Error("Denied"); return extension; }),
      getParameter: vi.fn(() => value),
    } as unknown as WebGL2RenderingContext;
  }

  it("reads the unmasked renderer", () => {
    const gl = context({ UNMASKED_RENDERER_WEBGL: 37446 }, "Adreno 640");
    expect(readRendererString(gl)).toBe("Adreno 640");
    expect(gl.getExtension).toHaveBeenCalledWith("WEBGL_debug_renderer_info");
    expect(gl.getParameter).toHaveBeenCalledWith(37446);
  });

  it("handles missing contexts, missing extensions, denied access and invalid values", () => {
    expect(readRendererString(null)).toBeNull();
    expect(readRendererString(context(null, "ignored"))).toBeNull();
    expect(readRendererString(context({}, 123))).toBeNull();
    expect(readRendererString(context({}, "ignored", true))).toBeNull();
    const gl = context({ UNMASKED_RENDERER_WEBGL: 37446 }, null);
    vi.mocked(gl.getParameter).mockImplementation(() => { throw new Error("Context lost"); });
    expect(readRendererString(gl)).toBeNull();
  });
});
