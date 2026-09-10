/**
 * Renderer, scene, and the daylight sky that doubles as the environment map.
 *
 * Late afternoon rather than dusk: the point of the Quad is the architecture
 * and the lawn, and neither of them survives being lit at night.
 */
import * as THREE from 'three'

import { NOISE } from '../shaders/noise.js'

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SKY_FRAG = /* glsl */`
varying vec3 vDir;
uniform vec3 uSun;
${NOISE}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);

  vec3 zenith  = vec3(0.115, 0.260, 0.560);
  vec3 mid     = vec3(0.330, 0.500, 0.760);
  vec3 horizon = vec3(0.760, 0.800, 0.845);
  vec3 c = h < 0.28 ? mix(horizon, mid, smoothstep(0.0, 0.28, h))
                    : mix(mid, zenith, smoothstep(0.28, 0.85, h));

  // the sun, and the broad glow around it
  float s = max(0.0, dot(d, normalize(uSun)));
  c += vec3(1.00, 0.86, 0.62) * pow(s, 340.0) * 6.0;
  c += vec3(0.95, 0.80, 0.58) * pow(s, 9.0) * 0.28;

  // a few soft banks of cloud, thinning toward the zenith
  if (d.y > 0.0) {
    vec2 p = d.xz / max(d.y + 0.16, 0.08);
    float n = fbm(p * 0.85) * 0.5 + 0.5;
    float band = smoothstep(0.52, 0.86, n) * smoothstep(0.02, 0.30, d.y);
    c = mix(c, vec3(0.96, 0.96, 0.95), band * 0.62);
  }
  gl_FragColor = vec4(c, 1.0);
}
`

/**
 * Early afternoon, sun in the south-west and high.
 *
 * The elevation is doing real work. At 30 degrees the ranges cast shadows
 * about 41 units long, which across an 88-unit Quad reaches the middle and
 * puts the table in gloom all afternoon. At ~51 degrees they cast about 19,
 * so the ranges shade their own walks and the table stands in full sun.
 */
export const SUN_DIR = new THREE.Vector3(-0.48, 0.78, 0.40).normalize()

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.92
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap   // PCFSoft was removed in r186

  const scene = new THREE.Scene()

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    uniforms: { uSun: { value: SUN_DIR.clone() } },
    side: THREE.BackSide, depthWrite: false, toneMapped: true,
  })
  // Radius must stay well inside the camera's far plane, and the sphere is
  // re-centred on the camera every frame — otherwise moving toward one side
  // pushes the far half past `far` and the clipped hole renders as black.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat)
  sky.name = 'Sky'
  sky.frustumCulled = false
  sky.renderOrder = -1
  scene.add(sky)

  // The same sky, prefiltered, is what the limestone and the objects reflect.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat.clone())
  envScene.add(envSky)
  const env = pmrem.fromScene(envScene, 0.05)
  scene.environment = env.texture
  scene.environmentIntensity = 0.70
  envSky.geometry.dispose()
  pmrem.dispose()

  // Light haze, so the far ranges sit back without going grey.
  scene.fog = new THREE.FogExp2(0xa8bcd0, 0.0042)

  return { renderer, scene, sky }
}
