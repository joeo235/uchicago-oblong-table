/**
 * Who you are at this table, and which place is yours.
 *
 * The passage gives everyone a seat — "around which each of our faculty and
 * instructors takes a seat" — so a visitor gets one place, the same one on
 * every return. Notes are left at a place, which is what makes the notebooks
 * around the table fill up with different hands rather than all of them
 * belonging to whoever is looking.
 *
 * The id is a random label for telling one person's notes from another's. It
 * is not an account and it identifies nobody: no name, no email, nothing that
 * leaves this browser unless a note is deliberately shared.
 */
import { SEATS_LONG, SEATS_SHORT } from '../config.js'

const KEY = 'oblong-table/identity/v1'
const SEAT_COUNT = 2 * SEATS_LONG + 2 * SEATS_SHORT

let cached = null

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (typeof d?.id !== 'string') return null
    if (!Number.isInteger(d?.seat) || d.seat < 0 || d.seat >= SEAT_COUNT) return null
    return d
  } catch {
    return null
  }
}

function write(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* private mode */ }
}

function mint() {
  const bytes = new Uint8Array(8)
  ;(globalThis.crypto ?? {}).getRandomValues?.(bytes)
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    || Math.random().toString(16).slice(2)
  // Somewhere along the near side, so the seat view faces across the table.
  const seat = Math.floor(Math.random() * SEATS_LONG)
  return { id, seat }
}

export function identity() {
  if (cached) return cached
  cached = read() ?? mint()
  write(cached)
  return cached
}

/** The seat this visitor occupies, stable across visits. */
export function yourSeat() {
  return identity().seat
}

export function visitorId() {
  return identity().id
}

/** Testing aid: forget this visitor and take a different seat next time. */
export function forgetIdentity() {
  cached = null
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
