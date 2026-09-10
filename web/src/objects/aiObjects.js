/**
 * The AI objects on the table — and, between them, the topography.
 *
 * "Over the course of our gathering, an uneven but dynamic table topography
 * emerges, as we continually test, manipulate, and move these objects."
 *
 * The topography is the objects. The table stays flat; what rises and falls is
 * the arrangement on top of it. Each gesture leaves the landscape different:
 *
 *   loose    scattered and drifting, available, easy to pick up
 *   molded   grown and reworked, and piled with others worked the same way,
 *            so molding builds actual height — a mound on the table
 *   placed   snapped to a grid and squared up with its neighbours, so a
 *            methodology reads as a plateau of order rather than a heap
 *   aside    out at the rim, tipped and quiet. Still on the table.
 *
 * Height at any point is therefore not a stored field but a consequence of
 * what is standing there, which is exactly what the passage describes.
 */
import * as THREE from 'three'

import {
  FIELD_DEP, FIELD_LEN, OBJECT_COUNT, RIM, TABLE_DEP, TABLE_LEN, TABLE_TOP,
} from '../config.js'
import { NOISE3 } from '../shaders/noise.js'
import { prng } from '../state/seed.js'

const STACK_RADIUS = 0.26      // how close counts as piling onto the same mound
const GRID = 0.34              // spacing a methodical placement snaps to

const SCALE = { loose: 1.0, molded: 1.5, placed: 1.0, aside: 0.86 }

const PARS = /* glsl */`
uniform float uTime;
uniform float uMorph;
uniform float uSeed;
varying float vMorphAmt;
${NOISE3}

float dispAt(vec3 p) {
  vec3 q = p * 6.5;
  float a = gnoise3(q + vec3(0.0, uTime * 0.22, uSeed * 7.0));
  return a * uMorph;
}
`

/**
 * A light, slow morph. These forms are legible — a quiz, a rubric — and heavy
 * deformation would destroy the thing that makes them worth reading. Enough to
 * say "constantly changing", not enough to stop it being a quiz.
 */
const MORPH = /* glsl */`
  {
    float d0 = dispAt(position);
    transformed += normal * d0;
    vMorphAmt = d0;
  }
`

function patch(material) {
  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0.006 },
    uSeed: { value: Math.random() * 10 },
    uGlow: { value: 1 },
  }
  const m = material.clone()
  m.customProgramCacheKey = () => 'oblong-ai-object'
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${MORPH}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        `#include <common>\nuniform float uGlow;\nvarying float vMorphAmt;`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        totalEmissiveRadiance *= uGlow;
        diffuseColor.rgb *= 0.90 + uGlow * 0.10 + vMorphAmt * 1.4;
      `)
  }
  return { material: m, uniforms }
}

export class ObjectField {
  /** @param {THREE.Mesh[]} archetypes the ten meshes from objects.glb */
  constructor(archetypes, seed = 771) {
    this.group = new THREE.Group()
    this.group.name = 'AIObjects'
    this.items = []
    this.rand = prng(seed)
    this.nextAside = 0

    for (let i = 0; i < OBJECT_COUNT; i++) {
      const a = i % archetypes.length
      const proto = archetypes[a]
      const { material, uniforms } = patch(proto.material)
      const mesh = new THREE.Mesh(proto.geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.name = `ai-${i}`

      proto.geometry.computeBoundingBox()
      const bb = proto.geometry.boundingBox

      const item = {
        index: i,
        archetype: a,
        mesh,
        uniforms,
        state: 'loose',
        height: bb.max.y - bb.min.y,
        pos: new THREE.Vector3(),
        target: new THREE.Vector3(),
        spin: 0,
        drift: new THREE.Vector2(),
        scale: 1,
        tilt: 0,
        glow: 1,
      }
      uniforms.uSeed.value = this.rand() * 10
      mesh.userData.item = item
      this.items.push(item)
      this.group.add(mesh)
      this.scatter(item)
      item.pos.copy(item.target)
      mesh.position.copy(item.pos)
    }
  }

  get meshes() { return this.items.map((i) => i.mesh) }

  /** Somewhere on the open table, clear of anything already standing there. */
  scatter(item) {
    for (let tries = 0; tries < 24; tries++) {
      const x = (this.rand() - 0.5) * FIELD_LEN * 0.94
      const z = (this.rand() - 0.5) * FIELD_DEP * 0.80
      if (this.clearAt(x, z, item, 0.30)) {
        item.target.set(x, TABLE_TOP, z)
        item.mesh.rotation.y = this.rand() * Math.PI * 2
        item.spin = (this.rand() - 0.5) * 0.06
        item.drift.set((this.rand() - 0.5) * 0.004, (this.rand() - 0.5) * 0.003)
        return
      }
    }
    item.target.set((this.rand() - 0.5) * FIELD_LEN * 0.9, TABLE_TOP,
                    (this.rand() - 0.5) * FIELD_DEP * 0.8)
  }

  clearAt(x, z, self, r) {
    for (const o of this.items) {
      if (o === self || o.state === 'aside') continue
      const dx = o.target.x - x, dz = o.target.z - z
      if (dx * dx + dz * dz < r * r) return false
    }
    return true
  }

  /**
   * The topography: how high the arrangement of objects stands at a point.
   * Molded work piles, so a mound genuinely accumulates height.
   */
  supportY(x, z, self) {
    let y = TABLE_TOP
    for (const o of this.items) {
      if (o === self || o.state === 'loose' || o.state === 'aside') continue
      const dx = o.target.x - x, dz = o.target.z - z
      if (dx * dx + dz * dz > STACK_RADIUS * STACK_RADIUS) continue
      y = Math.max(y, o.target.y + o.height * o.scale * 0.80)
    }
    return y
  }

  /** Height of the object landscape above the wood, for reading the table. */
  reliefAt(x, z) {
    let h = 0
    for (const o of this.items) {
      if (o.state === 'aside') continue
      const dx = o.target.x - x, dz = o.target.z - z
      const d2 = dx * dx + dz * dz
      if (d2 > 0.36) continue
      const top = o.target.y - TABLE_TOP + o.height * o.scale
      h = Math.max(h, top * (1 - Math.sqrt(d2) / 0.6))
    }
    return h
  }

  /** A free spot on the rim, worked around so set-aside objects do not stack. */
  claimRimSlot() {
    const n = this.nextAside++
    const perimeter = 2 * (TABLE_LEN + TABLE_DEP)
    const t = ((n * 0.113 + 0.05) % 1) * perimeter
    const inset = RIM * 0.5
    const halfL = TABLE_LEN / 2 - inset
    const halfD = TABLE_DEP / 2 - inset
    let x, z
    if (t < TABLE_LEN) { x = t - TABLE_LEN / 2; z = halfD }
    else if (t < TABLE_LEN + TABLE_DEP) { x = halfL; z = halfD - (t - TABLE_LEN) }
    else if (t < 2 * TABLE_LEN + TABLE_DEP) { x = halfL - (t - TABLE_LEN - TABLE_DEP); z = -halfD }
    else { x = -halfL; z = -halfD + (t - 2 * TABLE_LEN - TABLE_DEP) }
    return new THREE.Vector2(
      THREE.MathUtils.clamp(x, -halfL, halfL),
      THREE.MathUtils.clamp(z, -halfD, halfD))
  }

  /** Commit a gesture. Returns the resulting arrangement change. */
  apply(item, gesture, x, z) {
    if (gesture === 0) return this.mold(item, x, z)
    if (gesture === 1) return this.place(item, x, z)
    return this.setAside(item)
  }

  mold(item, x, z) {
    // Molding piles: the object comes to rest on whatever is already worked
    // into this spot, so a mound builds up where a group has been at it.
    const y = this.supportY(x, z, item)
    item.state = 'molded'
    item.scale = SCALE.molded * (0.86 + this.rand() * 0.34)
    item.tilt = (this.rand() - 0.5) * 0.42
    item.spin = (this.rand() - 0.5) * 0.10
    item.drift.set(0, 0)
    item.glow = 1.18
    item.uniforms.uMorph.value = 0.013 + this.rand() * 0.010
    item.target.set(x, y, z)
    return { x, z, gesture: 0, height: y - TABLE_TOP }
  }

  place(item, x, z) {
    // A methodology squares things up: on the grid, aligned, flat on the wood.
    const gx = Math.round(x / GRID) * GRID
    const gz = Math.round(z / GRID) * GRID
    item.state = 'placed'
    item.scale = SCALE.placed
    item.tilt = 0
    item.spin = 0
    item.drift.set(0, 0)
    item.glow = 1.0
    item.uniforms.uMorph.value = 0.003
    item.mesh.rotation.y = 0
    item.target.set(gx, TABLE_TOP, gz)
    return { x: gx, z: gz, gesture: 1, height: 0 }
  }

  setAside(item) {
    const slot = this.claimRimSlot()
    item.state = 'aside'
    item.scale = SCALE.aside
    item.tilt = 0.18 + this.rand() * 0.14      // tipped, set down, left
    item.spin = 0
    item.drift.set(0, 0)
    item.glow = 0.72
    item.uniforms.uMorph.value = 0.001
    item.target.set(slot.x, TABLE_TOP, slot.y)
    return { x: slot.x, z: slot.y, gesture: 2, height: 0 }
  }

  /** Nudge things around without changing anyone's mind — see students.js. */
  nudge(x, z, radius, strength) {
    let moved = 0
    for (const o of this.items) {
      if (o.state === 'aside') continue
      const dx = o.target.x - x, dz = o.target.z - z
      const d = Math.hypot(dx, dz)
      if (d > radius || d < 1e-4) continue
      const f = (1 - d / radius) * strength
      o.target.x = THREE.MathUtils.clamp(
        o.target.x + (dx / d) * f, -FIELD_LEN / 2, FIELD_LEN / 2)
      o.target.z = THREE.MathUtils.clamp(
        o.target.z + (dz / d) * f, -FIELD_DEP / 2, FIELD_DEP / 2)
      if (o.state === 'molded') o.target.y = this.supportY(o.target.x, o.target.z, o)
      moved++
    }
    return moved
  }

  update(dt, time, held) {
    const k = Math.min(1, dt * 4)
    for (const item of this.items) {
      const u = item.uniforms
      u.uTime.value = time
      u.uGlow.value += ((held === item ? 1.5 : item.glow) - u.uGlow.value)
        * Math.min(1, dt * 3)

      if (held === item) continue

      // loose objects drift: the gathering keeps moving them about
      if (item.state === 'loose') {
        item.target.x += item.drift.x * dt * 60
        item.target.z += item.drift.y * dt * 60
        if (Math.abs(item.target.x) > FIELD_LEN / 2 - 0.2) item.drift.x *= -1
        if (Math.abs(item.target.z) > FIELD_DEP / 2 - 0.2) item.drift.y *= -1
      }

      item.mesh.rotation.y += item.spin * dt
      item.mesh.rotation.z += (item.tilt - item.mesh.rotation.z) * k
      const s = item.scale
      item.mesh.scale.x += (s - item.mesh.scale.x) * k
      item.mesh.scale.y += (s - item.mesh.scale.y) * k
      item.mesh.scale.z += (s - item.mesh.scale.z) * k
      item.pos.lerp(item.target, k)
      item.mesh.position.copy(item.pos)
    }
  }

  /** Census of the arrangement, for the legend and for verification. */
  census() {
    const c = { loose: 0, molded: 0, placed: 0, aside: 0 }
    for (const i of this.items) c[i.state]++
    return c
  }

  dispose() {
    for (const i of this.items) i.mesh.material.dispose()
  }
}
