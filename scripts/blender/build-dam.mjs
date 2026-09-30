// Build the schematic dam with Blender 4.5, then validate the exported GLB.
//   node scripts/blender/build-dam.mjs
// Blender path follows build.mjs: $BLENDER, then the two macOS app locations.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = join(root, "public/models/dam.glb");
const BUDGET = 200 * 1024;
const NAMES = ["Basin", "Wall", "Spillway", "WaterUp", "WaterDown", "RimLastYear", "Rim2554"];

function validate() {
  const bytes = readFileSync(out);
  if (bytes.length > BUDGET) throw new Error(`dam.glb: ${bytes.length} bytes exceeds ${BUDGET}`);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
      || bytes.readUInt32LE(8) !== bytes.length) throw new Error("dam.glb: invalid GLB v2 header");
  let offset = 12;
  let gltf;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error("dam.glb: truncated chunk header");
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > bytes.length) throw new Error("dam.glb: invalid chunk length");
    if (offset === 12 && type !== 0x4e4f534a) throw new Error("dam.glb: first chunk must be JSON");
    if (type === 0x4e4f534a) {
      if (gltf) throw new Error("dam.glb: duplicate JSON chunk");
      gltf = JSON.parse(bytes.toString("utf8", offset + 8, offset + 8 + length));
    }
    offset += 8 + length;
  }
  if (!gltf) throw new Error("dam.glb: missing JSON chunk");
  if (gltf.nodes?.length !== NAMES.length) throw new Error(`dam.glb: expected exactly ${NAMES.length} nodes`);
  for (const name of NAMES) {
    const nodes = (gltf.nodes ?? []).filter((node) => node.name === name);
    if (nodes.length !== 1 || !gltf.meshes?.[nodes[0].mesh]) throw new Error(`dam.glb: expected one mesh node named ${name}`);
  }
  const water = gltf.nodes.find((node) => node.name === "WaterUp").extras;
  if (!water || !(water.levelHeight > 0) || water.widthAt0 !== 0 || !(water.widthAt1 > 0)) {
    throw new Error("dam.glb: missing V-valley WaterUp levelHeight/widthAt0/widthAt1 extras");
  }
  if (gltf.textures?.length || gltf.images?.length) throw new Error("dam.glb: textures are forbidden");
  let triangles = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      if (primitive.extensions?.KHR_draco_mesh_compression) throw new Error("dam.glb: Draco is forbidden");
      if ((primitive.mode ?? 4) !== 4) throw new Error("dam.glb: expected triangle primitives");
      const count = gltf.accessors?.[primitive.indices ?? primitive.attributes.POSITION]?.count;
      if (!Number.isInteger(count) || count % 3) throw new Error("dam.glb: invalid triangle accessor count");
      if (primitive.attributes.COLOR_0 === undefined) throw new Error("dam.glb: missing vertex colours");
      triangles += count / 3;
    }
  }
  if (triangles < 6000 || triangles > 15000) throw new Error(`dam.glb: ${triangles} triangles; expected 6000–15000`);
  console.log(`dam.glb: ${NAMES.length} named nodes, ${triangles} triangles, ${(bytes.length / 1024).toFixed(1)} KB${bytes.length > 150 * 1024 ? " (above 150 KB target)" : ""}`);
}

try {
  const blender = [process.env.BLENDER, join(homedir(), "Applications/Blender.app/Contents/MacOS/Blender"), "/Applications/Blender.app/Contents/MacOS/Blender"]
    .find((path) => path && existsSync(path));
  if (!blender) throw new Error("Blender not found: set BLENDER or install to ~/Applications/Blender.app");
  mkdirSync(join(root, "public/models"), { recursive: true });
  execFileSync(blender, ["-b", "-P", join(root, "scripts/blender/dam.py"), "--", "--out", out],
    { stdio: ["ignore", "ignore", "inherit"] });
  validate();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
