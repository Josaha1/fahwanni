import { flowWidth } from "@/lib/map/flow-scale";
import type { RiverSystem } from "@/lib/rivers/types";

type Node = RiverSystem["nodes"][number];
export type LabelInput = { node: Node; name: string; release?: string };
export type LabelBox = { id: string; x: number; y: number; width: number; height: number };
export type PlacedLabel = LabelBox & { textX: number; nameY: number; releaseY: number; anchor: "start" | "end" };

export const schematicFlowWidth = (release: number | null) => 2 + (flowWidth(release) - 1) * 12 / 7;

/** Display spacing does not change the drainage graph or its upstream dam sets. */
export function schematicNodes(system: RiverSystem): Node[] {
  if (system.id !== "chao-phraya") return system.nodes;
  const thaChin = (node: Node) => node.id.includes("tha-chin") || node.damId === "100303";
  const mainStart = Math.min(...system.nodes.filter((node) => !thaChin(node)).map((node) => node.y));
  const sideStart = Math.min(...system.nodes.filter(thaChin).map((node) => node.y));
  return system.nodes.map((node) => ({ ...node, y: thaChin(node)
    ? 400 + (node.y - sideStart) / 2 : 60 + (node.y - mainStart) / 3 }));
}

/** Thai vowel/tone marks do not occupy an extra character cell. Include breathing room. */
export function labelWidth(text: string, fontSize = 11): number {
  return Array.from(text).filter((character) => !/\p{Mark}/u.test(character)).length * fontSize * 0.62 + 4;
}

export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Try the outward branch side first; reserve both names and release values together. */
export function schematicLabels(inputs: LabelInput[], nodes: Node[]): PlacedLabel[] {
  const occupied: LabelBox[] = nodes.filter((node) => node.kind !== "confluence").map((node) => ({
    id: node.id, x: node.x - 10, y: node.y - 10, width: 20, height: 20,
  }));
  return [...inputs].sort((a, b) => a.node.y - b.node.y || a.node.x - b.node.x).map(({ node, name, release }) => {
    const width = Math.max(labelWidth(name), release ? labelWidth(release, 10) : 0);
    const height = release ? 30 : 17;
    const outward = node.x <= 160 ? -1 : 1;
    for (const offset of [0, ...Array.from({ length: 20 }, (_, index) => [-(index + 1) * 6, (index + 1) * 6]).flat()]) {
      for (const side of [outward, -outward, 0, -2, 2, -3, 3]) {
        const anchor = side < 0 ? "end" : "start";
        const x = Math.abs(side) > 1 ? Math.max(-14, Math.min(394 - width, node.x - width / 2 + side * 24))
          : side === 0 ? Math.max(-14, Math.min(394 - width, node.x - width / 2))
          : side < 0 ? node.x - 16 - width : node.x + 16;
        const textX = anchor === "end" ? x + width : x;
        const y = node.y - 10 + offset;
        const box = { id: node.id, x, y, width, height };
        if (x < -14 || x + width > 394 || y < 4 || occupied.some((other) => boxesOverlap(box, other))) continue;
        occupied.push(box);
        return { ...box, textX, nameY: y + 12, releaseY: y + 25, anchor };
      }
    }
    throw new Error(`No room for river label: ${node.id}`);
  });
}
