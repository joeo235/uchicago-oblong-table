/**
 * "...and, importantly, from our students."
 *
 * The passage's last clause gets its own beat, and it has to be visibly not one
 * of ours: the pulse arrives from beyond the ring of seats, and what it leaves
 * is not a mark of the kind anyone at the table makes. It is a wide, shallow,
 * rippled shift — a whole region of the table moving under a conversation that
 * had settled.
 */
import * as THREE from 'three'

import {
  FIELD_DEP, FIELD_LEN, GESTURE, STUDENT_COLOR, STUDENT_EVERY, TABLE_TOP,
} from '../config.js'
import { prng } from '../state/seed.js'

const TRAVEL = 2.6           // seconds from beyond the ring to the table

export class Students {
  constructor({ topography, passage, seed = 90210, onArrive }) {
    this.topography = topography
    this.passage = passage
    this.onArrive = onArrive ?? (() => {})
    this.rand = prng(seed)
    this.next = 18 + this.rand() * 14
    this.active = null

    this.group = new THREE.Group()
    this.group.name = 'Students'

    const geo = new THREE.SphereGeometry(0.085, 14, 10)
    this.pulse = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: STUDENT_COLOR, toneMapped: false,
    }))
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(0.30, 14, 10),
      new THREE.MeshBasicMaterial({
        color: STUDENT_COLOR, toneMapped: false, transparent: true,
        opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false,
      }))
    this.pulse.visible = false
    this.halo.visible = false
    this.group.add(this.pulse, this.halo)
  }

  /** Begin an arrival: a cool point crossing the Quad toward the table. */
  arrive() {
    const angle = this.rand() * Math.PI * 2
    const from = new THREE.Vector3(
      Math.cos(angle) * 15.0, 1.9, Math.sin(angle) * 11.0)
    const to = new THREE.Vector3(
      (this.rand() - 0.5) * FIELD_LEN * 0.7, TABLE_TOP + 0.30,
      (this.rand() - 0.5) * FIELD_DEP * 0.6)
    this.active = { t: 0, from, to }
    this.pulse.visible = true
    this.halo.visible = true
    this.passage.show('student', { force: true })
    return this.active
  }

  _land(to) {
    const mark = {
      x: to.x, z: to.z,
      grammar: GESTURE.STUDENT,
      radius: 0.95 + this.rand() * 0.75,     // wider than anything we do
      amp: 0.070 + this.rand() * 0.050,
      seed: this.rand(),
    }
    this.topography.stamp([mark])
    this.onArrive(mark)
  }

  update(dt) {
    if (this.active) {
      const a = this.active
      a.t += dt / TRAVEL
      const e = a.t < 1 ? 1 - Math.pow(1 - a.t, 3) : 1
      this.pulse.position.lerpVectors(a.from, a.to, e)
      this.halo.position.copy(this.pulse.position)
      const fade = Math.max(0, 1 - Math.max(0, a.t - 1) * 3)
      this.halo.material.opacity = 0.16 * fade
      this.pulse.scale.setScalar(0.6 + e * 0.6)
      if (a.t >= 1 && !a.landed) { a.landed = true; this._land(a.to) }
      if (a.t > 1.35) {
        this.active = null
        this.pulse.visible = false
        this.halo.visible = false
      }
      return
    }
    this.next -= dt
    if (this.next <= 0) {
      const [lo, hi] = STUDENT_EVERY
      this.next = lo + this.rand() * (hi - lo)
      this.arrive()
    }
  }
}
