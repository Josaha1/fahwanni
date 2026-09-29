import { DAY, HOUR, MINUTE, clampToDomain, roundTo, type TimeDomain } from "./time";

export function nextTimeForKey(key: string, shift: boolean, t: number, domain: TimeDomain): number | null {
  let next: number;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp": next = t + (shift ? HOUR : 10 * MINUTE); break;
    case "ArrowLeft":
    case "ArrowDown": next = t - (shift ? HOUR : 10 * MINUTE); break;
    case "PageDown": next = t + DAY; break;
    case "PageUp": next = t - DAY; break;
    case "Home": next = domain.now; break;
    case "End": next = domain.end; break;
    default: return null;
  }
  return clampToDomain(roundTo(clampToDomain(next, domain), MINUTE), domain);
}
