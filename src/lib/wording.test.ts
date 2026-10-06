import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The app reports observations; it must never tell people they are safe (plan: map-first honesty rules).
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
});

describe("wording", () => {
  it('has no "ปลอดภัย" in shipped source', () => {
    expect(files("src").filter((path) => readFileSync(path, "utf8").includes("ปลอดภัย"))).toEqual([]);
  });

  it('has no English "safe"/"unsafe" in the EN dictionaries', () => {
    const hits = files("src/i18n/en").flatMap((path) => [...readFileSync(path, "utf8").matchAll(/:\s*"[^"]*\b(un)?safe\b[^"]*"/gi)].map((m) => `${path}: ${m[0]}`));
    expect(hits).toEqual([]);
  });
});
