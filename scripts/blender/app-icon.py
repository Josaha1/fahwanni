"""ฟ้าวันนี้ home-screen icon subject: a clay sun peeking over a puffy cloud, rendered as one still.

  Blender -b -P scripts/blender/app-icon.py -- --out .cache/app-icon/subject.png [--size 1024] [--samples 64]

Transparent background; scripts/app-icon/build.mjs puts it on the sky tile and writes every size.
Same clay look as the in-app condition icons (scripts/blender/icons.py), but a single, bolder,
front-facing composition so the silhouette still reads at 48 px.
"""
import argparse
import math
import sys

import bpy
from mathutils import Vector

COLORS = {
    "sun": "#FFC53D",
    "sun_glow": "#FFA928",
    "cloud": "#FFFFFF",
    "cloud_shade": "#E3ECF7",
}


def linear(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb], 1.0)


def clay(name, roughness=0.45, emission=0.0):
    mat = bpy.data.materials.new(f"clay-{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = linear(COLORS[name])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = 0.3
    bsdf.inputs["Subsurface Weight"].default_value = 0.05
    if emission:
        bsdf.inputs["Emission Color"].default_value = linear(COLORS[name])
        bsdf.inputs["Emission Strength"].default_value = emission
    return mat


def sphere(radius, location, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location, segments=48, ring_count=24)
    obj = bpy.context.active_object
    obj.scale = scale
    obj.data.materials.append(material)
    mod = obj.modifiers.new("subsurf", "SUBSURF")
    mod.levels = mod.render_levels = 1
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def build():
    # Sun: upper right, behind the cloud (y > 0 is away from the camera).
    sun_center = (0.42, 0.6, 0.38)
    sphere(0.72, sun_center, clay("sun", 0.3, emission=0.55))
    rays = clay("sun_glow", 0.35, emission=0.4)
    for i in range(10):
        a = 2 * math.pi * i / 10 + math.pi / 10
        d = 0.72 + 0.3
        ray = sphere(0.1, (0, 0, 0), rays, scale=(1, 1, 2.3))
        ray.location = (sun_center[0] + d * math.cos(a), sun_center[1], sun_center[2] + d * math.sin(a))
        ray.rotation_euler = (0, math.pi / 2 - a, 0)
    # Cloud: lower left, in front; big overlapping puffs so the silhouette stays bold.
    top, shade = clay("cloud", 0.5), clay("cloud_shade", 0.55)
    for x, y, z, r, material in [
        (-0.62, 0.0, -0.32, 0.46, top),
        (-0.12, -0.05, -0.02, 0.62, top),
        (0.46, 0.0, -0.28, 0.5, top),
        (-0.05, 0.12, -0.5, 0.56, shade),
        (0.05, -0.2, -0.46, 0.5, top),
    ]:
        sphere(r, (x, y, z), material)


def stage(size, samples):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = samples
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    # A cool sky-blue ambient so the white cloud's shadows read as sky, not grey.
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.62, 0.78, 1.0, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
    scene.world = world

    def area(name, location, energy, size_, color=(1, 1, 1)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.size, light.color = energy, size_, color
        obj = bpy.data.objects.new(name, light)
        obj.location = location
        obj.rotation_euler = (Vector((0, 0, 0)) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(obj)

    area("key", (-2.5, -4.0, 4.5), 480, 5, (1, 0.97, 0.92))
    area("fill", (4.0, -3.5, 0.5), 110, 6, (0.88, 0.94, 1))
    area("rim", (0.5, 4.5, 3.0), 260, 4, (1, 0.93, 0.85))

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    # Wide enough that the sun's outer rays (up to ~x 1.5, z 1.5) stay inside the frame.
    cam_data.ortho_scale = 3.6
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    center = Vector((0.2, 0, 0.12))
    direction = Vector((0.12, -1, 0.1)).normalized()
    cam.location = center + direction * 20
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--size", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=64)
    args = parser.parse_args(argv)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    stage(args.size, args.samples)
    bpy.context.scene.render.filepath = args.out
    bpy.ops.render.render(write_still=True)
    print(f"APP-ICON rendered {args.out}")


main()
