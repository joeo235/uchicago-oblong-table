"""The central Quad, in daylight.

Still stylised rather than a survey of Cobb and Harper, but built from the
actual vocabulary rather than boxes with rectangles cut in them: pointed
two-centred arches, mullions and hood moulds, stepped buttresses with gablets,
string courses, crenellated parapets and steep gables with finials, and a tower
on the corners. Gothic has no rectangular windows, so there are none here.

The ranges stand well back — this is a large open lawn with trees, not a
courtyard — so the table sits alone in the middle of a lot of grass.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import materials as M
import meshutil as U
import palette as P

CORNICE_Z = P.QUAD_HEIGHT          # the common line every range is tied to
SIDE_RUN = P.QUAD_INNER + 26.0     # ranges overrun so the corners read solid
BAY = 9.2                          # centre-to-centre spacing of the bays


# --------------------------------------------------------------- geometry
def lancet_points(w, straight_h, seg=5):
    """Outline of a two-centred (equilateral) pointed arch, in local x/z.

    The arcs have radius equal to the full width and spring from the opposite
    jamb, which is what gives Gothic its characteristic proportion: the apex
    lands at w*sqrt(3)/2 above the springing, not at a semicircle's w/2.
    """
    hw = w / 2
    pts = [(-hw, 0.0), (-hw, straight_h)]
    apex_z = straight_h + w * math.sqrt(3) / 2
    # left arc: centre at (+hw, straight_h), radius w
    a0 = math.atan2(straight_h - straight_h, -hw - hw)          # pi
    a1 = math.atan2(apex_z - straight_h, 0.0 - hw)
    for i in range(1, seg + 1):
        a = a0 + (a1 - a0) * i / seg
        pts.append((hw + w * math.cos(a), straight_h + w * math.sin(a)))
    # right arc: mirror of the left, walked back down
    for i in range(seg - 1, -1, -1):
        a = a0 + (a1 - a0) * i / seg
        pts.append((-hw - w * math.cos(a), straight_h + w * math.sin(a)))
    pts.append((hw, 0.0))
    return pts


def prism(bm, pts, origin, y0, y1):
    """Extrude a 2D outline (x, z) along Y into a solid, placed at origin."""
    ox, oy, oz = origin
    front, back = [], []
    for x, z in pts:
        front.append(bm.verts.new(Vector((ox + x, oy + y0, oz + z))))
        back.append(bm.verts.new(Vector((ox + x, oy + y1, oz + z))))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bm.faces.new(tuple(reversed(front)))
    bm.faces.new(tuple(back))
    return front + back


# ------------------------------------------------------------- components
def window(bm_stone, bm_glass, origin, w, straight_h, wall_y):
    """A traceried lancet, built as applied relief standing proud of the wall.

    Nothing here is booleaned out of the masonry — punching a few hundred
    openings would cost far more than it is worth at this distance. Instead the
    surround stands slightly forward of the facade and the glazing stands
    forward of that, so what reads is a dark pointed light inside a stone
    frame, which is what a lancet looks like from across a lawn.
    """
    ox, oy, oz = origin
    face = wall_y                       # the plane of the facade

    # These are filled shapes, not rings, so the depths have to step strictly
    # outward or a larger layer simply hides a smaller one behind it.
    #   hood  (widest, shallowest)  ->  surround  ->  glazing (narrowest, proudest)
    prism(bm_stone, lancet_points(w * 1.52, straight_h * 1.03),
          (ox, oy, oz + 0.10), face + 0.00, face + 0.11)
    prism(bm_stone, lancet_points(w * 1.30, straight_h * 1.07),
          (ox, oy, oz - 0.06), face + 0.00, face + 0.17)
    prism(bm_glass, lancet_points(w, straight_h),
          (ox, oy, oz), face + 0.17, face + 0.205)
    # mullion and transom dividing the light
    U.add_box(bm_stone, (ox, oy + face + 0.225, oz + straight_h * 0.60),
              (0.070, 0.05, straight_h * 1.20))
    U.add_box(bm_stone, (ox, oy + face + 0.225, oz + straight_h * 0.64),
              (w * 0.84, 0.05, 0.070))
    # sill
    U.add_box(bm_stone, (ox, oy + face + 0.10, oz - 0.10),
              (w * 1.46, 0.34, 0.14))


def blind_arcade(bm, origin, width, wall_y, n=3):
    """A run of small blind arches along the base of a range."""
    ox, oy, oz = origin
    for k in range(n):
        x = ox - width / 2 + width * (k + 0.5) / n
        prism(bm, lancet_points(width / n * 0.52, 0.55),
              (x, oy, oz), wall_y + 0.0, wall_y + 0.13)


def buttress(bm, origin, height, project, wall_y, rng):
    """A stepped buttress: two stages with a weathered offset and a gablet."""
    ox, oy, oz = origin
    w = 1.05
    stage = height * 0.58
    U.add_box(bm, (ox, oy + wall_y - project / 2, oz + stage / 2),
              (w, project, stage))
    # weathering: a sloped set-off between the stages
    slope = Matrix.Rotation(math.radians(34), 4, "X")
    U.add_box(bm, (ox, oy + wall_y - project * 0.66, oz + stage + 0.10),
              (w * 0.98, project * 0.58, 0.22), matrix=slope)
    up = height - stage - 0.2
    U.add_box(bm, (ox, oy + wall_y - project * 0.34, oz + stage + 0.2 + up / 2),
              (w * 0.80, project * 0.66, up))
    # gablet cap
    top = oz + height
    for i, (sw, sh) in enumerate(((0.86, 0.16), (0.62, 0.30), (0.30, 0.34))):
        U.add_box(bm, (ox, oy + wall_y - project * 0.34, top + 0.16 + i * 0.30),
                  (w * sw, project * 0.62 * sw / 0.86, sh))


def crenellate(bm, origin, width, depth, rng):
    ox, oy, oz = origin
    step = 1.05
    n = max(2, int(width / step))
    step = width / n
    U.add_box(bm, (ox, oy, oz - 0.12), (width, depth, 0.26))
    for i in range(0, n, 2):
        x = ox - width / 2 + step * (i + 0.5)
        U.add_box(bm, (x, oy, oz + 0.30), (step * 0.84, depth * 0.92, 0.62))


def gable_roof(bm, origin, width, depth, height):
    """Steep pitched roof with a ridge along X, plus a finial."""
    cx, cy, cz = origin
    hw, hd = width / 2, depth / 2
    pts = [(-hd, 0.0), (hd, 0.0), (0.0, height)]
    # build across Z-depth: prism along X
    front, back = [], []
    for y, z in pts:
        front.append(bm.verts.new(Vector((cx - hw, cy + y, cz + z))))
        back.append(bm.verts.new(Vector((cx + hw, cy + y, cz + z))))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bm.faces.new(tuple(reversed(front)))
    bm.faces.new(tuple(back))
    for sgn in (-1, 1):
        U.add_box(bm, (cx + sgn * (hw - 0.25), cy, cz + height + 0.34),
                  (0.16, 0.16, 0.68))


def tower(bm, origin, width, depth, height, wall_y):
    """A corner tower with octagonal pinnacles."""
    ox, oy, oz = origin
    U.add_box(bm, (ox, oy + wall_y - depth / 2, oz + height / 2),
              (width, depth, height))
    crenellate(bm, (ox, oy + wall_y - depth / 2, oz + height),
               width + 0.3, depth + 0.3, None)
    for sx in (-1, 1):
        for sy in (-1, 1):
            px = ox + sx * (width / 2 - 0.05)
            py = oy + wall_y - depth / 2 + sy * (depth / 2 - 0.05)
            U.add_cylinder(bm, (px, py, oz + height + 0.9), 0.34, 1.9, segments=8)
            U.add_cone(bm, (px, py, oz + height + 2.6), 0.34, 0.02, 1.4, segments=8)


# ------------------------------------------------------------------ range
def build_range(bm, bmg, rng, wall_y=0.0):
    """One side of the Quad, running along X with its face toward +Y."""
    x = -SIDE_RUN / 2
    bay_i = 0
    while x < SIDE_RUN / 2 - 1.0:
        w = min(BAY * rng.uniform(0.86, 1.18), SIDE_RUN / 2 - x)
        if w < 3.0:
            break
        cx = x + w / 2
        is_tower = (bay_i % 7 == 3) and rng.random() < 0.55
        depth = rng.uniform(9.0, 13.0)
        proj = rng.uniform(-0.4, 1.5)          # bays advance and recede
        cy = wall_y - depth / 2 + proj

        if is_tower:
            tower(bm, (cx, 0, 0), min(w, 5.6), depth * 0.55,
                  CORNICE_Z + rng.uniform(4.5, 7.0), proj)
            x += w
            bay_i += 1
            continue

        h = CORNICE_Z + rng.uniform(-1.4, 1.4)
        U.add_box(bm, (cx, cy, h / 2), (w, depth, h))

        # string course and cornice, tied to a common line across every range
        U.add_box(bm, (cx, cy, CORNICE_Z), (w + 0.30, depth + 0.30, 0.40))
        U.add_box(bm, (cx, cy, CORNICE_Z * 0.46), (w + 0.16, depth + 0.16, 0.16))
        # plinth
        U.add_box(bm, (cx, cy, 0.34), (w + 0.26, depth + 0.26, 0.68))

        # two tiers of lancets over a blind arcade at the base
        blind_arcade(bm, (cx, 0, 0.95), w * 0.86, proj, n=3 if w < 8.6 else 4)
        lights = 2 if w < 8.6 else 3
        for c in range(lights):
            wx = cx + (c - (lights - 1) / 2) * (w / (lights + 0.35))
            for base_z, lw, lh in ((3.00, 1.24, 2.9), (8.40, 1.24, 2.5)):
                if base_z + lh * 2.1 > h:
                    continue
                window(bm, bmg, (wx, 0, base_z), lw, lh, proj)

        buttress(bm, (x, 0, 0), h * 0.86, 0.95, proj, rng)

        if rng.random() < 0.45:
            crenellate(bm, (cx, cy, h), w + 0.2, depth + 0.2, rng)
        else:
            gable_roof(bm, (cx, cy, h), w, depth, rng.uniform(2.8, 4.2))

        x += w
        bay_i += 1


def build_quad():
    bm, bmg = U.new_bmesh(), U.new_bmesh()
    for i in range(4):
        m = (Matrix.Rotation(math.radians(90 * i), 4, "Z")
             @ Matrix.Translation(Vector((0, -P.QUAD_INNER / 2, 0))))
        rng = U.rng(4100 + i)
        starts = (len(bm.verts), len(bmg.verts))
        build_range(bm, bmg, rng)
        for mesh, start in ((bm, starts[0]), (bmg, starts[1])):
            mesh.verts.ensure_lookup_table()
            bmesh.ops.transform(mesh, matrix=m, verts=mesh.verts[start:],
                                space=Matrix.Identity(4))
    U.recalc_normals(bm)
    U.recalc_normals(bmg)
    walls = U.bm_to_object(bm, "Quad", M.limestone())
    glass = U.bm_to_object(bmg, "QuadGlass", M.window_glass())
    return [walls, glass]


# ------------------------------------------------------------------ trees
def build_tree(seed, scale=1.0):
    """A low-poly tree: tapered trunk, a few limbs, overlapping canopy masses."""
    rng = U.rng(seed)
    bm = U.new_bmesh()
    h = (4.2 + rng.uniform(0, 2.4)) * scale
    U.add_cone(bm, (0, 0, h * 0.30), 0.26 * scale, 0.15 * scale, h * 0.60,
               segments=8)
    for _ in range(3):
        a = rng.uniform(0, math.tau)
        rot = (Matrix.Rotation(a, 4, "Z")
               @ Matrix.Rotation(math.radians(rng.uniform(26, 46)), 4, "Y"))
        U.add_box(bm, (0, 0, h * 0.58), (0.11 * scale, 0.11 * scale, h * 0.38),
                  matrix=rot)
    U.recalc_normals(bm)
    trunk = U.bm_to_object(bm, "TreeTrunk_%d" % seed, M.bark())

    bc = U.new_bmesh()
    for _ in range(rng.randint(4, 6)):
        r = rng.uniform(1.15, 1.85) * scale
        U.add_icosphere(bc, (rng.uniform(-1.0, 1.0) * scale,
                             rng.uniform(-1.0, 1.0) * scale,
                             h * rng.uniform(0.82, 1.16)), r, subdiv=2)
    for v in bc.verts:
        v.co.x *= 1.14
        v.co.y *= 1.14
        v.co.z *= 0.88
    U.recalc_normals(bc)
    canopy = U.bm_to_object(bc, "TreeCanopy_%d" % seed, M.leaf(),
                            shade_smooth=True)
    return [trunk, canopy]


# ----------------------------------------------------------------- ground
def build_ground():
    """A large lawn with gentle undulation, and limestone paths across it."""
    span = P.QUAD_INNER + 74.0
    n = 40
    bm = U.new_bmesh()
    rng = U.rng(556)
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x = (i / n - 0.5) * span
            y = (j / n - 0.5) * span
            z = (math.sin(x * 0.045) * math.cos(y * 0.038) * 0.16
                 + math.sin(x * 0.011 + 1.3) * 0.22)
            row.append(bm.verts.new(Vector((x, y, z - 0.05))))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((grid[j][i], grid[j][i + 1],
                          grid[j + 1][i + 1], grid[j + 1][i]))
    U.recalc_normals(bm)
    lawn = U.bm_to_object(bm, "Lawn", M.lawn(), shade_smooth=True)

    bp = U.new_bmesh()
    reach = P.QUAD_INNER / 2 + 8
    U.add_box(bp, (0, 0, 0.16), (reach * 2, 3.4, 0.10))
    U.add_box(bp, (0, 0, 0.16), (3.4, reach * 2, 0.10))
    # a walk around the inside of the ranges
    for sgn in (-1, 1):
        U.add_box(bp, (0, sgn * (P.QUAD_INNER / 2 - 5.0), 0.16),
                  (reach * 2, 2.6, 0.10))
        U.add_box(bp, (sgn * (P.QUAD_INNER / 2 - 5.0), 0, 0.16),
                  (2.6, reach * 2, 0.10))
    U.recalc_normals(bp)
    paths = U.bm_to_object(bp, "Paths", M.path_stone())
    return [lawn, paths]


def build():
    objs = build_quad() + build_ground()
    for i, scale in enumerate((1.0, 1.25, 0.82)):
        objs += build_tree(3300 + i * 17, scale)
    return objs
