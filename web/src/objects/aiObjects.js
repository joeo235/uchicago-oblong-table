/**
 * The AI objects on the table.
 *
 * "Powerful, flexible, and constantly changing." The changing is the point, so
 * every object carries a noise-driven morph in its vertex shader and is never
 * quite the same shape twice. What a gesture does to an object is visible in
 * the object itself, not just in the mark it leaves:
 *
 *   loose   drifting, breathing, available
 *   held    lifted to your seat, brighter, working faster
 *   molded  morph parameters locked to how you actually dragged it
 *   placed  motion quantised, sitting square — handled by a methodology
 *   aside   quiet, dim, still present. Set aside is not thrown away.
 */
import * as THREE from 'three'

import { FIELD_DEP, FIELD_LEN, RIM, TABLE_DEP, TABLE_LEN, TABLE_TOP } from '../config.js'
import { NOISE3 } from '../table/shaders/noise.js'
import { prng } from '../state/seed.js'

export const OBJECT_COUNT = 14
const REST = 0.19            // how far an object's centre floats above the surface

const PARS = /* glsl */`
uniform float uTime;
uniform float uMorph;
uniform float uFreq;
uniform float uSeed;
uniform float uQuiet;
uniform vec3  uLock;
varying float vMorphAmt;
${NOISE3}

float dispAt(vec3 p) {
  vec3 q = p * uFreq + uLock * 2.0;
  float a = gnoise3(q + vec3(0.0, uTime * 0.32, uSeed * 7.0));
  float b = gnoise3(q * 2.1 - vec3(uTime * 0.19, 0.0, uSeed * 3.0));
  return (a * 0.68 + b * 0.32) * uMorph;
}
`

const MORPH = /* glsl */`
  {
    float d0 = dispAt(position);
    transformed += normal * d0;
    vMorphAmt = d0;
  }
`

const MORPH_NORMAL = /* glsl */`
  {
    vec3 t1 = normalize(cross(normal, abs(normal.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(normal, t1);
    float e = 0.05;
    float d0 = dispAt(position);
    float d1 = dispAt(position + t1 * e);
    float d2 = dispAt(position + t2 * e);
    objectNormal = normalize(normal - t1 * ((d1 - d0) / e) - t2 * ((d2 - d0) / e));
  }
`

function patch(material) {
  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0.030 },
    uFreq: { value: 5.2 },
    uSeed: { value: Math.random() * 10 },
    uQuiet: { value: 0 },
    uLock: { value: new THREE.Vector3() },
    uGlow: { value: 1 },
  }
  const m = material.clone()
  m.customProgramCacheKey = () => 'oblong-ai-object'
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${MORPH}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${MORPH_NORMAL}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uGlow;\nvarying float vMorphAmt;`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        // The leading edge of the morph catches the light as the form changes.
        totalEmissiveRadiance *= uGlow * (1.0 + vMorphAmt * 2.2);
      `)
  }
  return { material: m, uniforms }
}

export class ObjectField {
  /**
   * @param {THREE.Mesh[]} archetypes the nine meshes from objects.glb
   * @param {import('../table/topography.js').Topography} topography
   */
  constructor(archetypes, topography, seed = 771) {
    this.topography = topography
    this.group = new THREE.Group()
    this.group.name = 'AIObjects'
    this.items = []

    const rand = prng(seed)
    const asideSlots = []

    for (let i = 0; i < OBJECT_COUNT; i++) {
      const proto = archetypes[i % archetypes.length]
      const { material, uniforms } = patch(proto.material)
      const mesh = new THREE.Mesh(proto.geometry, material)
      mesh.scale.setScalar(1.22)
      mesh.castShadow = true
      mesh.receiveShadow = false
      mesh.name = `ai-${i}`

      // Scattered about, as the passage has them — not laid out on a grid.
      const x = (rand() - 0.5) * FIELD_LEN * 0.90
      const z = (rand() - 0.5) * FIELD_DEP * 0.72
      uniforms.uSeed.value = rand() * 10
      uniforms.uFreq.value = 4.2 + rand() * 2.6

      const item = {
        index: i,
        archetype: i % archetypes.length,
        mesh,
        uniforms,
        state: 'loose',
        home: new THREE.Vector2(x, z),
        target: new THREE.Vector3(x, TABLE_TOP + REST, z),
        spin: (rand() - 0.5) * 0.5,
        bobPhase: rand() * Math.PI * 2,
        bobRate: 0.5 + rand() * 0.5,
        baseMorph: 0.026 + rand() * 0.020,
        glow: 1.5,
      }
      mesh.position.copy(item.target)
      mesh.userData.item = item
      this.items.push(item)
      this.group.add(mesh)
    }

    this.asideSlots = asideSlots
    this.nextAside = 0
  }

  get meshes() { return this.items.map((i) => i.mesh) }

  /** A free spot on the rim, worked around the table so marks do not stack. */
  claimRimSlot() {
    const n = this.nextAside++
    const perimeter = 2 * (TABLE_LEN + TABLE_DEP)
    const t = ((n * 0.137) % 1) * perimeter
    const inset = RIM / 2
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

  /** Resting height, so objects sit on the relief rather than through it. */
  surfaceY(x, z) {
    const onField = Math.abs(x) <= FIELD_LEN / 2 && Math.abs(z) <= FIELD_DEP / 2
    const h = onField ? this.topography.heightAt(x, z) : 0
    return TABLE_TOP + h + REST
  }

  setState(item, state, opts = {}) {
    item.state = state
    if (state === 'held') {
      item.glow = 3.0
    } else if (state === 'molded') {
      item.glow = 1.85
      item.uniforms.uLock.value.copy(opts.lock ?? new THREE.Vector3())
      item.baseMorph = opts.morph ?? item.baseMorph * 1.6
      item.spin *= 0.6
    } else if (state === 'placed') {
      item.glow = 1.55
      item.spin = 0
      item.baseMorph *= 0.45          // methodology narrows the range of motion
    } else if (state === 'aside') {
      item.glow = 0.45                // an ember: handled, explored, still here
      item.spin *= 0.12
      item.baseMorph *= 0.16
    } else {
      item.glow = 1.5
    }
  }

  update(dt, time, held) {
    for (const item of this.items) {
      const u = item.uniforms
      u.uTime.value = time
      const heldNow = held === item
      const morphScale = heldNow ? 2.0 : 1.0
      u.uMorph.value += (item.baseMorph * morphScale - u.uMorph.value) * Math.min(1, dt * 3)
      u.uGlow.value += (item.glow - u.uGlow.value) * Math.min(1, dt * 2.5)

      if (item.state === 'placed') {
        // Quantised motion: a methodology holds an object to set positions.
        const step = Math.PI / 8
        item.mesh.rotation.y = Math.round(item.mesh.rotation.y / step) * step
      } else {
        item.mesh.rotation.y += item.spin * dt * (heldNow ? 2.2 : 1)
      }

      if (!heldNow) {
        const bob = item.state === 'aside' ? 0.004 : 0.016
        const y = this.surfaceY(item.target.x, item.target.z)
          + Math.sin(time * item.bobRate + item.bobPhase) * bob
        item.mesh.position.x += (item.target.x - item.mesh.position.x) * Math.min(1, dt * 3)
        item.mesh.position.z += (item.target.z - item.mesh.position.z) * Math.min(1, dt * 3)
        item.mesh.position.y += (y - item.mesh.position.y) * Math.min(1, dt * 4)
      }
    }
  }

  dispose() {
    for (const i of this.items) i.mesh.material.dispose()
  }
}
