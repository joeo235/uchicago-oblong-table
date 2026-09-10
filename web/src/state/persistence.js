/**
 * Your own gestures, kept across visits.
 *
 * Only what you did is stored — the seeded gathering is regenerated from a
 * fixed seed, so it never needs saving and never drifts between visitors.
 */
import { STORAGE_KEY } from '../config.js'

const VERSION = 2
const MAX = 300

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    if (data?.version !== VERSION || !Array.isArray(data.actions)) return []
    return data.actions.filter(valid).slice(-MAX)
  } catch {
    return []                       // private browsing, quota, corrupt value
  }
}

export function saveHistory(actions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: VERSION,
      actions: actions.filter(valid).slice(-MAX).map(compact),
    }))
    return true
  } catch {
    return false
  }
}

export function clearHistory() {
  try { localStorage.removeItem(STORAGE_KEY); return true } catch { return false }
}

function valid(a) {
  return a && Number.isInteger(a.objectIndex) && a.objectIndex >= 0
    && Number.isInteger(a.gesture) && a.gesture >= 0 && a.gesture <= 2
    && Number.isFinite(a.x) && Number.isFinite(a.z)
}

function compact(a) {
  const r = (n) => Math.round(n * 1e3) / 1e3
  return { objectIndex: a.objectIndex, gesture: a.gesture, x: r(a.x), z: r(a.z) }
}
