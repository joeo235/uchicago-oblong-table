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
import { FIELD_DEP, FIELD_LEN, GESTURE, GRID, OBJECT_COUNT } from '../config.js'

const GROUPS = 4          // neighbourhoods of molded work
const PER_GROUP = 2
const ARRAYS = 2          // methodical rows
const PER_ARRAY = 4
const ASIDE = 8
const SPREAD = 0.95       // how far apart the members of a group sit

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

  // Neighbourhoods of molded work: a few people who have been at it in the
  // same part of the table. Spread out, not piled — the members sit near each
  // other but clear of each other, so the grouping reads without anything
  // being balanced on anything else.
  for (let g = 0; g < GROUPS; g++) {
    const cx = (rand() - 0.5) * FIELD_LEN * 0.74
    const cz = (rand() - 0.5) * FIELD_DEP * 0.34
    const turn = rand() * Math.PI * 2
    for (let k = 0; k < PER_GROUP; k++) {
      const i = take()
      if (i === null) break
      const a = turn + (k / PER_GROUP) * Math.PI * 2
      actions.push({
        objectIndex: i, gesture: GESTURE.MOLD,
        x: cx + Math.cos(a) * SPREAD,
        z: cz + Math.sin(a) * SPREAD * 0.5,
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
