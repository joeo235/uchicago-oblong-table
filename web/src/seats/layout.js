/**
 * Where the 28 seats sit, and which way each one faces.
 *
 * Pure geometry, no scene objects, so both the camera rig and the visual seat
 * ring can share it without one depending on the other.
 */
import * as THREE from 'three'

import { SEATS_LONG, SEATS_SHORT, TABLE_DEP, TABLE_LEN, TABLE_TOP } from '../config.js'

const SET_BACK = 0.62          // clearance from the table edge to a chair
// Seated eye height. Physically a seated person is nearer 1.22 above the
// floor, but the relief on this table runs to 0.40 — a real topography, not a
// tablecloth — and at 1.22 the eye sits barely a hand above the highest swell,
// so the far side of the table disappears behind it. Sitting up tall.
const EYE = 1.62

/** The seat the visitor occupies: mid-way along the near long side. */
export const YOUR_SEAT = 5

export function seatLayout() {
  const seats = []
  const halfL = TABLE_LEN / 2
  const halfD = TABLE_DEP / 2
  const zLong = halfD + SET_BACK
  const xEnd = halfL + SET_BACK

  const push = (x, z, side) => {
    const pos = new THREE.Vector3(x, 0, z)
    const dir = new THREE.Vector3(-x, 0, -z).normalize()
    seats.push({
      index: seats.length,
      side,
      position: pos,
      facing: dir,
      rotationY: Math.atan2(-dir.x, -dir.z),
      eye: new THREE.Vector3(x, EYE, z),
      // Look across the table to the people opposite, not down at the wood
      // in front of you — half the frame was bare tabletop otherwise.
      lookAt: new THREE.Vector3(
        x * 0.10, TABLE_TOP + 0.16,
        z !== 0 ? -Math.sign(z) * TABLE_DEP * 0.34 : 0),
    })
  }

  // near long side first, so YOUR_SEAT lands on the side facing the camera
  for (let i = 0; i < SEATS_LONG; i++) {
    const t = (i + 0.5) / SEATS_LONG
    push((t - 0.5) * (TABLE_LEN - 2.2), zLong, 'near')
  }
  for (let i = 0; i < SEATS_SHORT; i++) {
    const t = (i + 0.5) / SEATS_SHORT
    push(xEnd, (t - 0.5) * (TABLE_DEP - 1.6), 'east')
  }
  for (let i = 0; i < SEATS_LONG; i++) {
    const t = (i + 0.5) / SEATS_LONG
    push((0.5 - t) * (TABLE_LEN - 2.2), -zLong, 'far')
  }
  for (let i = 0; i < SEATS_SHORT; i++) {
    const t = (i + 0.5) / SEATS_SHORT
    push(-xEnd, (0.5 - t) * (TABLE_DEP - 1.6), 'west')
  }
  return seats
}

/** Seats adjacent around the ring — literally your neighbours and seatmates. */
export function neighboursOf(index, count) {
  const prev = (index - 1 + count) % count
  const next = (index + 1) % count
  return [prev, next]
}
