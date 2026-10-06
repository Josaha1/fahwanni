export type GlTier = "full" | "reduced" | "svg";

export type GlSignals = {
  lite: boolean;
  reducedMotion: boolean;
  webgl2: boolean;
  rendererString?: string | null;
  deviceMemory?: number;
  avgFrameMs?: number;
  contextLosses: number;
  forceGl: boolean;
};

export function glTier(signals: GlSignals): GlTier {
  const { lite, reducedMotion, webgl2, rendererString, deviceMemory, avgFrameMs, contextLosses, forceGl } = signals;
  if (lite || reducedMotion || !webgl2 || contextLosses >= 2) return "svg";
  if (!forceGl && /swiftshader|llvmpipe|software/i.test(rendererString ?? "")) return "svg";
  if ((deviceMemory !== undefined && deviceMemory <= 4) || (avgFrameMs !== undefined && avgFrameMs > 33)) return "reduced";
  return "full";
}

/** The test override bypasses only software detection, never user preferences. */
export function forceGlFromSearch(search: string): boolean {
  return new URLSearchParams(search).get("gl") === "force";
}

export function readRendererString(gl: WebGLRenderingContext | WebGL2RenderingContext | null): string | null {
  try {
    const extension = gl?.getExtension("WEBGL_debug_renderer_info");
    if (!extension) return null;
    const value: unknown = gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL);
    return typeof value === "string" ? value : null;
  } catch {
    // Privacy settings and a lost context can both deny the debug extension.
    return null;
  }
}
