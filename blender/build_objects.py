"""Ten AI objects, each shaped like a *use* rather than a product.

Deliberately not logos. Third-party marks would bring trademark problems, read
as endorsement, and date the piece the moment the market moved — and the
passage is careful to keep the objects generic ("objects that represent AI").
What is specific in the passage is pedagogy, so these are shaped like the
things a teacher would actually reach for: a quiz, a rubric, a tutoring
exchange, a summariser, a translator, a coding assistant, an image generator,
a literature search, an analysis, a set of margin comments.

Each is bold in silhouette, since they are read at about 0.4 units across on a
16-unit table, and each sits with its base on z = 0 so it rests on the wood.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import materials as M
import meshutil as U
import palette as P

S = 0.42          # nominal footprint


def quiz(bm, rng):
    """A stack of cards; the top one lifted, with a row of answer bubbles."""
    for i in range(3):
        rot = Matrix.Rotation(math.radians(-7 + i * 6), 4, "Z")
        U.add_box(bm, (i * 0.008, i * 0.006, 0.018 + i * 0.030),
                  (S * 0.86, S * 0.62, 0.028), matrix=rot)
    top = 0.108
    rot = Matrix.Rotation(math.radians(11), 4, "Z")
    U.add_box(bm, (0.012, 0.010, top + 0.10), (S * 0.86, S * 0.62, 0.028),
              matrix=rot)
    for k in range(4):                       # answer bubbles down the left
        U.add_cylinder(bm, (-S * 0.30 + 0.012, S * 0.19 - k * 0.062,
                            top + 0.122), 0.020, 0.014, segments=8)
    for k in range(4):                       # the answer lines beside them
        U.add_box(bm, (0.02, S * 0.19 - k * 0.062, top + 0.120),
                  (S * 0.40, 0.014, 0.010))


def rubric(bm, rng):
    """A criteria grid; some cells scored, standing proud."""
    U.add_box(bm, (0, 0, 0.022), (S, S * 0.78, 0.044))
    cols, rows = 4, 3
    for c in range(cols):
        for r in range(rows):
            x = (c / (cols - 1) - 0.5) * S * 0.74
            y = (r / (rows - 1) - 0.5) * S * 0.54
            filled = ((c * 3 + r * 5) % 4) < 2
            U.add_box(bm, (x, y, 0.044 + (0.030 if filled else 0.008) / 2),
                      (S * 0.15, S * 0.13, 0.030 if filled else 0.008))


def dialogue(bm, rng):
    """Two speech bubbles in exchange — the tutoring turn-by-turn."""
    for sgn, z, sc in ((-1, 0.085, 1.0), (1, 0.215, 0.86)):
        rot = Matrix.Rotation(math.radians(sgn * 13), 4, "Z")
        U.add_box(bm, (sgn * S * 0.16, sgn * -S * 0.10, z),
                  (S * 0.66 * sc, S * 0.40 * sc, 0.130 * sc), matrix=rot)
        # the tail, pointing back at the other speaker
        U.add_cone(bm, (sgn * S * 0.16 - sgn * S * 0.24,
                        sgn * -S * 0.10 - sgn * S * 0.14, z - 0.03),
                   0.055 * sc, 0.004, 0.11)
    U.add_box(bm, (0, 0, 0.012), (S * 0.34, S * 0.34, 0.024))


def summariser(bm, rng):
    """A tall stack of pages stepping down into one dense block."""
    n = 9
    for i in range(n):
        f = i / (n - 1)
        U.add_box(bm, (-S * 0.30 + f * S * 0.10, 0, 0.014 + i * 0.024),
                  (S * (0.52 - f * 0.10), S * 0.60, 0.012))
    U.add_box(bm, (S * 0.34, 0, 0.075), (S * 0.30, S * 0.44, 0.150))
    for k in range(3):
        U.add_box(bm, (S * 0.34, 0, 0.150 + 0.016 + k * 0.0),
                  (S * 0.20, S * 0.30 - k * 0.05, 0.012))


def translator(bm, rng):
    """Two blocks with interlocking teeth, meeting along the middle."""
    for sgn in (-1, 1):
        U.add_box(bm, (sgn * S * 0.28, 0, 0.085), (S * 0.44, S * 0.62, 0.170))
        for k in range(3):
            y = (k - 1) * S * 0.20
            U.add_box(bm, (sgn * S * 0.04, y + (0 if sgn < 0 else S * 0.10),
                           0.085), (S * 0.22, S * 0.11, 0.120))
    U.add_box(bm, (0, 0, 0.010), (S * 0.20, S * 0.66, 0.020))


def coder(bm, rng):
    """Indented lines of code between two brackets."""
    for sgn in (-1, 1):
        U.add_box(bm, (sgn * S * 0.44, 0, 0.11), (0.030, S * 0.56, 0.220))
        for tz in (-1, 1):
            U.add_box(bm, (sgn * S * 0.38, 0, 0.11 + tz * 0.098),
                      (0.10, S * 0.56, 0.028))
    indents = (0.00, 0.10, 0.18, 0.10, 0.00)
    for i, ind in enumerate(indents):
        z = 0.030 + i * 0.042
        U.add_box(bm, (-S * 0.22 + ind + (0.10 - ind) * 0.0, 0, z),
                  (S * (0.34 - ind * 0.6), 0.030, 0.022))


def image_gen(bm, rng):
    """A framed canvas whose pixel grid is still resolving."""
    U.add_box(bm, (0, 0, 0.012), (S * 0.66, S * 0.30, 0.024))
    frame = Matrix.Rotation(math.radians(-72), 4, "X")
    for sx, sz, w, h in ((0, 0.20, S * 0.94, 0.030),):
        U.add_box(bm, (sx, -0.02, sz), (w, h, S * 0.80), matrix=frame)
    n = 5
    for c in range(n):
        for r in range(n):
            if ((c * 7 + r * 3) % 5) > 2:
                continue
            x = (c / (n - 1) - 0.5) * S * 0.72
            z = 0.075 + (r / (n - 1)) * S * 0.56
            U.add_box(bm, (x, -0.055, z), (S * 0.15, 0.022, S * 0.13))


def retrieval(bm, rng):
    """A ring of sources with one drawn up to the middle."""
    U.add_cylinder(bm, (0, 0, 0.016), S * 0.60, 0.032, segments=20)
    n = 8
    for i in range(n):
        a = math.tau * i / n
        hgt = 0.05 + (0.10 if i in (1, 5) else 0.0)
        U.add_box(bm, (math.cos(a) * S * 0.44, math.sin(a) * S * 0.44,
                       0.032 + hgt / 2),
                  (S * 0.16, S * 0.16, hgt),
                  matrix=Matrix.Rotation(a, 4, "Z"))
    U.add_cylinder(bm, (0, 0, 0.115), S * 0.20, 0.14, segments=14)
    U.add_torus(bm, (0, 0, 0.215), S * 0.19, 0.022, 18, 6)


def analysis(bm, rng):
    """Bars of unequal height on a plinth — the shape of a finding."""
    U.add_box(bm, (0, 0, 0.018), (S * 0.94, S * 0.52, 0.036))
    heights = (0.09, 0.20, 0.14, 0.27, 0.17)
    for i, h in enumerate(heights):
        x = (i / (len(heights) - 1) - 0.5) * S * 0.72
        U.add_box(bm, (x, 0, 0.036 + h / 2), (S * 0.12, S * 0.30, h))


def annotator(bm, rng):
    """A page with a run of margin marks against the text."""
    U.add_box(bm, (0, 0, 0.014), (S * 0.78, S * 0.94, 0.028))
    for k in range(6):
        y = S * 0.36 - k * S * 0.145
        U.add_box(bm, (-S * 0.06, y, 0.036), (S * 0.48, 0.020, 0.014))
    for k in (1, 3, 4):
        y = S * 0.36 - k * S * 0.145
        U.add_box(bm, (S * 0.30, y, 0.040), (S * 0.13, 0.034, 0.024),
                  matrix=Matrix.Rotation(math.radians(18), 4, "Z"))
    U.add_box(bm, (-S * 0.14, S * 0.36 - 2 * S * 0.145, 0.048),
              (S * 0.26, 0.026, 0.012))


BUILDERS = [quiz, rubric, dialogue, summariser, translator,
            coder, image_gen, retrieval, analysis, annotator]


def build():
    objs = []
    for i, fn in enumerate(BUILDERS):
        bm = U.new_bmesh()
        fn(bm, U.rng(9000 + i * 37))
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
        U.bevel(bm, width=0.004, segments=1)
        U.recalc_normals(bm)
        obj = U.bm_to_object(bm, "AIObject_%02d" % i, M.ai_object(i))
        obj["archetype"] = P.OBJECT_NAMES[i]
        obj["index"] = i
        objs.append(obj)
    return objs
