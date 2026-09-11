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
  FIELD_DEP, FIELD_LEN, GRID, OBJECT_COUNT, RIM, TABLE_DEP, TABLE_LEN, TABLE_TOP,
} from '../config.js'
import { NOISE3 } from '../shaders/noise.js'
import { prng } from '../state/seed.js'

const STACK_RADIUS = 0.26      // how close counts as piling onto the same mound
const MAX_PILE = 0.55          // how high a mound gets before it spreads instead
// Objects may sit a little inside each other's nominal circle before it reads
// as a collision — the radius is a half-diagonal, so it over-estimates.
const NESTLE = 0.78

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
    this.moldCounter = 0

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
        moldSeq: 0,          // when it was worked; gives a pile a definite bottom
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
    for (let tries = 0; tries < 40; tries++) {
      const x = (this.rand() - 0.5) * FIELD_LEN * 0.94
      const z = (this.rand() - 0.5) * FIELD_DEP * 0.80
      if (this.clearFor(item, x, z)) {
        item.target.set(x, TABLE_TOP, z)
        item.mesh.rotation.y = this.rand() * Math.PI * 2
        item.spin = (this.rand() - 0.5) * 0.06
        item.drift.set((this.rand() - 0.5) * 0.0006, (this.rand() - 0.5) * 0.00045)
        return
      }
    }
    const spot = this.findClear(item, (this.rand() - 0.5) * FIELD_LEN * 0.9,
                                (this.rand() - 0.5) * FIELD_DEP * 0.8)
    item.target.set(spot.x, TABLE_TOP, spot.z)
  }

  /**
   * Footprint radius on the table — half the diagonal of the object's own
   * bounding box in plan, scaled. Conservative, and it does not depend on how
   * the object happens to be turned.
   */
  radiusOf(item) {
    if (item._r0 === undefined) {
      item.mesh.geometry.computeBoundingBox()
      const bb = item.mesh.geometry.boundingBox
      item._r0 = 0.5 * Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
    }
    return item._r0 * item.scale
  }

  /**
   * Is there room for `item` at (x, z) without touching anything standing?
   *
   * Pass `atY` to ask only about things at that height. An object is allowed
   * to share a footprint with what it is stacked on — that is what a pile is —
   * but not with something sitting beside it on the same level.
   */
  clearFor(item, x, z, { slack = NESTLE, atY = null } = {}) {
    const ri = this.radiusOf(item)
    for (const o of this.items) {
      if (o === item || o.held) continue
      if (atY !== null && Math.abs(o.target.y - atY) > 0.02) continue
      const dx = o.target.x - x, dz = o.target.z - z
      const need = (ri + this.radiusOf(o)) * slack
      if (dx * dx + dz * dz < need * need) return false
    }
    return true
  }

  /**
   * Move any *loose* object that is in the way out of the way.
   *
   * When someone puts a thing down somewhere deliberately, the thing they
   * chose should stay where they put it and whatever was lying there should
   * shift — "we continually test, manipulate, and move these objects". Only
   * loose objects yield; a methodical placement or a worked pile has been
   * put there on purpose and is left alone.
   */
  _displaceLoose(item, atY) {
    let moved = 0
    for (const o of this.items) {
      if (o === item || o.held || o.state !== 'loose') continue
      if (Math.abs(o.target.y - atY) > 0.02) continue
      const dx = o.target.x - item.target.x, dz = o.target.z - item.target.z
      const need = (this.radiusOf(item) + this.radiusOf(o)) * NESTLE
      if (dx * dx + dz * dz >= need * need) continue
      const spot = this.findClear(o, o.target.x, o.target.z)
      if (this.clearFor(o, spot.x, spot.z)) {
        o.target.set(spot.x, TABLE_TOP, spot.z)
        moved++
      }
    }
    return moved
  }

  /** The nearest spot to (x, z) with room for `item`, searching outward. */
  findClear(item, x, z) {
    const hx = FIELD_LEN / 2 - 0.3, hz = FIELD_DEP / 2 - 0.25
    const cx = THREE.MathUtils.clamp(x, -hx, hx)
    const cz = THREE.MathUtils.clamp(z, -hz, hz)
    if (this.clearFor(item, cx, cz)) return { x: cx, z: cz }
    for (let i = 1; i <= 160; i++) {
      const a = i * 2.39996                  // golden angle, so it fans evenly
      const r = 0.18 + i * 0.035
      const px = THREE.MathUtils.clamp(cx + Math.cos(a) * r, -hx, hx)
      const pz = THREE.MathUtils.clamp(cz + Math.sin(a) * r, -hz, hz)
      if (this.clearFor(item, px, pz)) return { x: px, z: pz }
    }
    return { x: cx, z: cz }                  // table is full; leave it be
  }

  /**
   * The topography: how high the arrangement of objects stands at a point.
   * Molded work piles, so a mound genuinely accumulates height.
   */
  supportY(x, z, self) {
    let y = TABLE_TOP
    // An object may only rest on something worked *before* it. Without that
    // rule two objects in the same spot each try to sit on the other, and
    // every settle pass leapfrogs the pair a little higher — a pile that
    // climbs without bound. The order makes support a strict hierarchy.
    const selfSeq = self && self.state === 'molded' ? self.moldSeq : Infinity
    for (const o of this.items) {
      // Nothing rests on a thing that is loose, set aside, or in someone's hand.
      if (o === self || o.held) continue
      if (o.state === 'loose' || o.state === 'aside') continue
      if (o.state === 'molded' && o.moldSeq >= selfSeq) continue
      const dx = o.target.x - x, dz = o.target.z - z
      if (dx * dx + dz * dz > STACK_RADIUS * STACK_RADIUS) continue
      y = Math.max(y, o.target.y + o.height * o.scale * 0.80)
    }
    return y
  }

  /**
   * Re-seat everything that is standing on something else.
   *
   * A resting height is only true for as long as whatever is underneath stays
   * put. Set the bottom of a pile aside, place it flat, pick it up, or nudge
   * it out from under, and anything stacked on top keeps its old height and
   * hangs in the air. Any change that can remove support runs this.
   */
  settle() {
    // Because support only ever points backward in mold order, one pass in
    // that order is enough: every object is re-seated after everything it
    // could possibly be standing on.
    const stacked = this.items
      .filter((o) => o.state === 'molded' && !o.held)
      .sort((a, b) => a.moldSeq - b.moldSeq)
    for (const o of stacked) {
      o.target.y = this.supportY(o.target.x, o.target.z, o)
    }
    return stacked.length
  }

  /** Anything left hovering with nothing beneath it — should always be zero. */
  floating(tolerance = 0.02) {
    return this.items.filter((o) => {
      if (o.held || o.state === 'aside' || o.state === 'loose') return false
      return o.target.y - this.supportY(o.target.x, o.target.z, o) > tolerance
    })
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
    const perimeter = 2 * (TABLE_LEN + TABLE_DEP)
    // Walk the rim and take the position furthest from anything already set
    // down. A fixed stride wraps the perimeter and starts landing on top of
    // its own earlier slots once there are more than a handful.
    const used = this.items.filter((o) => o.state === 'aside')
      .map((o) => ({ x: o.target.x, z: o.target.z }))
    let bestT = 0, bestD = -1
    const SAMPLES = 240
    for (let i = 0; i < SAMPLES; i++) {
      const t = (i / SAMPLES) * perimeter
      const p = this._rimPoint(t)
      let d = Infinity
      for (const u of used) d = Math.min(d, Math.hypot(u.x - p.x, u.z - p.z))
      if (d > bestD) { bestD = d; bestT = t }   // NaN never wins, by design
    }
    this.nextAside++
    return this._rimPoint(bestT)
  }

  /**
   * A point on the rim, parameterised by distance around the perimeter.
   * Returns { x, z } rather than a Vector2: a Vector2 carries the table's z in
   * its `.y`, which is exactly the sort of thing that reads as `.z` somewhere
   * else and silently yields NaN.
   */
  _rimPoint(t) {
    const inset = RIM * 0.5
    const halfL = TABLE_LEN / 2 - inset
    const halfD = TABLE_DEP / 2 - inset
    let x, z
    if (t < TABLE_LEN) { x = t - TABLE_LEN / 2; z = halfD }
    else if (t < TABLE_LEN + TABLE_DEP) { x = halfL; z = halfD - (t - TABLE_LEN) }
    else if (t < 2 * TABLE_LEN + TABLE_DEP) { x = halfL - (t - TABLE_LEN - TABLE_DEP); z = -halfD }
    else { x = -halfL; z = -halfD + (t - 2 * TABLE_LEN - TABLE_DEP) }
    return {
      x: THREE.MathUtils.clamp(x, -halfL, halfL),
      z: THREE.MathUtils.clamp(z, -halfD, halfD),
    }
  }

  /** Commit a gesture. Returns the resulting arrangement change. */
  apply(item, gesture, x, z, opts = {}) {
    if (gesture === 0) return this.mold(item, x, z, opts)
    if (gesture === 1) return this.place(item, x, z, opts)
    return this.setAside(item)
  }

  mold(item, x, z, opts = {}) {
    // Molding piles: the object comes to rest on whatever is already worked
    // into this spot, so a mound builds up where a group has been at it. Past
    // a few deep it spreads sideways instead of towering — left unbounded, a
    // long session stacks a single spot metres into the air.
    //
    // The sequence number is assigned first: it puts this object at the top of
    // the stacking order, so it rests on what is already there and nothing
    // already there tries to rest back on it.
    item.state = 'molded'
    item.moldSeq = ++this.moldCounter
    // Scale first. Clearance is measured from the footprint, and molding grows
    // the object by about half again — checked at its old size it fits, then
    // grows into whatever is beside it.
    item.scale = SCALE.molded * (0.86 + this.rand() * 0.34)
    if (opts.noStack) {
      // Replayed history lands flat and clear. A pile is something you watch
      // happen; arriving at a table of objects already sitting on each other
      // just reads as a glitch.
      const spot = this.findClear(item, x, z)
      x = spot.x; z = spot.z
    }
    let y = this.supportY(x, z, item)
    if (y > TABLE_TOP + MAX_PILE) {
      const spot = this._spreadFrom(x, z, item)
      x = spot.x; z = spot.z; y = spot.y
    }
    // Standing on something is fine — that is what a pile is. Standing
    // *inside* a neighbour is not. Loose things in the way are moved aside
    // first, so the spot someone actually chose is honoured; only if the
    // blocker is itself deliberate does this object go elsewhere.
    item.target.set(x, y, z)
    this._displaceLoose(item, y)
    if (!this.clearFor(item, x, z, { atY: y })) {
      const spot = this.findClear(item, x, z)
      x = spot.x; z = spot.z
      y = this.supportY(x, z, item)
    }
    item.tilt = (this.rand() - 0.5) * 0.42
    item.spin = (this.rand() - 0.5) * 0.10
    item.drift.set(0, 0)
    item.glow = 1.18
    item.uniforms.uMorph.value = 0.013 + this.rand() * 0.010
    item.target.set(x, y, z)
    this.settle()
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
    this.settle()                      // it may have been holding something up
    return { x: gx, z: gz, gesture: 1, height: 0 }
  }

  /** The closest unoccupied cell of the methodical grid. */
  _freeCell(item, x, z) {
    const hx = FIELD_LEN / 2 - 0.3, hz = FIELD_DEP / 2 - 0.25
    const snap = (v, h) => THREE.MathUtils.clamp(Math.round(v / GRID) * GRID, -h, h)
    const gx = snap(x, hx), gz = snap(z, hz)
    if (this.clearFor(item, gx, gz)) return { x: gx, z: gz }
    // rings of cells outward from the one asked for
    for (let ring = 1; ring <= 12; ring++) {
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dz = -ring; dz <= ring; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
          const px = snap(gx + dx * GRID, hx), pz = snap(gz + dz * GRID, hz)
          if (this.clearFor(item, px, pz)) return { x: px, z: pz }
        }
      }
    }
    return { x: gx, z: gz }
  }

  /** Somewhere near (x, z) where a mound is not already too tall. */
  _spreadFrom(x, z, item) {
    const hx = FIELD_LEN / 2 - 0.25, hz = FIELD_DEP / 2 - 0.20
    let best = { x, z, y: this.supportY(x, z, item) }
    // Search out far enough to actually reach bare wood. A short search finds
    // only the shoulder of the mound it is trying to escape, and the pile goes
    // on growing; on a 15-unit table there is nearly always free space.
    for (let i = 1; i <= 40; i++) {
      const a = i * 2.39996                  // golden angle, so it fans evenly
      const r = 0.22 + i * 0.085
      const cx = THREE.MathUtils.clamp(x + Math.cos(a) * r, -hx, hx)
      const cz = THREE.MathUtils.clamp(z + Math.sin(a) * r, -hz, hz)
      const y = this.supportY(cx, cz, item)
      if (y < best.y) best = { x: cx, z: cz, y }
      if (y <= TABLE_TOP + 1e-6) break
    }
    return best
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
    item.target.set(slot.x, TABLE_TOP, slot.z)
    this.settle()                      // whatever was piled on it comes down
    return { x: slot.x, z: slot.z, gesture: 2, height: 0 }
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
      // A methodology stays methodical even when it gets moved.
      if (o.state === 'placed') {
        o.target.x = Math.round(o.target.x / GRID) * GRID
        o.target.z = Math.round(o.target.z / GRID) * GRID
      }
      moved++
    }
    // Settle once, after everything has moved — doing it inside the loop makes
    // the result depend on the order objects happen to be iterated in.
    this.settle()
    return moved
  }

  update(dt, time, held) {
    const k = Math.min(1, dt * 4)

    // Hold the invariant rather than only establishing it at boot. Colleagues
    // and students go on rearranging the table for as long as it is open, and
    // a clean start that decays over the first minute is not a clean table.
    // Cheap at this count, and it moves nothing it cannot place clear.
    this._repairIn = (this._repairIn ?? 0) - dt
    if (this._repairIn <= 0) {
      this._repairIn = 0.45
      this.separate({ maxPasses: 2 })
    }

    for (const item of this.items) {
      const u = item.uniforms
      u.uTime.value = time
      u.uGlow.value += ((held === item ? 1.5 : item.glow) - u.uGlow.value)
        * Math.min(1, dt * 3)

      if (held === item) continue

      // Loose objects drift — the gathering keeps moving them about — but
      // they turn aside rather than sliding through whatever is in the way.
      if (item.state === 'loose') {
        const nx = item.target.x + item.drift.x * dt * 60
        const nz = item.target.z + item.drift.y * dt * 60
        if (Math.abs(nx) > FIELD_LEN / 2 - 0.25) item.drift.x *= -1
        else if (this.clearFor(item, nx, item.target.z)) item.target.x = nx
        else item.drift.x *= -1
        if (Math.abs(nz) > FIELD_DEP / 2 - 0.22) item.drift.y *= -1
        else if (this.clearFor(item, item.target.x, nz)) item.target.z = nz
        else item.drift.y *= -1
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

  /**
   * Pull apart anything whose footprint intersects something else, and
   * optionally bring down anything standing on something else.
   *
   * Placement searches for a clear spot, but on a table this full the search
   * can exhaust and fall back to an occupied one. Rather than trust that it
   * never does, this repairs the result: the invariant is checked and fixed
   * rather than assumed. The most movable object in each pair gives way —
   * loose first, then molded, and a methodical placement only ever moves to
   * another cell of its grid, so a tidy row stays on the grid.
   *
   * `flatten` also un-stacks. It is a separate step because `overlaps()`
   * ignores pairs at different heights — a pile is *meant* to share a
   * footprint — so stacking is invisible to the loop below.
   */
  separate({ maxPasses = 8, flatten = false } = {}) {
    const rank = { loose: 0, molded: 1, placed: 2, aside: 3 }
    let moved = 0, unstacked = 0

    if (flatten) {
      // lowest first, so a pile comes down from the bottom
      const stacked = this.items
        .filter((o) => o.state === 'molded' && o.target.y > TABLE_TOP + 0.005)
        .sort((a, b) => a.target.y - b.target.y)
      for (const o of stacked) {
        const spot = this.findClear(o, o.target.x, o.target.z)
        o.target.set(spot.x, TABLE_TOP, spot.z)
        unstacked++
      }
    }
    for (let pass = 0; pass < maxPasses; pass++) {
      const pairs = this.overlaps()
      if (!pairs.length) {
        // Must still settle: an earlier pass may have moved the bottom of a
        // pile, which leaves whatever was on it hanging. Returning here
        // without settling was leaving objects in the air.
        if (!flatten && moved) this.settle()
        return { passes: pass, moved, unstacked }
      }
      let fixed = 0
      for (const p of pairs) {
        const A = this.items[p.a], B = this.items[p.b]
        const give = rank[A.state] <= rank[B.state] ? A : B
        if (give.state === 'aside') continue        // the rim is its own problem
        const spot = give.state === 'placed'
          ? this._freeCell(give, give.target.x, give.target.z)
          : this.findClear(give, give.target.x, give.target.z)
        if (this.clearFor(give, spot.x, spot.z)) {
          give.target.x = spot.x
          give.target.z = spot.z
          give.target.y = give.state === 'molded'
            ? this.supportY(spot.x, spot.z, give) : TABLE_TOP
          fixed++; moved++
        }
      }
      if (!fixed) break
    }
    if (!flatten) this.settle()        // settling would re-stack a flattened table
    return { passes: maxPasses, moved, unstacked, remaining: this.overlaps().length }
  }

  /** Pairs of objects whose footprints intersect — should always be empty. */
  overlaps() {
    const out = []
    for (let i = 0; i < this.items.length; i++) {
      for (let j = i + 1; j < this.items.length; j++) {
        const A = this.items[i], B = this.items[j]
        if (A.held || B.held) continue
        // things genuinely piled are meant to share a footprint
        if (Math.abs(A.target.y - B.target.y) > 0.02) continue
        const d = Math.hypot(A.target.x - B.target.x, A.target.z - B.target.z)
        const need = (this.radiusOf(A) + this.radiusOf(B)) * NESTLE
        if (d < need) out.push({ a: A.index, b: B.index, d, need })
      }
    }
    return out
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
