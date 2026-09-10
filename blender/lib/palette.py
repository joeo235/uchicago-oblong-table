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

# The Quad is a large open lawn; the ranges stand well back from the table.
QUAD_INNER = 88.0         # clear span of the Quad before the buildings start
QUAD_HEIGHT = 16.0        # nominal cornice line; bays vary around it

# ------------------------------------------------------------------- colours
# Late afternoon, not dusk. Blue Bedford limestone is a warm pale grey in
# daylight and only reads near-black in silhouette, so these are the daytime
# values: the scene is lit, and the architecture is meant to be legible.
OAK_DARK     = (0.115, 0.072, 0.043)
OAK_MID      = (0.165, 0.108, 0.064)
LIMESTONE    = (0.208, 0.194, 0.164)
LIMESTONE_HI = (0.310, 0.296, 0.258)
SLATE_ROOF   = (0.085, 0.090, 0.105)
BRASS        = (0.420, 0.310, 0.130)

LAWN         = (0.068, 0.125, 0.050)
LAWN_DRY     = (0.130, 0.165, 0.070)
PATH_STONE   = (0.235, 0.220, 0.196)
BARK         = (0.075, 0.055, 0.042)
LEAF         = (0.070, 0.138, 0.055)
LEAF_LIGHT   = (0.135, 0.235, 0.085)

# Gesture grammars. These three must read as peers — equal chroma, equal
# luminance weight. Nothing here should imply a preferred outcome.
MOLD      = (0.850, 0.480, 0.180)   # warm amber
METHOD    = (0.620, 0.780, 0.660)   # pale structured green-white
SET_ASIDE = (0.330, 0.360, 0.720)   # deep considered indigo

FACULTY   = (0.900, 0.620, 0.290)   # warm presence at a seat
STUDENT   = (0.550, 0.830, 0.900)   # cool, and arriving from outside the ring

def srgb(hex_code):
    """sRGB hex -> linear RGB, which is what Blender's colour inputs expect."""
    h = hex_code.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# The ten AI objects, in build order. Each is shaped like a use, not a product.
OBJECT_TINTS = [
    srgb("#5B8FC7"),   # quiz
    srgb("#7FA97C"),   # grading rubric
    srgb("#D07A5E"),   # tutoring dialogue
    srgb("#8A76B8"),   # summariser
    srgb("#4E9E9B"),   # translator
    srgb("#5C6E9E"),   # coding assistant
    srgb("#D2A24C"),   # image generator
    srgb("#C06B8E"),   # literature search
    srgb("#97A254"),   # data analysis
    srgb("#B5654F"),   # margin comments
]

OBJECT_NAMES = [
    "a quiz", "a grading rubric", "a tutoring dialogue", "a summariser",
    "a translator", "a coding assistant", "an image generator",
    "a literature search", "a data analysis", "a set of margin comments",
]
