/**
 * The people at the table.
 *
 * Presences, not figures: a warm ember at each seat, breathing at its own rate.
 * Modelling bodies would imply identity and land squarely in the uncanny
 * valley, and the passage never asks us to picture anyone in particular.
 *
 * Colleagues also act on their own. That is not decoration — the passage says
 * the topography shifts "as we learn more from each other", so other people's
 * gestures have to actually reach the surface. Their choice of gesture is drawn
 * evenly across the three, for the same reason the seeded history is.
 */
import * as THREE from 'three'

import {
  AMBIENT_GESTURE_EVERY, FACULTY_COLOR, FIELD_DEP, FIELD_LEN, GESTURE,
} from '../config.js'
import { prng } from '../state/seed.js'
import { YOUR_SEAT, seatLayout } from './layout.js'

const EMBER_Y = 1.06

/** A soft radial falloff, so a presence glows rather than reading as a disc. */
function glowTexture() {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0.00, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,255,255,0.72)')
  grad.addColorStop(0.45, 'rgba(255,255,255,0.20)')
  grad.addColorStop(1.00, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class Gathering {
  constructor({ topography, onAct, seed = 4242 }) {
    this.topography = topography
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

    // A small solid core...
    const embers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.040, 12, 8),
      new THREE.MeshBasicMaterial({ toneMapped: false }), n)

    const m = new THREE.Matrix4()
    this.phase = []
    this.rate = []
    this.level = new Float32Array(n).fill(1)
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const st = this.seats[i]
      m.makeTranslation(st.position.x, EMBER_Y, st.position.z)
      embers.setMatrixAt(i, m)
      pos[i * 3] = st.position.x
      pos[i * 3 + 1] = EMBER_Y
      pos[i * 3 + 2] = st.position.z
      this.phase.push(this.rand() * Math.PI * 2)
      this.rate.push(0.35 + this.rand() * 0.5)
    }
    embers.instanceMatrix.needsUpdate = true

    // ...inside a soft halo. Points billboard for free and stay cheap at 28.
    const halosGeo = new THREE.BufferGeometry()
    halosGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    halosGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const halos = new THREE.Points(halosGeo, new THREE.PointsMaterial({
      map: glowTexture(), size: 0.62, sizeAttenuation: true,
      transparent: true, depthWrite: false, vertexColors: true,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }))
    halos.frustumCulled = false

    this.embers = embers
    this.halos = halos
    this.haloColor = halosGeo.getAttribute('color')
    this.group.add(embers, halos)

    this.warm = new THREE.Color(FACULTY_COLOR)
    this.you = new THREE.Color(0xfff2dd)
    this._paint()
  }

  _paint() {
    const c = new THREE.Color()
    const arr = this.haloColor.array
    for (let i = 0; i < this.seats.length; i++) {
      const base = i === YOUR_SEAT ? this.you : this.warm
      c.copy(base).multiplyScalar(this.level[i])
      this.embers.setColorAt(i, c)
      arr[i * 3] = c.r * 0.55
      arr[i * 3 + 1] = c.g * 0.55
      arr[i * 3 + 2] = c.b * 0.55
    }
    this.embers.instanceColor.needsUpdate = true
    this.haloColor.needsUpdate = true
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

  /** A colleague considers something and leaves a mark in front of their seat. */
  act(seatIndex = null) {
    const i = seatIndex ?? Math.floor(this.rand() * this.seats.length)
    if (i === YOUR_SEAT) return this.act((i + 3) % this.seats.length)
    const seat = this.seats[i]
    const grammar = this._drawGesture()

    // In front of them, drawn a little way in toward the middle of the table.
    const inward = 0.35 + this.rand() * 0.5
    const x = THREE.MathUtils.clamp(
      seat.position.x * (1 - inward * 0.22) + (this.rand() - 0.5) * 1.1,
      -FIELD_LEN / 2 + 0.3, FIELD_LEN / 2 - 0.3)
    const z = THREE.MathUtils.clamp(
      seat.position.z * (1 - inward), -FIELD_DEP / 2 + 0.25, FIELD_DEP / 2 - 0.25)

    const mark = {
      x, z, grammar,
      radius: 0.34 + this.rand() * 0.34,
      amp: 0.070 + this.rand() * 0.065,
      seed: this.rand(),
    }
    this.topography.stamp([mark])
    this.level[i] = 2.6                       // they light up as they speak
    this.onAct(mark, i)
    return { mark, seat: i }
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
