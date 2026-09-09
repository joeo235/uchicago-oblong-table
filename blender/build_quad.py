"""The central Quad, stylised.

Not a replica of Cobb or Harper — a replica would be both expensive and
uncanny, and it would pull attention off the table. What is modelled instead is
the *rhythm* the Quad reads by at dusk: a unified cornice line, projecting and
recessed bays, varied roof forms, crenellation, and tall narrow windows. Blue
Bedford limestone goes nearly black against a dusk sky; the windows carry the
warmth, so they are exported as their own emissive object.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import materials as M
import meshutil as U
import palette as P

CORNICE_Z = 12.4          # the common line every range is tied to
SIDE_RUN = P.QUAD_INNER   # length of one side's building range


def _gable(bm, center, width, depth, height):
    """Triangular prism roof, ridge running along X."""
    cx, cy, cz = center
    hw, hd = width / 2, depth / 2
    pts = [
        (-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0),
        (-hw, 0, height), (hw, 0, height),
    ]
    v = [bm.verts.new(Vector((cx + x, cy + y, cz + z))) for x, y, z in pts]
    bm.faces.new((v[0], v[1], v[2], v[3]))      # underside
    bm.faces.new((v[0], v[4], v[5], v[1]))      # slope
    bm.faces.new((v[3], v[2], v[5], v[4]))      # slope
    bm.faces.new((v[0], v[3], v[4]))            # end
    bm.faces.new((v[1], v[5], v[2]))            # end
    return v


def _crenellate(bm, center, width, depth, rng):
    """Battlements: merlons with gaps, marching along X."""
    cx, cy, cz = center
    step = 0.9
    n = max(2, int(width / step))
    step = width / n
    for i in range(n):
        if i % 2:
            continue
        x = cx - width / 2 + step * (i + 0.5)
        U.add_box(bm, (x, cy, cz + 0.28), (step * 0.86, depth, 0.56))
    # the parapet the merlons stand on
    U.add_box(bm, (cx, cy, cz - 0.10), (width, depth, 0.20))


def _windows(bmw, origin, width, height_top, rng):
    """Tall narrow lancets on the quad-facing plane (local +Y face at y=0)."""
    ox, oy, oz = origin
    cols = max(2, int(width / 1.9))
    gap = width / cols
    levels = [2.4, 5.6, 8.6]
    for c in range(cols):
        x = ox - width / 2 + gap * (c + 0.5)
        for lz in levels:
            if lz + 2.0 > height_top:
                continue
            if rng.random() < 0.56:      # not every room is occupied
                continue
            U.add_box(bmw, (x, oy + 0.06, oz + lz + 0.9),
                      (gap * 0.30, 0.10, 1.8))


def _side(bm, bmw, rng):
    """One range of buildings, running along X with its face at y = 0."""
    x = -SIDE_RUN / 2
    while x < SIDE_RUN / 2 - 1.0:
        w = min(rng.uniform(4.5, 9.0), SIDE_RUN / 2 - x)
        if w < 2.0:
            break
        cx = x + w / 2

        tower = rng.random() < 0.22
        if tower:
            w = min(w, 5.0)
            cx = x + w / 2
            h = CORNICE_Z + rng.uniform(3.5, 6.5)
        else:
            h = CORNICE_Z + rng.uniform(-1.1, 1.1)

        # bays project into or recede from the quad
        depth = rng.uniform(7.0, 10.5)
        proj = rng.uniform(-0.5, 1.6)
        cy = -depth / 2 + proj

        U.add_box(bm, (cx, cy, h / 2), (w, depth, h))
        # cornice band, tied to the common line on every range
        U.add_box(bm, (cx, cy, CORNICE_Z), (w + 0.34, depth + 0.34, 0.42))

        top = (cx, cy, h)
        if tower or rng.random() < 0.42:
            _crenellate(bm, top, w + 0.2, depth + 0.2, rng)
        else:
            _gable(bm, top, w, depth, rng.uniform(2.2, 3.6))

        _windows(bmw, (cx, proj, 0.0), w, h, rng)
        x += w


def build_quad():
    """Four ranges, each built at the origin then spun out to its own side."""
    bm = U.new_bmesh()
    bmw = U.new_bmesh()
    for i in range(4):
        m = (Matrix.Rotation(math.radians(90 * i), 4, "Z")
             @ Matrix.Translation(Vector((0, -P.QUAD_INNER / 2, 0))))
        rng = U.rng(4100 + i)
        starts = (len(bm.verts), len(bmw.verts))
        _side(bm, bmw, rng)
        # only the geometry this side just added gets moved into place
        for mesh, start in ((bm, starts[0]), (bmw, starts[1])):
            mesh.verts.ensure_lookup_table()
            bmesh.ops.transform(mesh, matrix=m, verts=mesh.verts[start:],
                                space=Matrix.Identity(4))
    U.recalc_normals(bm)
    U.recalc_normals(bmw)
    walls = U.bm_to_object(bm, "Quad", M.limestone())
    win_mat = M._principled("WindowLit", (0.085, 0.062, 0.038),
                            emission=(1.0, 0.72, 0.40), emission_strength=0.85,
                            roughness=0.45)
    windows = U.bm_to_object(bmw, "QuadWindows", win_mat)
    return [walls, windows]


def build_ground():
    """The lawn, with a shallow cross of paths meeting under the table."""
    bm = U.new_bmesh()
    span = P.QUAD_INNER + 26.0
    U.add_box(bm, (0, 0, -0.06), (span, span, 0.12))
    U.recalc_normals(bm)
    ground = U.bm_to_object(bm, "Ground",
                            M._principled("Lawn", (0.022, 0.032, 0.019),
                                          roughness=0.95))
    bmp = U.new_bmesh()
    U.add_box(bmp, (0, 0, 0.005), (P.QUAD_INNER + 8, 7.0, 0.02))
    U.add_box(bmp, (0, 0, 0.005), (7.0, P.QUAD_INNER + 8, 0.02))
    U.recalc_normals(bmp)
    paths = U.bm_to_object(bmp, "Paths",
                           M._principled("Path", (0.062, 0.058, 0.050),
                                         roughness=0.9))
    return [ground, paths]


def build():
    return build_quad() + build_ground()
