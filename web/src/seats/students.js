/**
 * "...and, importantly, from our students."
 *
 * The passage's last clause gets its own beat, and what it does has to be
 * visibly not one of ours. Faculty at this table decide about objects one at a
 * time. A student arrival does something no seated gesture does: it moves a
 * whole region of the arrangement at once — the topography shifts under a
 * conversation that had settled, and nobody at the table chose it.
 */
import * as THREE from 'three'

import {
  FIELD_DEP, FIELD_LEN, STUDENT_COLOR, STUDENT_EVERY, TABLE_TOP,
} from '../config.js'
import { prng } from '../state/seed.js'

const TRAVEL = 2.8           // seconds from beyond the ring to the table

export class Students {
  constructor({ field, passage, seed = 90210, onArrive }) {
    this.field = field
    this.passage = passage
    this.onArrive = onArrive ?? (() => {})
    this.rand = prng(seed)
    this.next = 16 + this.rand() * 12
    this.active = null

    this.group = new THREE.Group()
    this.group.name = 'Students'

    this.pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 14, 10),
      new THREE.MeshBasicMaterial({ color: STUDENT_COLOR, toneMapped: false }))
    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 14, 10),
      new THREE.MeshBasicMaterial({
        color: STUDENT_COLOR, toneMapped: false, transparent: true,
        opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false,
      }))
    this.pulse.visible = false
    this.halo.visible = false
    this.group.add(this.pulse, this.halo)
  }

  /** Begin an arrival: a cool point crossing the lawn toward the table. */
  arrive() {
    const angle = this.rand() * Math.PI * 2
    const from = new THREE.Vector3(
      Math.cos(angle) * 26.0, 2.4, Math.sin(angle) * 20.0)
    const to = new THREE.Vector3(
      (this.rand() - 0.5) * FIELD_LEN * 0.7, TABLE_TOP + 0.34,
      (this.rand() - 0.5) * FIELD_DEP * 0.5)
    this.active = { t: 0, from, to }
    this.pulse.visible = true
    this.halo.visible = true
    this.passage.show('student', { force: true })
    return this.active
  }

  _land(to) {
    // A whole neighbourhood of the arrangement moves at once.
    const radius = 2.1 + this.rand() * 1.6
    const moved = this.field.nudge(to.x, to.z, radius,
                                   0.20 + this.rand() * 0.16)
    this.onArrive({ x: to.x, z: to.z, radius, moved })
    return moved
  }

  update(dt) {
    if (this.active) {
      const a = this.active
      a.t += dt / TRAVEL
      const e = a.t < 1 ? 1 - Math.pow(1 - a.t, 3) : 1
      this.pulse.position.lerpVectors(a.from, a.to, e)
      this.halo.position.copy(this.pulse.position)
      const fade = Math.max(0, 1 - Math.max(0, a.t - 1) * 3)
      this.halo.material.opacity = 0.30 * fade
      this.pulse.scale.setScalar(0.6 + e * 0.7)
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
