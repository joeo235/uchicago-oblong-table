"""Shared palette and dimensions for the Oblong Table scene.

Dusk in the Quad. Limestone reads cool grey-ochre in silhouette; the table is a
warm dark oak; the AI objects are the only genuinely luminous things present.
Colours are linear-space RGB tuples, matching Blender's internal convention.
"""

# ---------------------------------------------------------------- dimensions
# The table is "massive" and oblong: long enough that 28 seats fit around it.
TABLE_LEN = 16.0          # X
TABLE_DEP = 4.0           # Y in Blender (Z once glTF flips to Y-up)
TABLE_TOP = 0.75          # standing height of the top surface
TABLE_THICK = 0.12        # thickness of the top slab
RIM = 0.35                # rim width; set-aside objects come to rest here

# The heightfield plane is built in Three.js and fills the inset area.
FIELD_LEN = TABLE_LEN - 2 * RIM
FIELD_DEP = TABLE_DEP - 2 * RIM

SEATS_LONG = 12           # per long side
SEATS_SHORT = 2           # per short end
SEAT_COUNT = 2 * SEATS_LONG + 2 * SEATS_SHORT   # 28

QUAD_INNER = 46.0         # clear span of the Quad before the buildings start
QUAD_HEIGHT = 15.0        # nominal cornice line; bays vary around it

# ------------------------------------------------------------------- colours
OAK_DARK     = (0.055, 0.036, 0.024)
OAK_MID      = (0.098, 0.064, 0.041)
LIMESTONE    = (0.128, 0.122, 0.104)
LIMESTONE_HI = (0.225, 0.214, 0.183)
SLATE_ROOF   = (0.040, 0.042, 0.052)
BRASS        = (0.420, 0.310, 0.130)

# Gesture grammars. These three must read as peers — equal chroma, equal
# luminance weight. Nothing here should imply a preferred outcome.
MOLD      = (0.850, 0.480, 0.180)   # warm amber
METHOD    = (0.620, 0.780, 0.660)   # pale structured green-white
SET_ASIDE = (0.330, 0.360, 0.720)   # deep considered indigo

FACULTY   = (0.900, 0.620, 0.290)   # warm presence at a seat
STUDENT   = (0.550, 0.830, 0.900)   # cool, and arriving from outside the ring

# The nine AI object archetypes, in build order.
OBJECT_TINTS = [
    (0.72, 0.44, 0.86),   # lattice knot
    (0.36, 0.66, 0.88),   # plate stack
    (0.90, 0.56, 0.32),   # ring spiral
    (0.48, 0.82, 0.62),   # rod cluster
    (0.88, 0.40, 0.52),   # folded ribbon
    (0.94, 0.78, 0.36),   # faceted seed
    (0.44, 0.54, 0.92),   # nested cage
    (0.62, 0.86, 0.44),   # filament bundle
    (0.82, 0.46, 0.72),   # torus weave
]

OBJECT_NAMES = [
    "lattice knot", "plate stack", "ring spiral", "rod cluster",
    "folded ribbon", "faceted seed", "nested cage", "filament bundle",
    "torus weave",
]
