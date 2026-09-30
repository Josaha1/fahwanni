import { describe, expect, it } from "vitest";
import fixture from "./fixture-rid.json";
import { damBand, damBandColor, damBandWord, mcmDayToCms } from "./bands";
import { parseRidDams } from "./rid";

describe("RID large dams", () => {
  it("parses every dam in the real report and joins the registry", () => {
    const { dams, dataDate, registeredCount } = parseRidDams(fixture);
    expect(dataDate).toBe(fixture.date);
    expect(registeredCount).toBe(35);
    expect(dams).toHaveLength(35);
    const bhumibol = dams.find((dam) => dam.nameTh === "ภูมิพล")!;
    expect(bhumibol).toMatchObject({ id: "200101", nameEn: "Bhumibol", agency: "EGAT", province: { th: "ตาก", en: "Tak" }, basin: { th: "ภาคเหนือ", en: "North" } });
    expect(bhumibol.releaseCms).toBe(mcmDayToCms(bhumibol.releaseMcmDay));
    expect(bhumibol.spilledMcmDay).toBeNull();
  });

  it("uses volume for storage, percent_storage for the band, and flags high release", () => {
    const raw = { date: "2026-09-29", data: [{ region: "ภาคตะวันออก", dam: [
      { id: "100505", name: "เขื่อนประแสร์", owner: "กรมชลประทาน", capacity: 295, storage: 248, active_storage: 228, dead_storage: 20, volume: 284.1, percent_storage: 114.58, inflow: 33.19, outflow: 33.2 },
      { id: "100503", name: "เขื่อนบางพระ", owner: "กรมชลประทาน", capacity: 117, storage: 117, active_storage: 105, dead_storage: 12, volume: 90, percent_storage: 76.9, inflow: 1, outflow: null },
    ] }] };
    const [prasae, bangPhra] = parseRidDams(raw).dams;
    expect(prasae).toMatchObject({ agency: "RID", storageMcm: 284.1, capacityMcm: 248, storagePct: 114.58, band: 5, highRelease: true, usablePct: 115.8 });
    expect(bangPhra).toMatchObject({ band: 3, highRelease: false, releaseMcmDay: null, releaseCms: null });
  });

  it("skips unknown ids and malformed rows and never throws on junk", () => {
    const raw = { date: "2026-09-29", data: [{ region: "ภาคใต้", dam: [{ id: "999999", name: "x", storage: 1, dead_storage: 0, volume: 1, percent_storage: 1 }, { id: "200604" }] }] };
    expect(parseRidDams(raw)).toMatchObject({ dams: [], registeredCount: 1 });
    for (const junk of [null, 1, "x", {}, { date: 1 }]) expect(parseRidDams(junk)).toEqual({ dams: [], dataDate: null, registeredCount: 0 });
  });

  it("maps storage to RID bands", () => {
    expect([30, 30.1, 50, 50.1, 80, 80.1, 100, 100.1].map(damBand)).toEqual([1, 2, 2, 3, 3, 4, 4, 5]);
    expect(damBandWord(5)).toBe("เกินความจุ");
    expect(damBandColor(1)).toBe("#FFC000");
  });
});
