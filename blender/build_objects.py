"""Nine AI object archetypes.

"Powerful, flexible, and constantly changing." The changing part is the
runtime's job — every one of these carries a noise-driven vertex morph in
Three.js — so what matters here is that each form is distinct in silhouette and
that none of them is a cliche. No brains, no chips, no humanoid robots. These
are objects you would want to pick up, which is the only claim the passage
makes about them.

Each is centred on its own origin and fits inside a sphere of radius ~0.22.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import materials as M
import meshutil as U
import palette as P

R = 0.22          # nominal enclosing radius


def tube_along(bm, points, radius, sides=6, close=False):
    """Sweep a polygon along a polyline using parallel transport (no twist)."""
    pts = [Vector(p) for p in points]
    n = len(pts)
    tangents = []
    for i in range(n):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized())

    # seed a reference normal that is not parallel to the first tangent
    up = Vector((0, 0, 1))
    if abs(tangents[0].dot(up)) > 0.95:
        up = Vector((1, 0, 0))
    nrm = (up - tangents[0] * up.dot(tangents[0])).normalized()

    rings = []
    for i in range(n):
        if i > 0:                      # transport the normal along the curve
            nrm = (nrm - tangents[i] * nrm.dot(tangents[i]))
            if nrm.length < 1e-6:
                nrm = Vector((0, 0, 1)) - tangents[i] * tangents[i].z
            nrm.normalize()
        binm = tangents[i].cross(nrm)
        ring = []
        for s in range(sides):
            a = 2 * math.pi * s / sides
            off = nrm * (math.cos(a) * radius) + binm * (math.sin(a) * radius)
            ring.append(bm.verts.new(pts[i] + off))
        rings.append(ring)

    span = n if close else n - 1
    for i in range(span):
        a, b = rings[i], rings[(i + 1) % n]
        for s in range(sides):
            ns = (s + 1) % sides
            bm.faces.new((a[s], b[s], b[ns], a[ns]))
    if not close:
        bm.faces.new(tuple(reversed(rings[0])))
        bm.faces.new(tuple(rings[-1]))
    return rings


# ------------------------------------------------------------- archetypes
def lattice_knot(bm, rng):
    p, q, steps = 2, 3, 72
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        r = 0.62 + 0.28 * math.cos(q * t)
        pts.append((R * r * math.cos(p * t),
                    R * r * math.sin(p * t),
                    R * 0.34 * math.sin(q * t)))
    tube_along(bm, pts, R * 0.085, sides=6, close=True)


def plate_stack(bm, rng):
    n = 7
    for i in range(n):
        f = i / (n - 1)
        z = (f - 0.5) * R * 1.5
        s = R * (1.55 - 0.62 * abs(f - 0.42) * 2)
        rot = Matrix.Rotation(math.radians(18 * i + rng.uniform(-5, 5)), 4, "Z")
        U.add_box(bm, (rng.uniform(-.012, .012), rng.uniform(-.012, .012), z),
                  (s, s * 0.72, R * 0.10), matrix=rot)


def ring_spiral(bm, rng):
    n = 9
    for i in range(n):
        f = i / (n - 1)
        a = 2.4 * math.pi * f
        z = (f - 0.5) * R * 1.4
        rad = R * (0.30 + 0.34 * math.sin(math.pi * f))
        tilt = (Matrix.Rotation(a, 4, "Z")
                @ Matrix.Rotation(math.radians(62), 4, "X"))
        U.add_torus(bm, (rad * math.cos(a) * 0.5, rad * math.sin(a) * 0.5, z),
                    R * 0.34, R * 0.045, 16, 6, matrix=tilt)


def rod_cluster(bm, rng):
    for _ in range(15):
        th = rng.uniform(0, 2 * math.pi)
        ph = math.acos(rng.uniform(-1, 1))
        d = Vector((math.sin(ph) * math.cos(th),
                    math.sin(ph) * math.sin(th),
                    math.cos(ph)))
        ln = R * rng.uniform(0.85, 1.55)
        tube_along(bm, [(-d * R * 0.12), (d * ln)], R * 0.045, sides=5)


def folded_ribbon(bm, rng):
    cols, rows = 26, 3
    grid = []
    for i in range(cols):
        f = i / (cols - 1)
        t = f * 2.7 * math.pi
        cx = R * 1.15 * math.cos(t * 0.55) * (0.55 + 0.45 * f)
        cy = R * 1.15 * math.sin(t * 0.55) * (0.55 + 0.45 * f)
        cz = (f - 0.5) * R * 1.25
        twist = t * 0.8
        col = []
        for j in range(rows):
            g = (j / (rows - 1) - 0.5) * R * 0.66
            col.append(bm.verts.new(Vector((
                cx + g * math.cos(twist) * 0.35,
                cy + g * math.sin(twist) * 0.35,
                cz + g * math.cos(twist)))))
        grid.append(col)
    for i in range(cols - 1):
        for j in range(rows - 1):
            bm.faces.new((grid[i][j], grid[i + 1][j],
                          grid[i + 1][j + 1], grid[i][j + 1]))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=R * 0.05)


def faceted_seed(bm, rng):
    verts = U.add_icosphere(bm, (0, 0, 0), R * 0.98, subdiv=1)
    for v in verts:
        v.co *= 1.0 + rng.uniform(-0.26, 0.30)
        v.co.z *= 1.16


def nested_cage(bm, rng):
    for k, scale in enumerate((1.0, 0.68, 0.40)):
        rad = R * scale
        for axis, ang in (("X", 0), ("Y", 0), ("Z", 0)):
            rot = Matrix.Rotation(math.radians(90 if axis != "Z" else 0), 4,
                                  "X" if axis == "X" else "Y")
            U.add_torus(bm, (0, 0, 0), rad, R * 0.028 * (1 - 0.15 * k),
                        20, 5, matrix=rot)


def filament_bundle(bm, rng):
    for _ in range(18):
        a0 = rng.uniform(0, 2 * math.pi)
        spread = rng.uniform(0.25, 1.0)
        pts = []
        for s in range(7):
            f = s / 6
            a = a0 + f * rng.uniform(1.2, 2.6)
            r = R * spread * f * 0.92
            pts.append((r * math.cos(a), r * math.sin(a), (f - 0.5) * R * 1.7))
        tube_along(bm, pts, R * 0.028, sides=4)


def torus_weave(bm, rng):
    axes = [(0, 0), (58, 0), (0, 62), (44, 48), (-40, 30)]
    for i, (rx, ry) in enumerate(axes):
        rot = (Matrix.Rotation(math.radians(rx), 4, "X")
               @ Matrix.Rotation(math.radians(ry), 4, "Y"))
        U.add_torus(bm, (0, 0, 0), R * (0.92 - 0.06 * i), R * 0.062,
                    22, 6, matrix=rot)


BUILDERS = [lattice_knot, plate_stack, ring_spiral, rod_cluster,
            folded_ribbon, faceted_seed, nested_cage, filament_bundle,
            torus_weave]


def build():
    objs = []
    for i, fn in enumerate(BUILDERS):
        bm = U.new_bmesh()
        fn(bm, U.rng(9000 + i * 37))
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
        U.recalc_normals(bm)
        smooth = fn not in (plate_stack, faceted_seed)
        obj = U.bm_to_object(bm, "AIObject_%02d" % i, M.ai_object(i),
                             shade_smooth=smooth)
        obj["archetype"] = P.OBJECT_NAMES[i]
        obj["index"] = i
        objs.append(obj)
    return objs
