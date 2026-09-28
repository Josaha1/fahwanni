"""ฟ้าวันนี้ animated condition icons: soft clay weather scenes rendered headless as looping frames.

  Blender -b -P scripts/blender/icons.py -- --out <dir> [--only rain-day] [--size 256] [--frames 24] [--engine eevee|cycles]

Writes <out>/<name>/0000.png … one PNG per frame, transparent background. Every scene is a
closed loop over `--frames` frames (motion uses whole periods of t in [0, 1)), so the sprite
sheet built from it can repeat without a jump. Style follows baby-care's scripts/blender/kit.py.
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

PALETTE = {
    "milk": "#FBF7F4",
    "cloud_shade": "#DDE6F2",
    "sun": "#FFCA45",
    "sun_glow": "#FFB23E",
    "moon": "#F3EFD8",
    "rain": "#4DA3F0",
}


def hex_rgba(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


_materials = {}


def clay(name, roughness=0.4, emission=0.0):
    key = (name, emission)
    if key in _materials:
        return _materials[key]
    mat = bpy.data.materials.new(f"clay-{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgba(PALETTE[name])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = 0.25
    bsdf.inputs["Subsurface Weight"].default_value = 0.05
    if emission:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(PALETTE[name])
        bsdf.inputs["Emission Strength"].default_value = emission
    _materials[key] = mat
    return mat


def smooth(obj, material, subsurf=2):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if subsurf:
        mod = obj.modifiers.new("subsurf", "SUBSURF")
        mod.levels = subsurf
        mod.render_levels = subsurf
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def sphere(radius, location, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location, segments=32, ring_count=16)
    obj = bpy.context.active_object
    obj.scale = scale
    return smooth(obj, material, subsurf=1)


def keyframes(obj, frames, fn):
    """Keys every frame from fn(t) -> dict(location=..., scale=...) with t in [0, 1)."""
    for f in range(frames):
        values = fn(f / frames)
        for attr, value in values.items():
            setattr(obj, attr, value)
            obj.keyframe_insert(data_path=attr, frame=f)


# ---------- building blocks ----------

def build_cloud(frames, x=0.0, z=0.0, size=1.0, bob=0.04):
    """Puffy cloud from overlapping spheres that bobs gently; returns the parent empty."""
    parent = bpy.data.objects.new("cloud", None)
    bpy.context.scene.collection.objects.link(parent)
    puffs = [(-0.55, 0, 0.0, 0.42), (-0.1, 0, 0.22, 0.55), (0.45, 0, 0.08, 0.45), (0.0, 0.25, -0.05, 0.5)]
    for i, (px, py, pz, r) in enumerate(puffs):
        obj = sphere(r * size, (0, 0, 0), clay("milk" if i != 3 else "cloud_shade", 0.5))
        obj.location = (px * size, py * size, pz * size)
        obj.parent = parent
    keyframes(parent, frames, lambda t: {"location": (x, 0, z + bob * math.sin(2 * math.pi * t))})
    return parent


def build_sun(frames, x, z, radius=0.62, pulse=0.035):
    sun = sphere(radius, (x, 0.35, z), clay("sun", 0.3, emission=0.6))
    keyframes(sun, frames, lambda t: {"scale": [1 + pulse * math.sin(2 * math.pi * t)] * 3})
    # Rays: small rounded rods around the disc, rotating one ray-gap per loop.
    rays = bpy.data.objects.new("rays", None)
    bpy.context.scene.collection.objects.link(rays)
    rays.location = (x, 0.35, z)
    rays.rotation_euler = (math.pi / 2, 0, 0)
    count = 8
    for i in range(count):
        a = 2 * math.pi * i / count
        ray = sphere(0.09, (0, 0, 0), clay("sun_glow", 0.35, emission=0.4), scale=(1, 1, 2.2))
        ray.parent = rays
        d = radius + 0.28
        ray.location = (d * math.cos(a), d * math.sin(a), 0)
        ray.rotation_euler = (0, math.pi / 2, a)
    keyframes(rays, frames, lambda t: {"rotation_euler": (math.pi / 2, 2 * math.pi / count * t, 0)})
    return sun


def build_rain(frames, top=-0.45, fall=1.1, xs=(-0.5, -0.1, 0.3, 0.65), heavy=False):
    """Drops fall from under the cloud, staggered so one loop shows a steady shower."""
    for i, dx in enumerate(xs):
        for k in range(2 if heavy else 1):
            drop = sphere(0.075, (0, 0, 0), clay("rain", 0.25), scale=(1, 1, 1.9))
            offset = (i * 0.37 + k * 0.5) % 1.0

            def at(t, dx=dx, offset=offset):
                p = (t + offset) % 1.0
                # Shrink in/out at the ends so drops appear and vanish without popping.
                s = min(1.0, p / 0.12, (1 - p) / 0.12)
                return {"location": (dx - 0.12 * p, 0.1, top - fall * p), "scale": (s, s, 1.9 * s)}

            keyframes(drop, frames, at)


# ---------- scenes (condition group × day/night) ----------

def scene_rain_day(frames):
    build_sun(frames, 0.55, 0.55)
    build_cloud(frames, 0.0, 0.0)
    build_rain(frames)


SCENES = {
    "rain-day": scene_rain_day,
}

# Fixed framing so every frame (and every icon) shares the same camera.
VIEW = {"center": Vector((0.15, 0, 0.0)), "ortho_scale": 3.4}


# ---------- stage ----------

def reset_scene(frames):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = frames - 1


def stage(size, engine, samples):
    scene = bpy.context.scene
    if engine == "cycles":
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
    else:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.eevee.taa_render_samples = samples
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    world = bpy.data.worlds.new("soft")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.97, 0.98, 1, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    scene.world = world

    def area(name, location, energy, size_, color=(1, 1, 1)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size_
        light.color = color
        obj = bpy.data.objects.new(name, light)
        obj.location = location
        direction = Vector((0, 0, 0)) - Vector(location)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(obj)

    area("key", (-2.5, -4.0, 4.5), 420, 5, (1, 0.98, 0.95))
    area("fill", (4.0, -3.5, 1.0), 90, 6, (0.9, 0.95, 1))
    area("rim", (0.5, 4.5, 3.0), 200, 4, (1, 0.95, 0.9))

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = VIEW["ortho_scale"]
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    direction = Vector((0.25, -1, 0.18)).normalized()
    cam.location = VIEW["center"] + direction * 20
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--only", default="")
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--frames", type=int, default=24)
    parser.add_argument("--engine", choices=["eevee", "cycles"], default="eevee")
    parser.add_argument("--samples", type=int, default=32)
    args = parser.parse_args(argv)
    names = [n for n in args.only.split(",") if n] or list(SCENES)
    for name in names:
        if name not in SCENES:
            raise SystemExit(f"unknown icon: {name}")
        reset_scene(args.frames)
        stage(args.size, args.engine, args.samples)
        SCENES[name](args.frames)
        out_dir = os.path.join(os.path.abspath(args.out), name)
        os.makedirs(out_dir, exist_ok=True)
        scene = bpy.context.scene
        for f in range(args.frames):
            scene.frame_set(f)
            scene.render.filepath = os.path.join(out_dir, f"{f:04d}.png")
            bpy.ops.render.render(write_still=True)
        print(f"ICON rendered {name} ({args.frames} frames)")


main()
