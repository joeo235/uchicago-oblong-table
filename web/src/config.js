/**
 * Runtime constants. These mirror blender/lib/palette.py — glTF export flips
 * Blender's Z-up to Y-up, so the table runs along X, is deep along Z, and its
 * top surface sits at y = TABLE_TOP.
 */
export const TABLE_LEN = 16.0
export const TABLE_DEP = 4.0
export const TABLE_TOP = 0.75
export const RIM = 0.35

export const FIELD_LEN = TABLE_LEN - 2 * RIM   // 15.3, along X
export const FIELD_DEP = TABLE_DEP - 2 * RIM   // 3.3,  along Z

export const SEATS_LONG = 12
export const SEATS_SHORT = 2

export const GESTURE = { MOLD: 0, METHOD: 1, ASIDE: 2, STUDENT: 3 }

/**
 * Equal chroma and near-equal luminance across the three. Nothing in this
 * palette should suggest that one gesture outranks another.
 */
export const GESTURE_COLOR = [0xd98a3a, 0x9ec7a8, 0x5a5cb8, 0x8cd4e6]

export const FACULTY_COLOR = 0xe69e4a
export const STUDENT_COLOR = 0x8cd4e6

/** Simulation pacing, in seconds. */
export const AMBIENT_GESTURE_EVERY = [7.0, 15.0]   // a neighbour acts
export const STUDENT_EVERY = [38.0, 62.0]          // the student beat

export const STORAGE_KEY = 'oblong-table/v1'
