/**
 * Trees around the Quad.
 *
 * Instanced from three exported variants, set back beyond the paths so the
 * lawn around the table stays open, with a ragged spacing — a Quad is planted,
 * not surveyed.
 */
import * as THREE from 'three'

import { QUAD_INNER } from '../config.js'
import { prng } from '../state/seed.js'

export function plantTrees(variants, seed = 8080) {
  const group = new THREE.Group()
  group.name = 'Trees'
  if (!variants.length) return group

  const rand = prng(seed)
  const spots = []

  // Two rows along each side, inside the ranges and clear of the crossing paths.
  const half = QUAD_INNER / 2
  for (const inset of [9.5, 16.5]) {
    const r = half - inset
    const n = Math.round((r * 2) / (inset < 12 ? 8.5 : 11.0))
    for (const side of [0, 1, 2, 3]) {
      for (let i = 0; i <= n; i++) {
        const t = (i / n - 0.5) * r * 2
        if (Math.abs(t) < 6.5) continue            // leave the paths clear
        const j = () => (rand() - 0.5) * 2.6
        const p = side === 0 ? [t + j(), r + j()]
          : side === 1 ? [r + j(), -t + j()]
            : side === 2 ? [-t + j(), -r + j()]
              : [-r + j(), t + j()]
        spots.push(p)
      }
    }
  }

  const perVariant = variants.map(() => [])
  spots.forEach((p, i) => perVariant[i % variants.length].push(p))

  variants.forEach((v, vi) => {
    const list = perVariant[vi]
    if (!list.length) return
    for (const part of ['trunk', 'canopy']) {
      const proto = v[part]
      const inst = new THREE.InstancedMesh(proto.geometry, proto.material, list.length)
      inst.castShadow = true
      inst.receiveShadow = part === 'canopy'
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const s = new THREE.Vector3()
      const pos = new THREE.Vector3()
      list.forEach(([x, z], i) => {
        const sc = 0.82 + rand() * 0.55
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2)
        s.set(sc, sc * (0.9 + rand() * 0.3), sc)
        pos.set(x, 0, z)
        m.compose(pos, q, s)
        inst.setMatrixAt(i, m)
      })
      inst.instanceMatrix.needsUpdate = true
      inst.frustumCulled = false
      group.add(inst)
    }
  })
  group.userData.count = spots.length
  return group
}
