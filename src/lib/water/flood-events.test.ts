import { describe, expect, it } from "vitest";
import fixture from "./fixture-flood-events.json";
import { mergeFloodEvents, parseGdacsFloods, parseGlide } from "./flood-events";

const now = Date.parse("2026-10-01T10:00:00+07:00");

describe("flood events", () => {
  it("keeps recent GLIDE floods with decoded text and drops old or non-water events", () => {
    const events = parseGlide(fixture.glide, now);
    expect(events.map((event) => event.id)).toEqual(["glide:FL-2026-000183-THA", "glide:FL-2026-000158-THA"]);
    expect(events[0]).toMatchObject({ type: "flood", date: "2026-09-27", place: "Bangkok", source: "glide", alert: null });
    expect(events[0].summary).toContain("Thailand's capital");
    expect(events[0].summary.length).toBeLessThanOrEqual(280);
  });

  it("keeps GDACS floods within the window with their alert level", () => {
    const events = parseGdacsFloods(fixture.gdacs, Date.parse("2026-01-15T10:00:00+07:00"));
    expect(events.map((event) => [event.id, event.alert, event.date])).toEqual([
      ["gdacs:1103663", "Orange", "2025-12-12"], ["gdacs:1103646", "Red", "2025-12-03"], ["gdacs:1103621", "Orange", "2025-11-17"],
    ]);
    expect(parseGdacsFloods(fixture.gdacs, now)).toEqual([]);
  });

  it("drops a GLIDE event GDACS already describes and sorts newest first", () => {
    const gdacs = parseGdacsFloods(fixture.gdacs, Date.parse("2026-01-15T10:00:00+07:00"));
    const glide = [{ ...gdacs[2], id: "glide:FL-2025-000210-THA", source: "glide" as const, alert: null, glide: "FL-2025-000210-THA" }];
    const merged = mergeFloodEvents(gdacs, glide);
    expect(merged.map((event) => event.id)).toEqual(["gdacs:1103663", "gdacs:1103646", "gdacs:1103621"]);
  });
});
