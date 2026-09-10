/**
 * Late afternoon in the Quad.
 *
 * One sun doing nearly all the work, a blue-sky fill, and a faint bounce off
 * the lawn. No fixture over the table: it is outdoors in daylight, and adding
 * a lamp for legibility would only flatten the sunlight that makes the
 * topography of objects read in the first place.
 */
import * as THREE from 'three'

import { SUN_DIR } from './stage.js'

export function addLighting(scene) {
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.15)
  sun.position.copy(SUN_DIR).multiplyScalar(60)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 140
  // Tight around the table and its immediate lawn — a frustum wide enough for
  // the whole Quad would spend all its resolution on grass.
  // Wide enough that the trees ringing the lawn cast onto the grass, tight
  // enough that the objects on the table still resolve.
  const s = 40
  sun.shadow.camera.left = -s
  sun.shadow.camera.right = s
  sun.shadow.camera.top = s
  sun.shadow.camera.bottom = -s
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.022
  scene.add(sun)
  scene.add(sun.target)

  const sky = new THREE.HemisphereLight(0x9dc0ee, 0x3d4a28, 0.52)
  scene.add(sky)

  // Warm bounce back off the grass and the limestone, from the opposite side.
  const bounce = new THREE.DirectionalLight(0xffe6c4, 0.26)
  bounce.position.set(18, 5, -22)
  scene.add(bounce)

  return { sun, sky, bounce }
}
