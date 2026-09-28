import { copyFile, mkdir, readFile } from "node:fs/promises";

const packageRoot = new URL("../node_modules/maplibre-gl/", import.meta.url);
const { version } = JSON.parse(await readFile(new URL("package.json", packageRoot), "utf8"));
const target = new URL(`../public/vendor/maplibre/${version}/`, import.meta.url);

await mkdir(target, { recursive: true });
await Promise.all(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"].map((file) =>
  copyFile(new URL(`dist/${file}`, packageRoot), new URL(file, target))
));
