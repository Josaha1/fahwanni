import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { SpeakButton } from "./speak-button";

const hooks = vi.hoisted(() => ({
  locale: "th" as "th" | "en", state: [] as unknown[], cursor: 0,
  effects: [] as (() => void | (() => void))[],
}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.state)) hooks.state[index] = initial;
    return [hooks.state[index], (value: unknown) => { hooks.state[index] = value; }];
  },
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
}));
vi.mock("@/i18n/client", () => ({ useT: () => Object.assign((key: string) => key, { locale: hooks.locale }) }));
let synthesis: EventTarget & { getVoices: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn> };
let clean: (() => void) | undefined;
const text = "Satellite: 3 points · Rain 25 mm · Release 30 m³/s";
const voice = (lang: string) => ({ lang } as SpeechSynthesisVoice);
const render = () => { hooks.cursor = 0; return SpeakButton({ text }) as ReactElement<{ onClick: () => void; children: string }> | null; };

beforeEach(() => {
  hooks.locale = "th"; hooks.state = []; hooks.effects = [];
  synthesis = Object.assign(new EventTarget(), { getVoices: vi.fn().mockReturnValue([]), cancel: vi.fn(), speak: vi.fn() });
  vi.stubGlobal("window", { speechSynthesis: synthesis }); vi.stubGlobal("speechSynthesis", synthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
});
afterEach(() => { clean?.(); clean = undefined; vi.unstubAllGlobals(); });

it.each(["th", "en"] as const)("reads the exact visual summary with a %s voice, including voices loaded later", (locale) => {
  hooks.locale = locale;
  expect(render()).toBeNull(); clean = hooks.effects[0]() || undefined;
  expect(render()).toBeNull();
  synthesis.getVoices.mockReturnValue([voice("ja-JP"), voice(locale === "th" ? "th-TH" : "en-GB")]);
  synthesis.dispatchEvent(new Event("voiceschanged"));
  const button = render()!;
  expect(button.props.children).toBe("ฟังสรุป"); button.props.onClick();
  expect(synthesis.speak).toHaveBeenCalledWith(expect.objectContaining({ text, lang: locale === "th" ? "th-TH" : "en" }));
  expect(render()!.props.children).toBe("หยุดอ่าน");
  render()!.props.onClick(); expect(synthesis.cancel).toHaveBeenCalledTimes(2);
});

it("stays hidden without a matching voice or the speech API", () => {
  synthesis.getVoices.mockReturnValue([voice("en-GB")]);
  render(); clean = hooks.effects[0]() || undefined;
  expect(render()).toBeNull();
  clean?.(); clean = undefined;
  vi.stubGlobal("window", {}); hooks.effects = [];
  render(); expect(() => hooks.effects[0]()).not.toThrow(); expect(render()).toBeNull();
});
