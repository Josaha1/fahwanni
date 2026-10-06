import { expect, it } from "vitest";
import { damRegistryById } from "@/lib/dams/registry";
import { provinces } from "@/lib/provinces";
import { riverSystems } from "@/lib/rivers/systems";
import { boxesOverlap, labelWidth, schematicFlowWidth, schematicLabels, schematicNodes } from "./river-layout";

it.each(riverSystems)("keeps $id label boxes separate and inside the diagram in both languages", (system) => {
  const nodes = schematicNodes(system);
  for (const locale of ["th", "en"] as const) {
    for (const release of [locale === "th" ? "ไม่รายงาน" : "Not reported", "1,234.5", "0"]) {
      const labels = schematicLabels(nodes.filter((node) => node.kind !== "confluence").map((node) => {
        const dam = node.damId ? damRegistryById.get(node.damId)! : undefined;
        const province = provinces.find((province) => province.id === node.provinceId);
        const name = dam ? locale === "th" ? dam.nameTh : dam.nameEn
          : province ? province[locale] : locale === "th" ? "ทะเลจีนใต้" : "South China Sea";
        return { node, name, release: dam ? release : undefined };
      }), nodes);
      expect(labels).toHaveLength(nodes.filter((node) => node.kind !== "confluence").length);
      for (const [index, label] of labels.entries()) {
        expect(label.x).toBeGreaterThanOrEqual(-14);
        expect(label.x + label.width).toBeLessThanOrEqual(394);
        expect(label.y).toBeGreaterThanOrEqual(4);
        for (const other of labels.slice(index + 1)) expect(boxesOverlap(label, other), `${locale}: ${label.id} / ${other.id}`).toBe(false);
      }
    }
  }
});

it("fits the Chao Phraya graph in a compact mobile diagram with Tha Chin beside it", () => {
  const system = riverSystems.find((system) => system.id === "chao-phraya")!;
  const before = structuredClone(system);
  const nodes = schematicNodes(system);
  expect(Math.max(...nodes.map((node) => node.y)) + 40).toBeLessThan(660);
  const mainOutlet = nodes.find((node) => node.id.endsWith("gulf-chao-phraya"))!;
  const krasiao = nodes.find((node) => node.damId === "100303")!;
  expect(krasiao.y).toBeLessThan(mainOutlet.y);
  expect(krasiao.x).toBeGreaterThan(mainOutlet.x);
  expect(system).toEqual(before);
});

it("maps the existing log scale to 2–14 px with a wider visual difference", () => {
  expect(schematicFlowWidth(null)).toBe(2);
  expect(schematicFlowWidth(0)).toBe(2);
  expect(schematicFlowWidth(2000)).toBe(14);
  expect(schematicFlowWidth(300) - schematicFlowWidth(5)).toBeGreaterThan(6);
});

it("does not count combining Thai marks as separate character cells", () => {
  expect(labelWidth("กิ่ว")).toBe(labelWidth("กว"));
});
