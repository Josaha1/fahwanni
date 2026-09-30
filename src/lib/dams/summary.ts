import { distanceKm } from "../storms/normalize";
import type { RainStation } from "../rain-risk/tmd";
import type { Dam } from "./types";

export function oldestDifferentDamDate(dams: Pick<Dam, "date">[], dataDate: string): string | null {
  return dams.reduce<string | null>((oldest, dam) =>
    dam.date !== dataDate && (oldest === null || dam.date < oldest) ? dam.date : oldest, null);
}

export function waterSummary(dams: Dam[], rain: RainStation[] | null): {
  over80: number; over100: number; highRelease: number; heavyRain: number | null;
} {
  return {
    over80: dams.filter((dam) => dam.storagePct > 80).length,
    over100: dams.filter((dam) => dam.storagePct > 100).length,
    highRelease: dams.filter((dam) => dam.highRelease).length,
    heavyRain: rain === null ? null : rain.length,
  };
}

export function nearestDams(dams: Dam[], place: { lat: number; lon: number }, n = 3): { dam: Dam; km: number }[] {
  return dams.map((dam) => ({ dam, km: distanceKm(place, dam) }))
    .sort((a, b) => a.km - b.km || a.dam.id.localeCompare(b.dam.id)).slice(0, n);
}
