import { describe, expect, it } from "vitest";
import { nearestProvince, pointPlace } from "./nearest";

describe("nearest map place", () => {
  it("uses the nearest provincial capital and marks a close point", () => {
    expect(nearestProvince(13.7279, 100.5241).id).toBe("bangkok");
    expect(pointPlace(13.7279, 100.5241)).toMatchObject({ id: "point-13.73-100.52", name: "กรุงเทพมหานคร", admin: "Bangkok", country: "Thailand", source: "search" });
  });
  it("uses the province below 15 km and a nearby label from 15 through 50 km", () => {
    const lat = 7.981;
    expect(nearestProvince(lat, 98.2277).km).toBeLessThan(15);
    expect(pointPlace(lat, 98.2277)).toMatchObject({ name: "ภูเก็ต", admin: "Phuket", country: "Thailand" });
    expect(nearestProvince(lat, 98.2276).km).toBeGreaterThan(15);
    expect(pointPlace(lat, 98.2276)).toMatchObject({ name: "ใกล้ภูเก็ต", admin: "Near Phuket", country: "Thailand" });
    expect(nearestProvince(lat, 97.9099).km).toBeLessThan(50);
    expect(pointPlace(lat, 97.9099)).toMatchObject({ name: "ใกล้ภูเก็ต", admin: "Near Phuket", country: "Thailand" });
  });
  it("uses rounded coordinates beyond 50 km without a country", () => {
    expect(nearestProvince(7.981, 97.9098).km).toBeGreaterThan(50);
    const place = pointPlace(7.981, 97.9098);
    expect(place).toMatchObject({ id: "point-7.98-97.91", name: "7.98, 97.91", admin: "7.98, 97.91", lat: 7.98, lon: 97.91, source: "search" });
    expect(place).not.toHaveProperty("country");
    expect(pointPlace(3.39, 93.01)).toMatchObject({ name: "3.39, 93.01", admin: "3.39, 93.01" });
    expect(pointPlace(28.30, 100.27)).toMatchObject({ name: "28.30, 100.27", admin: "28.30, 100.27" });
  });
});
