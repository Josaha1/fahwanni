// Lists t("…") / t(`…`) literal keys in src that have no English entry. Usage: node scripts/i18n-check.mjs [path-prefix]
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const prefix = process.argv[2] ?? "src";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) files.push(p);
  }
})("src");

const dict = new Set();
for (const f of files.filter((f) => f.startsWith("src/i18n/en/"))) {
  for (const m of readFileSync(f, "utf8").matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) dict.add(JSON.parse(`"${m[1]}"`));
}
let missing = 0;
for (const f of files.filter((f) => f.startsWith(prefix) && !f.startsWith("src/i18n/"))) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
    const key = JSON.parse(`"${m[1]}"`);
    if (/[฀-๿]/.test(key) && !dict.has(key)) { missing++; console.log(`${f}: ${key}`); }
  }
}
console.log(missing ? `\n${missing} keys without English` : "all literal keys translated");
process.exitCode = missing ? 1 : 0;
