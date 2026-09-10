/**
 * The gathering already in progress.
 *
 * You do not arrive at a blank table. These are the gestures colleagues have
 * already made — piles where people worked something over together, tidy rows
 * where someone applied a method, a fringe at the rim of things considered and
 * put down.
 *
 * The split across the three is deliberately even. Weighting it toward molding
 * would quietly turn the piece into an argument for adoption, which is
 * precisely what the passage declines to make.
 */
import { FIELD_DEP, FIELD_LEN, GESTURE, OBJECT_COUNT } from '../config.js'

const MOUNDS = 4          // clusters of molded work
const PER_MOUND = 3
const ARRAYS = 3          // methodical rows
const PER_ARRAY = 4
const ASIDE = 12
const GRID = 0.34

/** mulberry32 — small, fast, and identical for every visitor. */
export function prng(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ordered list of prior gestures: { objectIndex, gesture, x, z }. */
export function seedActions(seed = 20260909) {
  const rand = prng(seed)
  const actions = []
  let next = 0
  const take = () => (next < OBJECT_COUNT ? next++ : null)

  // mounds: several people working the same object over, piling it up
  for (let m = 0; m < MOUNDS; m++) {
    const cx = (rand() - 0.5) * FIELD_LEN * 0.78
    const cz = (rand() - 0.5) * FIELD_DEP * 0.52
    for (let k = 0; k < PER_MOUND; k++) {
      const i = take()
      if (i === null) break
      actions.push({
        objectIndex: i, gesture: GESTURE.MOLD,
        x: cx + (rand() - 0.5) * 0.16,
        z: cz + (rand() - 0.5) * 0.16,
      })
    }
  }

  // arrays: a precise methodology, laid out in a row on the grid
  for (let a = 0; a < ARRAYS; a++) {
    const ox = Math.round(((rand() - 0.5) * FIELD_LEN * 0.66) / GRID) * GRID
    const oz = Math.round(((rand() - 0.5) * FIELD_DEP * 0.44) / GRID) * GRID
    const along = rand() < 0.7
    for (let k = 0; k < PER_ARRAY; k++) {
      const i = take()
      if (i === null) break
      actions.push({
        objectIndex: i, gesture: GESTURE.METHOD,
        x: ox + (along ? k * GRID : 0),
        z: oz + (along ? 0 : k * GRID),
      })
    }
  }

  // handled, explored, and deliberately set aside
  for (let k = 0; k < ASIDE; k++) {
    const i = take()
    if (i === null) break
    actions.push({ objectIndex: i, gesture: GESTURE.ASIDE, x: 0, z: 0 })
  }

  return actions
}

/** Sanity aid: the split across the three gestures, which must stay even. */
export function seedBalance(actions) {
  const c = [0, 0, 0]
  for (const a of actions) c[a.gesture]++
  return c
}
