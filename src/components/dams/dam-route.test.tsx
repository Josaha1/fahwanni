import { expect, it, vi } from "vitest";
import Page from "@/app/water/dam/[id]/page";
import { DamDetail } from "./dam-detail";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

it("rejects unknown dam IDs instead of rendering an empty detail page", async () => {
  await expect(Page({ params: Promise.resolve({ id: "unknown" }) })).rejects.toThrow("NEXT_NOT_FOUND");
});

it("resolves the registered dam for the existing /water drill-down", async () => {
  const page = await Page({ params: Promise.resolve({ id: "200101" }) });
  expect(page.type).toBe(DamDetail);
  expect(page.props.registered.nameEn).toBe("Bhumibol");
});
