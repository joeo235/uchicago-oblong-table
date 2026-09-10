/**
 * The people at the table.
 *
 * Presences, not figures: a notebook at each place, set down where someone is
 * working. Modelling bodies would imply identity and land squarely in the
 * uncanny valley, and the passage never asks us to picture anyone in
 * particular. An earlier version used a floating ember at head height, which
 * read fine at dusk and looked distinctly odd in daylight — a hovering ball of
 * light over an empty chair. A notebook says the same thing and survives
 * being lit by the sun.
 *
 * Colleagues also act on their own. That is not decoration — the passage says
 * the topography shifts "as we learn more from each other", so other people's
 * gestures have to actually move objects on the table. Their choice of gesture
 * is drawn evenly across the three, for the same reason the seeded history is.
 */
import * as THREE from 'three'

import {
  AMBIENT_GESTURE_EVERY, FACULTY_COLOR, FIELD_DEP, FIELD_LEN, GESTURE,
  TABLE_DEP, TABLE_LEN, TABLE_TOP,
} from '../config.js'
import { prng } from '../state/seed.js'
import { YOUR_SEAT, seatLayout } from './layout.js'

const PAPER_LIFT = 0.008     // sits on the wood

export class Gathering {
  constructor({ field, onAct, seed = 4242 }) {
    this.field = field
    this.onAct = onAct ?? (() => {})
    this.rand = prng(seed)
    this.seats = seatLayout()
    this.time = 0
    this.nextAct = 4.0
    this.group = new THREE.Group()
    this.group.name = 'Gathering'

    // Even thirds, shuffled — the same rule the seeded history follows.
    this.bag = []

    const n = this.seats.length
    this.phase = []
    this.rate = []
    this.level = new Float32Array(n).fill(1)

    // A notebook at each place, laid on the wood just inside the table edge.
    const paper = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.30, 0.014, 0.22),
      new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.0 }), n)
    paper.castShadow = true
    paper.receiveShadow = true

    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const one = new THREE.Vector3(1, 1, 1)
    this.paperAt = []
    for (let i = 0; i < n; i++) {
      const st = this.seats[i]
      const p = this._placeSetting(st)
      this.paperAt.push(p)
      q.setFromAxisAngle(up, st.rotationY + (this.rand() - 0.5) * 0.24)
      m.compose(new THREE.Vector3(p.x, TABLE_TOP + PAPER_LIFT, p.z), q, one)
      paper.setMatrixAt(i, m)
      this.phase.push(this.rand() * Math.PI * 2)
      this.rate.push(0.35 + this.rand() * 0.5)
    }
    paper.instanceMatrix.needsUpdate = true
    this.paper = paper
    this.group.add(paper)

    this.warm = new THREE.Color(0xd9cfb8)     // plain paper
    this.you = new THREE.Color(0xf6ecd2)      // your own, a shade brighter
    this.speak = new THREE.Color(FACULTY_COLOR)
    this._paint()
  }

  /** Where a person at this seat would put their notebook down. */
  _placeSetting(seat) {
    const inset = 0.30
    const halfL = TABLE_LEN / 2 - inset
    const halfD = TABLE_DEP / 2 - inset
    if (Math.abs(seat.position.z) > TABLE_DEP / 2) {
      return {
        x: THREE.MathUtils.clamp(seat.position.x, -halfL, halfL),
        z: Math.sign(seat.position.z) * halfD,
      }
    }
    return {
      x: Math.sign(seat.position.x) * halfL,
      z: THREE.MathUtils.clamp(seat.position.z, -halfD, halfD),
    }
  }

  _paint() {
    const c = new THREE.Color()
    for (let i = 0; i < this.seats.length; i++) {
      const base = i === YOUR_SEAT ? this.you : this.warm
      // Speaking warms the page rather than lighting a lamp over the chair.
      c.copy(base).lerp(this.speak, THREE.MathUtils.clamp(this.level[i] - 1, 0, 1))
      this.paper.setColorAt(i, c)
    }
    this.paper.instanceColor.needsUpdate = true
  }

  _drawGesture() {
    if (!this.bag.length) {
      this.bag = [GESTURE.MOLD, GESTURE.METHOD, GESTURE.ASIDE]
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1))
        ;[this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]
      }
    }
    return this.bag.pop()
  }

  /** A colleague picks something up in front of them and decides about it. */
  act(seatIndex = null) {
    const i = seatIndex ?? Math.floor(this.rand() * this.seats.length)
    if (i === YOUR_SEAT) return this.act((i + 3) % this.seats.length)
    const seat = this.seats[i]

    // reach for whatever is loose nearest their own stretch of the table
    const reachX = THREE.MathUtils.clamp(
      seat.position.x, -FIELD_LEN / 2 + 0.4, FIELD_LEN / 2 - 0.4)
    const reachZ = THREE.MathUtils.clamp(
      seat.position.z * 0.45, -FIELD_DEP / 2 + 0.3, FIELD_DEP / 2 - 0.3)

    let best = null, bestD = Infinity
    for (const o of this.field.items) {
      if (o.state !== 'loose') continue
      const d = Math.hypot(o.target.x - reachX, o.target.z - reachZ)
      if (d < bestD) { bestD = d; best = o }
    }
    if (!best) return null

    const grammar = this._drawGesture()
    const x = THREE.MathUtils.clamp(
      reachX + (this.rand() - 0.5) * 1.4, -FIELD_LEN / 2 + 0.3, FIELD_LEN / 2 - 0.3)
    const z = THREE.MathUtils.clamp(
      reachZ + (this.rand() - 0.5) * 0.7, -FIELD_DEP / 2 + 0.25, FIELD_DEP / 2 - 0.25)

    const result = this.field.apply(best, grammar, x, z)
    this.level[i] = 2.6                       // they light up as they speak
    this.onAct(result, i)
    return { result, seat: i }
  }

  update(dt, time) {
    this.time = time
    for (let i = 0; i < this.seats.length; i++) {
      const breathe = 0.82 + Math.sin(time * this.rate[i] + this.phase[i]) * 0.18
      const target = (i === YOUR_SEAT ? 1.5 : 1.0) * breathe
      this.level[i] += (target - this.level[i]) * Math.min(1, dt * 1.6)
    }
    this._paint()

    this.nextAct -= dt
    if (this.nextAct <= 0) {
      const [lo, hi] = AMBIENT_GESTURE_EVERY
      this.nextAct = lo + this.rand() * (hi - lo)
      this.act()
    }
  }

  /** Make a seat flare — used when a filament of conversation reaches it. */
  stir(index, amount = 2.0) {
    if (index >= 0 && index < this.level.length) this.level[index] = amount
  }
}
