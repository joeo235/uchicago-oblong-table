"""The oblong table: a heavy refectory trestle in dark oak, plus one chair.

The table top is deliberately a *tray* — a rim frame around an open, recessed
bed. The live heightfield built in Three.js fills that bed, so the relief has
room to rise and dip without ever escaping the furniture. The rim is also where
objects that get set aside come to rest.

Only one chair is exported; the runtime instances it around the seat ring.
"""
import math

import bmesh
from mathutils import Matrix

import materials as M
import meshutil as U
import palette as P

RIM_TOP = P.TABLE_TOP            # 0.75, flush with the heightfield base plane
RIM_BOT = RIM_TOP - 0.18
BED_Z = RIM_TOP - 0.15           # solid floor under the heightfield
APRON_TOP = RIM_BOT
APRON_BOT = APRON_TOP - 0.17

HALF_L, HALF_D = P.TABLE_LEN / 2, P.TABLE_DEP / 2
IN_L, IN_D = P.FIELD_LEN / 2, P.FIELD_DEP / 2

TRESTLE_X = (-6.8, -3.4, 0.0, 3.4, 6.8)


def _rim(bm):
    """Four bars forming the tray lip, mitred by simple overlap at the ends."""
    z = (RIM_BOT + RIM_TOP) / 2
    h = RIM_TOP - RIM_BOT
    # long sides run the full length; short ends fill between them
    U.add_box(bm, (0, (IN_D + HALF_D) / 2, z), (P.TABLE_LEN, P.RIM, h))
    U.add_box(bm, (0, -(IN_D + HALF_D) / 2, z), (P.TABLE_LEN, P.RIM, h))
    U.add_box(bm, ((IN_L + HALF_L) / 2, 0, z), (P.RIM, P.FIELD_DEP, h))
    U.add_box(bm, (-(IN_L + HALF_L) / 2, 0, z), (P.RIM, P.FIELD_DEP, h))


def _bed(bm):
    """The recessed floor the heightfield sits above."""
    U.add_box(bm, (0, 0, BED_Z), (P.FIELD_LEN, P.FIELD_DEP, 0.04))


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
    _rim(bm)
    _bed(bm)
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
