/**
 * Reload when the server runs a different build than the one this page was loaded from,
 * but never while the user is in the middle of a sheet (form) — try again on the next check.
 */
export function shouldReload(s: { current: string | undefined; latest: string | null | undefined; sheetOpen: boolean }) {
  if (!s.current || !s.latest) return false;
  if (s.current === s.latest) return false;
  return !s.sheetOpen;
}
