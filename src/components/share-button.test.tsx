import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { translator } from "@/i18n/core";
import { ShareButton } from "./share-button";
import { damSummaryCard } from "./share/summary-card";

vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: () => [false, vi.fn()] }));
vi.mock("@/i18n/client", () => ({ useT: () => Object.assign(translator("en"), { intl: "en-GB" }) }));
vi.mock("./share/render-summary-image", () => ({ renderSummaryImage: async () => new Blob(["png"], { type: "image/png" }) }));
const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: feedback }));

const card = damSummaryCard({ id: "200101", nameTh: "ภูมิพล", nameEn: "Bhumibol" }, null, null, translator("en"));
const click = vi.fn();
const share = vi.fn();
let anchor: { href?: string; download?: string; click: typeof click };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  anchor = { click };
  share.mockResolvedValue(undefined);
  vi.stubGlobal("window", { location: { origin: "https://example.com", href: "https://example.com/dam/200101?lens=dams" } });
  vi.stubGlobal("document", { createElement: () => anchor });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:card");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function press() {
  ShareButton({ card, imageLabel: "Share dam summary" }).props.onClick();
  await vi.advanceTimersByTimeAsync(0);
}

it("shares the generated PNG file and public page link together", async () => {
  const canShare = vi.fn(() => true);
  vi.stubGlobal("navigator", { share, canShare });
  await press();
  expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/dam/200101", files: [expect.any(File)] }));
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: "https://example.com/dam/200101", files: [expect.objectContaining({ type: "image/png" })] }));
  expect(click).not.toHaveBeenCalled();
});

it.each(["unavailable", "unsupported", "rejected"])("downloads the PNG when sharing is %s", async (mode) => {
  if (mode === "rejected") share.mockRejectedValue(new Error("unsupported payload"));
  vi.stubGlobal("navigator", mode === "unavailable" ? {} : { share, canShare: () => mode !== "unsupported" });
  await press();
  expect(click).toHaveBeenCalledOnce();
  expect(anchor).toMatchObject({ href: "blob:card", download: "fah-wanni.png" });
  expect(feedback.success).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:card");
});

it("lets users dismiss the share sheet without downloading", async () => {
  share.mockRejectedValue(new DOMException("Dismissed", "AbortError"));
  vi.stubGlobal("navigator", { share, canShare: () => true });
  await press();
  expect(click).not.toHaveBeenCalled();
  expect(feedback.error).not.toHaveBeenCalled();
});
