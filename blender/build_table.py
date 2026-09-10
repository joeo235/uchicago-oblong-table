"""The oblong table: a heavy refectory trestle in oak, plus one chair.

The top is a plain flat slab. An earlier version made it a tray holding a
deforming heightfield, which misread the passage: the "table topography" it
describes emerges "as we continually test, manipulate, and move these objects"
— it is the shifting arrangement of the objects on the table, not the table
changing shape. A real table stays flat, and so does this one.

Only one chair is exported; the runtime instances it around the seat ring.
"""
import math

import bmesh
from mathutils import Matrix

import materials as M
import meshutil as U
import palette as P

TOP_Z = P.TABLE_TOP              # 0.75, the working surface
TOP_THICK = 0.10
APRON_TOP = TOP_Z - TOP_THICK
APRON_BOT = APRON_TOP - 0.17

HALF_L, HALF_D = P.TABLE_LEN / 2, P.TABLE_DEP / 2

TRESTLE_X = (-6.8, -3.4, 0.0, 3.4, 6.8)


def _top(bm):
    """One solid slab. Objects rest directly on it."""
    U.add_box(bm, (0, 0, TOP_Z - TOP_THICK / 2),
              (P.TABLE_LEN, P.TABLE_DEP, TOP_THICK))


def _apron(bm):
    z = (APRON_BOT + APRON_TOP) / 2
    h = APRON_TOP - APRON_BOT
    inset = 0.08
    U.add_box(bm, (0, HALF_D - inset - 0.05, z), (P.TABLE_LEN - 0.3, 0.10, h))
    U.add_box(bm, (0, -(HALF_D - inset - 0.05), z), (P.TABLE_LEN - 0.3, 0.10, h))
    U.add_box(bm, (HALF_L - inset - 0.05, 0, z), (0.10, P.TABLE_DEP - 0.3, h))
    U.add_box(bm, (-(HALF_L - inset - 0.05), 0, z), (0.10, P.TABLE_DEP - 0.3, h))


def _trestle(bm, x):
    """Foot rail, standing plank, and a pair of shoulder braces."""
    U.add_box(bm, (x, 0, 0.06), (0.30, P.TABLE_DEP - 0.7, 0.12))
    U.add_box(bm, (x, 0, 0.27), (0.20, P.TABLE_DEP - 1.4, 0.30))
    # braces splaying out to meet the apron
    for sgn in (-1, 1):
        rot = Matrix.Rotation(math.radians(38 * sgn), 4, "X")
        U.add_box(bm, (x, sgn * 0.86, 0.40), (0.14, 0.62, 0.09), matrix=rot)


def _stretcher(bm):
    U.add_box(bm, (0, 0, 0.22), (P.TABLE_LEN - 1.6, 0.20, 0.20))


def build_table():
    bm = U.new_bmesh()
    _top(bm)
    _apron(bm)
    for x in TRESTLE_X:
        _trestle(bm, x)
    _stretcher(bm)
    U.bevel(bm, width=0.008, segments=1)
    U.recalc_normals(bm)
    return U.bm_to_object(bm, "Table", M.oak_dark())


def build_chair():
    """A plain, low chair. Deliberately unadorned — it is furniture, not a person."""
    bm = U.new_bmesh()
    seat_z, w, d = 0.46, 0.42, 0.40
    U.add_box(bm, (0, 0, seat_z), (w, d, 0.05))
    for sx in (-1, 1):
        for sy in (-1, 1):
            U.add_box(bm, (sx * (w / 2 - 0.04), sy * (d / 2 - 0.04), seat_z / 2),
                      (0.045, 0.045, seat_z))
    # back: two uprights, a top rail, and a single pierced splat
    for sx in (-1, 1):
        U.add_box(bm, (sx * (w / 2 - 0.04), -(d / 2 - 0.04), seat_z + 0.24),
                  (0.045, 0.045, 0.48))
    U.add_box(bm, (0, -(d / 2 - 0.04), seat_z + 0.46), (w, 0.05, 0.09))
    U.add_box(bm, (0, -(d / 2 - 0.04), seat_z + 0.20), (0.10, 0.035, 0.36))
    U.bevel(bm, width=0.005, segments=1)
    U.recalc_normals(bm)
    return U.bm_to_object(bm, "Chair", M.oak_mid())


def build():
    return [build_table(), build_chair()]
