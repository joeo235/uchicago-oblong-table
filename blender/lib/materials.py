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


def ai_object(index):
    """One emissive material per archetype.

    Emission is modest here; the runtime drives the pulse, so a hot bake would
    fight the shader that makes these things read as 'constantly changing'.
    """
    tint = P.OBJECT_TINTS[index]
    name = "AIObject_%02d" % index
    # Kept dark and low-emission on purpose. glTF normalises an emissive colour
    # and pushes the excess into KHR_materials_emissive_strength, so a bright
    # tint here comes back out of the exporter washed toward white.
    return _principled(
        name, tuple(c * 0.10 for c in tint),
        metallic=0.20, roughness=0.30,
        emission=tint, emission_strength=0.42,
    )
