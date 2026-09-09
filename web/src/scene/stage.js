/**
 * Renderer, scene, and the dusk sky that also serves as the environment map.
 */
import * as THREE from 'three'

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SKY_FRAG = /* glsl */`
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 zenith  = vec3(0.021, 0.030, 0.062);
  vec3 mid     = vec3(0.085, 0.098, 0.150);
  vec3 horizon = vec3(0.330, 0.230, 0.185);
  vec3 c = h < 0.5 ? mix(horizon, mid, smoothstep(0.0, 0.5, h))
                   : mix(mid, zenith, smoothstep(0.5, 1.0, h));
  // the last of the sun, low and to the west
  float sun = pow(max(0.0, dot(normalize(vDir), normalize(vec3(-0.82, 0.14, 0.45)))), 26.0);
  c += vec3(0.62, 0.36, 0.17) * sun;
  gl_FragColor = vec4(c, 1.0);
}
`

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // Size from the canvas's own box rather than the window, so the piece can be
  // embedded in a page and still fill exactly the space it is given.
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap   // PCFSoft was removed in r186

  const scene = new THREE.Scene()

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), skyMat)
  sky.name = 'Sky'
  scene.add(sky)

  // The same gradient, prefiltered, becomes the environment the limestone and
  // the AI objects reflect.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat.clone())
  envScene.add(envSky)
  const env = pmrem.fromScene(envScene, 0.04)
  scene.environment = env.texture
  scene.environmentIntensity = 0.55
  envSky.geometry.dispose()
  pmrem.dispose()

  scene.fog = new THREE.FogExp2(0x0d1017, 0.0095)

  return { renderer, scene, sky }
}
