"""Principled BSDF materials that survive the glTF round-trip cleanly.

Kept deliberately plain: base colour, metallic, roughness, emission. The real
lighting happens at runtime in Three.js against a dusk environment, so nothing
here should try to bake in a look.
"""
import bpy

import palette as P


def _principled(name, base, metallic=0.0, roughness=0.7,
                emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        mat.blend_method = "BLEND"
    return mat


def oak_dark():
    return _principled("OakDark", P.OAK_DARK, roughness=0.62)


def oak_mid():
    return _principled("OakMid", P.OAK_MID, roughness=0.55)


def limestone():
    return _principled("Limestone", P.LIMESTONE, roughness=0.88)


def limestone_hi():
    return _principled("LimestoneHi", P.LIMESTONE_HI, roughness=0.85)


def slate():
    return _principled("Slate", P.SLATE_ROOF, roughness=0.72)


def brass():
    return _principled("Brass", P.BRASS, metallic=0.9, roughness=0.34)


def window_glass():
    """Leaded glazing, seen from outside on a bright day.

    Matte and very dark on purpose. Physically accurate glass at low roughness
    mirrors the sky, which at this distance makes every window exactly as
    bright as the limestone around it and the facade reads as a blank slab.
    A dark interior is both truthful and legible.
    """
    return _principled("WindowGlass", (0.018, 0.022, 0.028),
                       metallic=0.0, roughness=0.42)


def lawn():
    return _principled("Lawn", P.LAWN, roughness=0.95)


def path_stone():
    return _principled("PathStone", P.PATH_STONE, roughness=0.88)


def bark():
    return _principled("Bark", P.BARK, roughness=0.92)


def leaf():
    return _principled("Leaf", P.LEAF, roughness=0.86)


def ai_object(index):
    """One emissive material per archetype.

    Emission is modest here; the runtime drives the pulse, so a hot bake would
    fight the shader that makes these things read as 'constantly changing'.
    """
    tint = P.OBJECT_TINTS[index]
    name = "AIObject_%02d" % index
    # In daylight the base colour does the work, so these are simply their own
    # colour. A trace of emission keeps them looking active rather than inert,
    # but anything more washes out: glTF normalises an emissive colour and
    # pushes the excess into KHR_materials_emissive_strength, so a bright tint
    # comes back out of the exporter close to white.
    return _principled(
        name, tint, metallic=0.05, roughness=0.42,
        emission=tint, emission_strength=0.10,
    )
