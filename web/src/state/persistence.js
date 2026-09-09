/**
 * Your own gestures, kept across visits.
 *
 * Only what you did is stored — the seeded gathering is regenerated from a
 * fixed seed, so it never needs saving and never drifts between visitors.
 */
import { STORAGE_KEY } from '../config.js'

const VERSION = 1
const MAX_MARKS = 400

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (data?.version !== VERSION || !Array.isArray(data.marks)) return []
    return data.marks.filter(valid).slice(-MAX_MARKS)
  } catch {
    return []                       // private browsing, quota, corrupt value
  }
}

export function saveHistory(marks) {
  try {
    const trimmed = marks.filter(valid).slice(-MAX_MARKS).map(compact)
    localStorage.setItem(STORAGE_KEY,
      JSON.stringify({ version: VERSION, marks: trimmed }))
    return true
  } catch {
    return false
  }
}

export function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); return true } catch { return false }
}

function valid(m) {
  return m && Number.isFinite(m.x) && Number.isFinite(m.z)
    && Number.isFinite(m.radius) && Number.isFinite(m.amp)
    && Number.isInteger(m.grammar) && m.grammar >= 0 && m.grammar <= 2
}

function compact(m) {
  const r = (n) => Math.round(n * 1e3) / 1e3
  return {
    x: r(m.x), z: r(m.z), grammar: m.grammar,
    radius: r(m.radius), amp: r(m.amp), seed: r(m.seed ?? 0),
  }
}
