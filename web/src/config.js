/**
 * Runtime constants. These mirror blender/lib/palette.py — glTF export flips
 * Blender's Z-up to Y-up, so the table runs along X, is deep along Z, and its
 * top surface sits at y = TABLE_TOP.
 */
export const TABLE_LEN = 16.0
export const TABLE_DEP = 4.0
export const TABLE_TOP = 0.75
export const RIM = 0.35

/** The working area of the table; the rim beyond it is where things are set aside. */
export const FIELD_LEN = TABLE_LEN - 2 * RIM   // 15.3, along X
export const FIELD_DEP = TABLE_DEP - 2 * RIM   // 3.3,  along Z

export const QUAD_INNER = 88.0

export const SEATS_LONG = 12
export const SEATS_SHORT = 2

export const GESTURE = { MOLD: 0, METHOD: 1, ASIDE: 2 }

/**
 * Equal chroma and near-equal luminance across the three. Nothing in this
 * palette should suggest that one gesture outranks another.
 */
export const GESTURE_COLOR = [0xd98a3a, 0x6fa87c, 0x6a6cc4]

export const FACULTY_COLOR = 0xe8b06a
export const STUDENT_COLOR = 0x4fa8c8

/** How many AI objects are scattered on the table. */
export const OBJECT_COUNT = 48

/** The ten archetypes, matching blender/build_objects.py. */
export const OBJECT_NAMES = [
  'a quiz', 'a grading rubric', 'a tutoring dialogue', 'a summariser',
  'a translator', 'a coding assistant', 'an image generator',
  'a literature search', 'a data analysis', 'a set of margin comments',
]

/** Simulation pacing, in seconds. */
export const AMBIENT_GESTURE_EVERY = [6.0, 13.0]
export const STUDENT_EVERY = [34.0, 58.0]

export const STORAGE_KEY = 'oblong-table/v2'
