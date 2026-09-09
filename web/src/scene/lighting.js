/**
 * Dusk in the Quad.
 *
 * The table has to be the most legible thing in the scene without being blown
 * out, and its relief has to shadow itself — a topography lit flat is just a
 * coloured rug. So the table gets one high, wide, soft spot rather than a
 * cluster of point lights, which pooled hot in the middle of a 16-unit table.
 */
import * as THREE from 'three'

import { TABLE_TOP } from '../config.js'

export function addLighting(scene) {
  // The last of the sun, low and to the west, raking the limestone.
  const key = new THREE.DirectionalLight(0xffcb98, 0.85)
  key.position.set(-22, 11, 8)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 1
  key.shadow.camera.far = 70
  const s = 20
  key.shadow.camera.left = -s
  key.shadow.camera.right = s
  key.shadow.camera.top = s
  key.shadow.camera.bottom = -s
  key.shadow.bias = -0.0015
  key.shadow.normalBias = 0.03
  scene.add(key)

  // The gathering's own light, hanging over the table.
  const pool = new THREE.SpotLight(0xffd9a6, 300, 0, 0.82, 0.9, 1.9)
  pool.position.set(0, 8.6, 2.2)
  pool.target.position.set(0, TABLE_TOP, 0)
  pool.castShadow = true
  pool.shadow.mapSize.set(2048, 2048)
  pool.shadow.camera.near = 2
  pool.shadow.camera.far = 22
  pool.shadow.bias = -0.0006
  pool.shadow.normalBias = 0.012
  scene.add(pool)
  scene.add(pool.target)

  const sky = new THREE.HemisphereLight(0x44598a, 0x07090d, 0.30)
  scene.add(sky)

  // Cool counter-light from the far range, to keep silhouettes off pure black.
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.26)
  rim.position.set(14, 7, -16)
  scene.add(rim)

  const amb = new THREE.AmbientLight(0x2a3550, 0.28)
  scene.add(amb)

  return { key, pool, sky, rim, amb }
}
