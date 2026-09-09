"""Thin helpers over bpy/bmesh so the build scripts stay readable.

Everything here is deterministic: builds are seeded and re-runnable, so the
exported assets are diffable rather than being whatever the GUI last held.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector


def reset_scene():
    """Empty the file completely, including orphaned data-blocks."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for block in list(coll):
            coll.remove(block, do_unlink=True)


def rng(seed):
    return random.Random(seed)


def new_bmesh():
    return bmesh.new()


def bm_to_object(bm, name, material=None, shade_smooth=False):
    """Finalise a bmesh into a scene object and free the bmesh."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if shade_smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    if material is not None:
        obj.data.materials.append(material)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_box(bm, center, size, matrix=None):
    """Axis-aligned box, optionally transformed by `matrix` about its centre."""
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    sx, sy, sz = size
    m = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((sx, sy, sz, 1.0))
    if matrix is not None:
        m = Matrix.Translation(Vector(center)) @ matrix @ Matrix.Diagonal((sx, sy, sz, 1.0))
    bmesh.ops.transform(bm, matrix=m, verts=verts, space=Matrix.Identity(4))
    return verts


def add_cylinder(bm, center, radius, depth, segments=16, axis="Z", cap=True):
    verts = bmesh.ops.create_cone(
        bm, cap_ends=cap, cap_tris=False, segments=segments,
        radius1=radius, radius2=radius, depth=depth,
    )["verts"]
    m = Matrix.Translation(Vector(center))
    if axis == "X":
        m = m @ Matrix.Rotation(math.radians(90), 4, "Y")
    elif axis == "Y":
        m = m @ Matrix.Rotation(math.radians(90), 4, "X")
    bmesh.ops.transform(bm, matrix=m, verts=verts, space=Matrix.Identity(4))
    return verts


def add_cone(bm, center, r1, r2, depth, segments=16):
    verts = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=r1, radius2=r2, depth=depth,
    )["verts"]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(center)),
                        verts=verts, space=Matrix.Identity(4))
    return verts


def add_icosphere(bm, center, radius, subdiv=2):
    verts = bmesh.ops.create_icosphere(
        bm, subdivisions=subdiv, radius=radius,
    )["verts"]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(center)),
                        verts=verts, space=Matrix.Identity(4))
    return verts


def add_torus(bm, center, major_r, minor_r, major_seg=24, minor_seg=8, matrix=None):
    """Torus in the XY plane, then optionally rotated about its own centre."""
    start = len(bm.verts)
    bm.verts.ensure_lookup_table()
    rings = []
    for i in range(major_seg):
        a = 2 * math.pi * i / major_seg
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(minor_seg):
            b = 2 * math.pi * j / minor_seg
            r = major_r + minor_r * math.cos(b)
            v = Vector((r * ca, r * sa, minor_r * math.sin(b)))
            ring.append(bm.verts.new(v))
        rings.append(ring)
    for i in range(major_seg):
        nr = rings[(i + 1) % major_seg]
        cr = rings[i]
        for j in range(minor_seg):
            nj = (j + 1) % minor_seg
            bm.faces.new((cr[j], nr[j], nr[nj], cr[nj]))
    bm.verts.ensure_lookup_table()
    new_verts = bm.verts[start:]
    m = Matrix.Translation(Vector(center)) @ (matrix or Matrix.Identity(4))
    bmesh.ops.transform(bm, matrix=m, verts=new_verts, space=Matrix.Identity(4))
    return new_verts


def bevel(bm, width=0.01, segments=1, only_edges=None):
    edges = only_edges if only_edges is not None else list(bm.edges)
    bmesh.ops.bevel(
        bm, geom=edges, offset=width, segments=segments,
        profile=0.5, affect="EDGES", clamp_overlap=True,
    )


def recalc_normals(bm):
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


def join_objects(objects, name):
    """Join a list of objects into the first one and rename it."""
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    return joined


def export_glb(filepath, objects=None):
    """Export the scene (or a selection) to a .glb, Y-up, Draco off."""
    if objects is not None:
        bpy.ops.object.select_all(action="DESELECT")
        for o in objects:
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=objects is not None,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=True,
    )
