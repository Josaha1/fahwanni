"""Matte relief plate for the map, rendered headless from a Mercator-space heightmap.

  Blender -b -P scripts/blender/relief-terrain.py -- --heightmap .cache/map/heightmap-smooth.png \
      --out .cache/map/relief-light.png --theme light [--width 1024] [--samples 32]
"""
import argparse
import sys

import bpy

MAX_M = 6000.0
EXAGGERATION = 0.09
TINTS = {
    "light": ((0, "#e7eae6"), (300, "#dfe3d6"), (1200, "#d6d0bf"), (2500, "#cbc3ae")),
    "dark": ((0, "#141e29"), (300, "#17222c"), (1200, "#1d2730"), (2500, "#252d35")),
}


def hex_rgb(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


def build(heightmap_path, aspect, theme):
    img = bpy.data.images.load(heightmap_path)
    img.colorspace_settings.name = "Non-Color"

    bpy.ops.mesh.primitive_grid_add(x_subdivisions=512, y_subdivisions=int(512 * aspect), size=1)
    plane = bpy.context.active_object
    plane.scale = (1.0, aspect, 1.0)
    bpy.ops.object.transform_apply(scale=True)

    tex = bpy.data.textures.new("dem", type="IMAGE")
    tex.image = img
    tex.extension = "EXTEND"
    disp = plane.modifiers.new("dem", "DISPLACE")
    disp.texture = tex
    disp.texture_coords = "UV"
    disp.strength = EXAGGERATION
    disp.mid_level = 0.0

    mat = bpy.data.materials.new(f"relief-{theme}")
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    uv = nodes.new("ShaderNodeTexCoord")
    height = nodes.new("ShaderNodeTexImage")
    height.image = img
    height.interpolation = "Cubic"
    links.new(uv.outputs["UV"], height.inputs["Vector"])

    land = nodes.new("ShaderNodeMath")
    land.operation = "GREATER_THAN"
    land.inputs[1].default_value = 5.0 / MAX_M
    links.new(height.outputs["Color"], land.inputs[0])

    ramp = nodes.new("ShaderNodeValToRGB")
    for i, (metres, color) in enumerate(TINTS[theme]):
        element = ramp.color_ramp.elements[i] if i < 2 else ramp.color_ramp.elements.new(metres / MAX_M)
        element.position = metres / MAX_M
        element.color = (*hex_rgb(color), 1)
    links.new(height.outputs["Color"], ramp.inputs["Fac"])
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    links.new(ramp.outputs["Color"], diffuse.inputs["Color"])

    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(land.outputs[0], mix.inputs["Fac"])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(diffuse.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])

    plane.data.materials.append(mat)
    for poly in plane.data.polygons:
        poly.use_smooth = True


def stage(width, aspect, samples, theme):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = samples
    scene.render.resolution_x = width
    scene.render.resolution_y = int(round(width * aspect))
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.use_nodes = False

    world = bpy.data.worlds.new("soft-grey")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.5, 0.5, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7 if theme == "light" else 0.3
    scene.world = world

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 2.4 if theme == "light" else 3.4
    sun_data.color = (1, 1, 1)
    sun = bpy.data.objects.new("sun", sun_data)
    sun.rotation_euler = (0.9, 0.0, 2.35)
    scene.collection.objects.link(sun)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = aspect
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0, 0, 5)
    cam.rotation_euler = (0, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--heightmap", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=32)
    parser.add_argument("--theme", choices=TINTS, required=True)
    args = parser.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    img = bpy.data.images.load(args.heightmap)
    aspect = img.size[1] / img.size[0]
    bpy.data.images.remove(img)
    build(args.heightmap, aspect, args.theme)
    stage(args.width, aspect, args.samples, args.theme)
    bpy.context.scene.render.filepath = args.out
    bpy.ops.render.render(write_still=True)
    print(f"RELIEF {args.theme} rendered {args.out} ({args.width}x{int(round(args.width * aspect))})")


main()
