"""Schematic V-shaped reservoir, pinned to Blender 4.5 LTS.

  Blender -b -P scripts/blender/dam.py -- --out public/models/dam.glb

Blender Z becomes glTF +Y. Below level 1.1 the constant-length V section
stays exact: WaterUp's unit width scales to widthAt1 * level, at H * level.
"""
import argparse
import json
import math
import os
import struct
import sys

import bpy
from mathutils import Vector, noise

H = 2.0
WIDTH_AT_0 = 0.0
WIDTH_AT_1 = 4.0
BACK = -3.0
FRONT = 0.6
SEED = Vector((17.3, 43.7, 9.1))


def material(name, color, roughness=0.9):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "AO"
    if name in ("water", "rim"):
        # Keep preview colours in the material factor; runtime can replace that
        # factor with its theme colour while the white vertex colours stay neutral.
        multiply = mat.node_tree.nodes.new("ShaderNodeMix")
        multiply.data_type = "RGBA"
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1
        multiply.inputs[7].default_value = (*color, 1)
        mat.node_tree.links.new(attr.outputs["Color"], multiply.inputs[6])
        mat.node_tree.links.new(multiply.outputs[2], bsdf.inputs["Base Color"])
    else:
        mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def mesh(name, vertices, faces, mat, location=(0, 0, 0), smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = smooth
    return obj


def tint(obj, terrain=False, plain=False):
    data = obj.data
    # Point colours keep smooth terrain vertices shared in the GLB. No bake
    # device is required: normal, valley depth and local concavity approximate AO.
    colors = data.color_attributes.new(name="AO", type="BYTE_COLOR", domain="POINT")
    neighbours = [[] for _ in data.vertices]
    for edge in data.edges:
        a, b = edge.vertices
        neighbours[a].append(b)
        neighbours[b].append(a)
    for vertex, color in zip(data.vertices, colors.data):
        z = vertex.co.z + obj.location.z
        normal = max(0, vertex.normal.z)
        cavity = max(0, sum(data.vertices[i].co.z - vertex.co.z
                            for i in neighbours[vertex.index])
                     / max(1, len(neighbours[vertex.index])))
        if terrain:
            rock = min(1, max(0, (1 - normal) * 1.5 + (z - 2.3) * 0.35))
            grass = (0.60, 0.67, 0.48) if z > 2.2 else (0.67, 0.57, 0.43)
            base = tuple(a * (1 - rock) + b * rock
                         for a, b in zip(grass, (0.59, 0.57, 0.54)))
            ao = max(0.62, 0.78 + 0.15 * normal + 0.06 * min(1, z / H)
                     - 0.6 * cavity)
        else:
            base = (0.73, 0.75, 0.77)
            ao = max(0.65, 0.76 + 0.16 * normal - 0.5 * cavity)
        color.color = (1, 1, 1, 1) if plain else (*[c * ao for c in base], 1)
    data.color_attributes.active_color = colors


def terrain_height(x, y):
    # Exactly z=abs(x) throughout the wet slopes: both water edges coincide
    # with the terrain even at 121%. Fixed noise coordinates make builds repeatable.
    shoulder = max(0, abs(x) - H * 1.1)
    n = noise.noise_vector(Vector((x * 1.4, y * 1.2, 0)) + SEED).x
    z = abs(x) + shoulder * (0.65 + 0.35 * n)
    z += min(1, shoulder / 0.5) * (0.16 * n + 0.12 * math.sin(y * 2.2 + x))
    if y > FRONT:
        t = min(1, (y - FRONT) / 1.15)
        t = t * t * (3 - 2 * t)
        centre = max(0.05, 1.35 - (y - 0.97) * 1.30 / 2.18)
        river = 0.035 + max(0, abs(x - centre) - 0.30) * 0.63
        z = z * (1 - t) + (river + shoulder * 0.45 + abs(x) * 0.035 * n) * t
    return z


def basin(mat):
    # Nonuniform X samples pin the V cusp and level-1.1 shoreline exactly;
    # nonuniform Y samples pin FRONT before the downstream valley drops away.
    xs = [-3.2 + i / 10 for i in range(11)]
    xs += [-2.2 + 4.4 * i / 44 for i in range(1, 45)]
    xs += [2.2 + i / 10 for i in range(1, 11)]
    ys = [BACK + (FRONT - BACK) * i / 22 for i in range(23)]
    ys += [FRONT + (3.3 - FRONT) * i / 14 for i in range(1, 15)]
    nx = len(xs)
    vertices = [(x, y, terrain_height(x, y)) for y in ys for x in xs]
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i)
             for j in range(len(ys) - 1) for i in range(nx - 1)]
    obj = mesh("Basin", vertices, faces, mat, smooth=True)
    tint(obj, terrain=True)


def append_box(vertices, faces, low, high):
    i = len(vertices)
    x0, y0, z0 = low
    x1, y1, z1 = high
    vertices.extend([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                     (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)])
    faces.extend(tuple(i + k for k in face) for face in
                 [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5),
                  (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)])


def tube(vertices, faces, points, radius, sides=6, closed=False):
    offset = len(vertices)
    points = [Vector(p) for p in points]
    for i, point in enumerate(points):
        before = points[(i - 1) % len(points)] if closed or i else point
        after = points[(i + 1) % len(points)] if closed or i < len(points) - 1 else point
        tangent = (after - before).normalized()
        side = tangent.cross(Vector((0, 0, 1))).normalized()
        up = side.cross(tangent).normalized()
        for k in range(sides):
            angle = k * 2 * math.pi / sides
            vertices.append(tuple(point + radius * (math.cos(angle) * side + math.sin(angle) * up)))
    for i in range(len(points) if closed else len(points) - 1):
        for k in range(sides):
            a = offset + i * sides + k
            b = offset + i * sides + (k + 1) % sides
            c = offset + ((i + 1) % len(points)) * sides + (k + 1) % sides
            d = offset + ((i + 1) % len(points)) * sides + k
            faces.append((d, c, b, a))
    if not closed:
        faces.append(tuple(offset + k for k in range(sides)))
        faces.append(tuple(offset + (len(points) - 1) * sides + k for k in reversed(range(sides))))


def arch_y(x):
    return FRONT - 0.24 * (1 - (x / 2.34) ** 2)


def wall(mat):
    vertices, faces = [], []
    segments = 24
    top = 2.34
    # Each section lands on the V slope; the downstream batter makes the
    # gravity base broader than the crest. Water's FRONT edge stays inside it.
    for i in range(segments + 1):
        x = -top + 2 * top * i / segments
        bottom = max(0, abs(x) - 0.10)
        y = arch_y(x)
        vertices.extend([(x, y, bottom), (x, y + 0.72 - 0.40 * bottom / top, bottom),
                         (x, y + 0.32, top), (x, y, top)])
    for i in range(segments):
        for k in range(4):
            faces.append((4 * i + (k + 1) % 4, 4 * (i + 1) + (k + 1) % 4,
                          4 * (i + 1) + k, 4 * i + k))
    faces.extend([(3, 2, 1, 0), tuple(4 * segments + k for k in range(4))])
    obj = mesh("Wall", vertices, faces, mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bevel = obj.modifiers.new("Concrete edges", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 1
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(35)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    obj.select_set(False)
    # Bevel the concrete shell alone; beveling six-sided rails would multiply
    # their vertices and soften away the small details under this file budget.
    old_data = obj.data
    vertices = [tuple(v.co) for v in old_data.vertices]
    faces = [tuple(p.vertices) for p in old_data.polygons]
    # Two rail tubes and their posts belong to Wall, keeping exactly seven nodes.
    for dy in (0.035, 0.285):
        points = [(x, arch_y(x) + dy, top + 0.13)
                  for x in [-top + 2 * top * i / segments for i in range(segments + 1)]]
        tube(vertices, faces, points, 0.015)
        for x, y, z in points[::3]:
            append_box(vertices, faces, (x - 0.012, y - 0.012, top),
                       (x + 0.012, y + 0.012, z))
    # A narrow inset road strip makes the crest legible without another material.
    road_start = len(vertices)
    for i in range(segments):
        x0 = -top + 2 * top * i / segments
        x1 = -top + 2 * top * (i + 1) / segments
        j = len(vertices)
        vertices.extend([(x0, arch_y(x0) + 0.075, top + 0.008),
                         (x1, arch_y(x1) + 0.075, top + 0.008),
                         (x1, arch_y(x1) + 0.245, top + 0.008),
                         (x0, arch_y(x0) + 0.245, top + 0.008)])
        faces.append((j, j + 1, j + 2, j + 3))
    data = bpy.data.meshes.new("Wall")
    data.from_pydata(vertices, [], faces)
    data.update()
    data.materials.append(mat)
    obj.data = data
    bpy.data.meshes.remove(old_data)
    tint(obj)
    colors = data.color_attributes["AO"]
    for i in range(road_start, len(vertices)):
        r, g, b, a = colors.data[i].color
        colors.data[i].color = (r * 0.78, g * 0.78, b * 0.78, a)


def spillway(concrete, water):
    # Side chute returns to the river centre. Repeated Y coordinates are the
    # vertical risers, so the water ribbon follows all four drops continuously.
    path = [(1.35, 0.40, 2.36), (1.35, 0.97, 2.36),
            (1.35, 0.97, 1.82), (1.15, 1.38, 1.82),
            (1.15, 1.38, 1.28), (0.90, 1.79, 1.28),
            (0.90, 1.79, 0.74), (0.55, 2.20, 0.74),
            (0.55, 2.20, 0.20), (0.20, 2.65, 0.12), (0.05, 3.15, 0.12)]
    vertices, faces = [], []
    for x, y, z in path:
        vertices.extend([(x - 0.36, y, z - 0.07), (x + 0.36, y, z - 0.07),
                         (x - 0.36, y, z + 0.09), (x - 0.29, y, z + 0.09),
                         (x - 0.29, y, z), (x + 0.29, y, z),
                         (x + 0.29, y, z + 0.09), (x + 0.36, y, z + 0.09)])
    for i in range(len(path) - 1):
        for a, b in [(0, 1), (2, 0), (3, 2), (4, 3), (5, 4), (6, 5), (7, 6), (1, 7)]:
            faces.append((8 * (i + 1) + a, 8 * (i + 1) + b, 8 * i + b, 8 * i + a))
    obj = mesh("Spillway", vertices, faces, concrete)
    tint(obj)
    vertices = [(x + dx, y + 0.009, z + 0.012) for x, y, z in path for dx in (-0.25, 0.25)]
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(path) - 1)]
    obj = mesh("WaterDown", vertices, faces, water)
    tint(obj, plain=True)
    uv = obj.data.uv_layers.new(name="Flow")
    distances = [0.0]
    for a, b in zip(path, path[1:]):
        distances.append(distances[-1] + (Vector(b) - Vector(a)).length)
    for loop in obj.data.loops:
        uv.data[loop.index].uv = (loop.vertex_index % 2, distances[loop.vertex_index // 2])


def ring(name, mat):
    # Rounded rectangular shoreline: local Z zero and level-one object position
    # retain runtime Y translation / X scaling, including the zero-width case.
    vertices, faces, points = [], [], []
    half = WIDTH_AT_1 / 2
    r = 0.035
    for cx, cy, start in [(half - r, FRONT - r, 0), (-half + r, FRONT - r, 90),
                          (-half + r, BACK + r, 180), (half - r, BACK + r, 270)]:
        for i in range(5):
            angle = math.radians(start + i * 90 / 4)
            points.append((cx + r * math.cos(angle), cy + r * math.sin(angle), 0))
    tube(vertices, faces, points, 0.014, closed=True)
    obj = mesh(name, vertices, faces, mat, location=(0, 0, H), smooth=True)
    tint(obj, plain=True)


def build():
    terrain = material("terrain", (0.8, 0.75, 0.65))
    concrete = material("wall", (0.7, 0.73, 0.78))
    water = material("water", (0.2, 0.5, 0.8), 0.25)
    rim = material("rim", (0.5, 0.5, 0.5))
    basin(terrain)
    wall(concrete)
    spillway(concrete, water)
    upstream = mesh("WaterUp", [(-0.5, BACK, 0), (0.5, BACK, 0),
                                (0.5, FRONT, 0), (-0.5, FRONT, 0)],
                    [(0, 1, 2, 3)], water)
    tint(upstream, plain=True)
    upstream["levelHeight"] = H
    upstream["widthAt0"] = WIDTH_AT_0
    upstream["widthAt1"] = WIDTH_AT_1
    ring("RimLastYear", rim)
    ring("Rim2554", rim)


def compact_colors(path):
    # Blender exports linear RGB as float32 even for BYTE_COLOR. Core glTF
    # normalized uint8 RGBA preserves the tints without textures or compression.
    with open(path, "rb") as source:
        raw = source.read()
    json_length = struct.unpack_from("<I", raw, 12)[0]
    gltf = json.loads(raw[20:20 + json_length])
    binary = raw[28 + json_length:]
    color_accessors = {p["attributes"]["COLOR_0"] for m in gltf["meshes"] for p in m["primitives"]}
    replacements = {}
    for index in color_accessors:
        accessor = gltf["accessors"][index]
        view = gltf["bufferViews"][accessor["bufferView"]]
        components = 3 if accessor["type"] == "VEC3" else 4
        component_type = accessor["componentType"]
        fmt, size, divisor = {5126: ("f", 4, 1), 5123: ("H", 2, 65535), 5121: ("B", 1, 255)}[component_type]
        stride = view.get("byteStride", components * size)
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        packed = bytearray()
        for i in range(accessor["count"]):
            values = struct.unpack_from("<" + fmt * components, binary, start + i * stride)
            packed.extend(round(max(0, min(1, c / divisor)) * 255) for c in values)
            if components == 3:
                packed.append(255)
        replacements[accessor["bufferView"]] = packed
        accessor.update(componentType=5121, type="VEC4", normalized=True, byteOffset=0)
    output = bytearray()
    for index, view in enumerate(gltf["bufferViews"]):
        output.extend(b"\0" * (-len(output) % 4))
        start = view.get("byteOffset", 0)
        payload = replacements.get(index, binary[start:start + view["byteLength"]])
        view.update(byteOffset=len(output), byteLength=len(payload))
        if index in replacements:
            view.pop("byteStride", None)
        output.extend(payload)
    gltf["buffers"][0]["byteLength"] = len(output)
    output.extend(b"\0" * (-len(output) % 4))
    metadata = json.dumps(gltf, separators=(",", ":")).encode()
    metadata += b" " * (-len(metadata) % 4)
    with open(path, "wb") as target:
        target.write(struct.pack("<III", 0x46546C67, 2, 28 + len(metadata) + len(output)))
        target.write(struct.pack("<II", len(metadata), 0x4E4F534A))
        target.write(metadata)
        target.write(struct.pack("<II", len(output), 0x004E4942))
        target.write(output)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    if bpy.app.version[:2] != (4, 5):
        raise RuntimeError(f"Expected Blender 4.5 LTS, got {bpy.app.version_string}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(args.out), export_format="GLB",
        export_yup=True, export_extras=True, export_animations=False,
        export_draco_mesh_compression_enable=False,
        export_vertex_color="ACTIVE", export_all_vertex_colors=True,
    )
    compact_colors(args.out)
    print(f"DAM exported {args.out}")


main()
