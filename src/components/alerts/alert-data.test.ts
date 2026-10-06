import { describe, expect, it } from "vitest";
import { alertRows } from "./alert-data";
import type { DamsPayload } from "@/lib/dams/client";
import type { FloodEventsPayload } from "@/components/water/flood-events";

const dam = (id: string, storagePct: number, releaseCms: number | null, date = "2026-10-06") =>
  ({ id, nameTh: id, storagePct, releaseCms, date }) as unknown as DamsPayload["dams"][number];
const dams = (list: DamsPayload["dams"]) => ({ dams: list }) as unknown as DamsPayload;

describe("alertRows", () => {
  it("keeps only dams above 80 % or releasing at least 100 m³/s, never a non-reporting dam as 0", () => {
    const rows = alertRows(null, null, dams([dam("a", 81, 5), dam("b", 50, 100), dam("c", 50, null), dam("d", 80, 99.9)]));
    expect(rows.map((row) => row.id)).toEqual(["dam:a", "dam:b"]);
    expect(rows.every((row) => row.role === "release" && row.href.startsWith("/dam/"))).toBe(true);
  });

  it("orders newest first across TMD, events and dams, with undated rows last", () => {
    const events = { items: [{ id: "glide:1", source: "glide", type: "flood", date: "2026-09-27", place: "Bangkok", url: "" }] } as unknown as FloodEventsPayload;
    const rows = alertRows({ items: [{ title: "ฝนตกหนัก", description: "ภาคกลาง", announcedAt: "2026-10-06T05:00:00+07:00" }, { title: "ไม่มีวันที่", description: "" }] },
      events, dams([dam("a", 90, 10, "2026-10-05")]));
    expect(rows.map((row) => row.role)).toEqual(["warn", "release", "water", "warn"]);
    expect(rows[2].href).toBe("/province/bangkok");
  });

  it("never invents an external link for a warning without a province or URL", () => {
    const [row] = alertRows({ items: [{ title: "พายุ", description: "ทะเลอันดามัน" }] }, null, null);
    expect(row.href).toBe("/alerts");
  });
});
