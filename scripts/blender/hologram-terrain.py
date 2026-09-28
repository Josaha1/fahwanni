"""Neon hologram terrain plate for the map tab, rendered headless.

  Blender -b -P scripts/blender/hologram-terrain.py -- --heightmap .cache/map/heightmap.png \\
      --out .cache/map/hologram.png [--width 1024] [--samples 32]

The heightmap (scripts/map/stitch-dem.mjs) is already Web-Mercator tile space, so a flat plane
viewed straight down by an orthographic camera that exactly frames it gives an image that
MapLibre can place by its four corners. Look: dark land with hillshade, glowing cyan contour
lines every 250 m, cyan rim glow on steep slopes, transparent sea, bloom from the compositor.
"""
import argparse
import sys

import bpy

MAX_M = 6000.0       # heightmap 1.0 == 6000 m (stitch-dem.mjs)
CONTOUR_M = 500.0    # contour interval
MIN_CONTOUR_M = 150.0  # no contours on low plains (the 0 m line would flood them with glow)
EXAGGERATION = 0.07  # plane units per heightmap 1.0 (plane is 1 unit wide ≈ 2500 km)


def hex_rgb(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


def build(heightmap_path, aspect):
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

    mat = bpy.data.materials.new("hologram")
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    uv = nodes.new("ShaderNodeTexCoord")
    height = nodes.new("ShaderNodeTexImage")
    height.image = img
    height.interpolation = "Cubic"
    links.new(uv.outputs["UV"], height.inputs["Vector"])

    # metres → contour line mask: 1 near every CONTOUR_M multiple, else 0.
    metres = nodes.new("ShaderNodeMath"); metres.operation = "MULTIPLY"; metres.inputs[1].default_value = MAX_M / CONTOUR_M
    links.new(height.outputs["Color"], metres.inputs[0])
    frac = nodes.new("ShaderNodeMath"); frac.operation = "FRACT"
    links.new(metres.outputs[0], frac.inputs[0])
    centred = nodes.new("ShaderNodeMath"); centred.operation = "SUBTRACT"; centred.inputs[1].default_value = 0.5
    links.new(frac.outputs[0], centred.inputs[0])
    dist = nodes.new("ShaderNodeMath"); dist.operation = "ABSOLUTE"
    links.new(centred.outputs[0], dist.inputs[0])
    raw_line = nodes.new("ShaderNodeMath"); raw_line.operation = "GREATER_THAN"; raw_line.inputs[1].default_value = 0.46
    links.new(dist.outputs[0], raw_line.inputs[0])
    high = nodes.new("ShaderNodeMath"); high.operation = "GREATER_THAN"; high.inputs[1].default_value = MIN_CONTOUR_M / MAX_M
    links.new(height.outputs["Color"], high.inputs[0])
    line = nodes.new("ShaderNodeMath"); line.operation = "MULTIPLY"
    links.new(raw_line.outputs[0], line.inputs[0])
    links.new(high.outputs[0], line.inputs[1])

    # Land mask: anything above ~5 m.
    land = nodes.new("ShaderNodeMath"); land.operation = "GREATER_THAN"; land.inputs[1].default_value = 5.0 / MAX_M
    links.new(height.outputs["Color"], land.inputs[0])

    # Land colour: dark indigo diffuse (hillshade from the sun) brightening a little with height.
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*hex_rgb("#0b1236"), 1)
    ramp.color_ramp.elements[1].position = 0.5
    ramp.color_ramp.elements[1].color = (*hex_rgb("#2a2f7a"), 1)
    links.new(height.outputs["Color"], ramp.inputs["Fac"])
    diffuse = nodes.new("ShaderNodeBsdfDiffuse")
    links.new(ramp.outputs["Color"], diffuse.inputs["Color"])

    # Glow: contour lines + rim on steep slopes (facing ratio), cyan emission.
    facing = nodes.new("ShaderNodeLayerWeight"); facing.inputs["Blend"].default_value = 0.35
    rim = nodes.new("ShaderNodeMath"); rim.operation = "MULTIPLY"; rim.inputs[1].default_value = 0.25
    links.new(facing.outputs["Facing"], rim.inputs[0])
    glow_amount = nodes.new("ShaderNodeMath"); glow_amount.operation = "ADD"
    links.new(line.outputs[0], glow_amount.inputs[0])
    links.new(rim.outputs[0], glow_amount.inputs[1])
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*hex_rgb("#38e8ff"), 1)
    strength = nodes.new("ShaderNodeMath"); strength.operation = "MULTIPLY"; strength.inputs[1].default_value = 1.4
    links.new(glow_amount.outputs[0], strength.inputs[0])
    links.new(strength.outputs[0], emission.inputs["Strength"])
    shaded = nodes.new("ShaderNodeAddShader")
    links.new(diffuse.outputs[0], shaded.inputs[0])
    links.new(emission.outputs[0], shaded.inputs[1])

    # Sea → transparent so the neon basemap water and coast glow show through.
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(land.outputs[0], mix.inputs["Fac"])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(shaded.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])

    plane.data.materials.append(mat)
    for poly in plane.data.polygons:
        poly.use_smooth = True
    return plane


def stage(width, aspect, samples):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = samples
    scene.render.resolution_x = width
    scene.render.resolution_y = int(round(width * aspect))
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"

    world = bpy.data.worlds.new("void")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.02, 0.05, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.2
    scene.world = world

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 2.2
    sun_data.color = hex_rgb("#9fb4ff")
    sun = bpy.data.objects.new("sun", sun_data)
    # Classic cartographic hillshade: light from the north-west, fairly low.
    sun.rotation_euler = (0.9, 0.0, 2.35)
    scene.collection.objects.link(sun)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = aspect  # ortho_scale spans the larger side (height here)
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0, 0, 5)
    cam.rotation_euler = (0, 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam

    # Bloom via compositor Glare (EEVEE Next has no legacy bloom checkbox).
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"
    glare.quality = "HIGH"
    glare.threshold = 0.9
    glare.size = 6
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], comp.inputs["Image"])


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--heightmap", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=32)
    args = parser.parse_args(argv)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    img = bpy.data.images.load(args.heightmap)
    aspect = img.size[1] / img.size[0]
    bpy.data.images.remove(img)
    build(args.heightmap, aspect)
    stage(args.width, aspect, args.samples)
    bpy.context.scene.render.filepath = args.out
    bpy.ops.render.render(write_still=True)
    print(f"HOLOGRAM rendered {args.out} ({args.width}x{int(round(args.width * aspect))})")


main()
