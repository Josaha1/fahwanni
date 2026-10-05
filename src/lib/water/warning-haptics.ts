const KEY = "fah-tmd-vibrated";
const visitSeen = new Set<string>();

export function buzzNewWarnings(ids: readonly string[]) {
  if (!ids.length || typeof navigator === "undefined" || !/Android/i.test(navigator.userAgent)
    || typeof navigator.vibrate !== "function") return;
  let saved: string[] = [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(value)) saved = value.filter((id): id is string => typeof id === "string");
  } catch { /* Private browsing still remembers this visit. */ }
  const unseen = ids.filter((id) => !visitSeen.has(id) && !saved.includes(id));
  if (!unseen.length) return;
  try {
    if (!navigator.vibrate(35)) return;
  } catch { return; }
  unseen.forEach((id) => visitSeen.add(id));
  try { localStorage.setItem(KEY, JSON.stringify([...new Set([...saved, ...unseen])])); }
  catch { /* A denied storage write must not break a warning card. */ }
}
