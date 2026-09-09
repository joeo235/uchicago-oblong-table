/**
 * The gathering already in progress.
 *
 * You do not arrive at a blank table — the passage describes a room full of
 * colleagues who have been at this a while. These marks are that history.
 *
 * The split across the three gestures is deliberately even. Weighting it toward
 * molding would quietly turn the piece into an argument for adoption, which is
 * precisely what the passage declines to make.
 */
import { FIELD_DEP, FIELD_LEN } from '../config.js'

const SEED_COUNT = 60

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

export function seedMarks(seed = 20260909) {
  const rand = prng(seed)
  const marks = []

  // Equal thirds, interleaved so no region of the table belongs to one gesture.
  const order = []
  for (let i = 0; i < SEED_COUNT; i++) order.push(i % 3)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  for (const grammar of order) {
    const x = (rand() - 0.5) * FIELD_LEN * 0.94
    const z = (rand() - 0.5) * FIELD_DEP * 0.88
    marks.push({
      x, z, grammar,
      radius: 0.34 + rand() * 0.46,
      amp: 0.055 + rand() * 0.085,
      seed: rand(),
      aged: true,
    })
  }
  return marks
}
