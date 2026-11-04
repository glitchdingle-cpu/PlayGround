import * as THREE from 'three'
import { mulberry32 } from './noise.js'

const SKY_VERTEX = `
  varying vec3 vWorldDirection;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldDirection = normalize(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SKY_FRAGMENT = `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  varying vec3 vWorldDirection;

  void main() {
    vec3 dir = normalize(vWorldDirection);
    float h = smoothstep(-0.08, 0.72, dir.y);
    vec3 col = mix(horizonColor, topColor, h);

    float sunDot = max(dot(dir, sunDirection), 0.0);
    float disc = pow(sunDot, 1450.0);
    float halo = pow(sunDot, 14.0) * 0.16 + pow(sunDot, 4.0) * 0.055;
    col += sunColor * disc * 1.5;
    col += sunColor * halo;
    gl_FragColor = vec4(col, 1.0);
  }
`

function makeClouds(scene, seed) {
  const random = mulberry32(seed)
  const cells = []
  const clusters = 16
  for (let i = 0; i < clusters; i++) {
    const angle = random() * Math.PI * 2
    const dist = 55 + random() * 140
    const cx = Math.cos(angle) * dist
    const cz = Math.sin(angle) * dist
    const cy = 72 + random() * 9
    const count = 4 + ((random() * 6) | 0)
    for (let j = 0; j < count; j++) {
      const sx = 4 + random() * 8
      const sz = 3 + random() * 6
      const sy = 2 + random() * 2.2
      cells.push({
        x: cx + (random() - 0.5) * 20,
        y: cy + (random() - 0.5) * 2.2,
        z: cz + (random() - 0.5) * 15,
        sx, sy, sz,
      })
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    emissive: 0x46515c,
    emissiveIntensity: 0.22,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length)
  mesh.frustumCulled = false
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  cells.forEach((cell, index) => {
    matrix.compose(
      new THREE.Vector3(cell.x, cell.y, cell.z),
      new THREE.Quaternion(),
      new THREE.Vector3(cell.sx, cell.sy, cell.sz),
    )
    mesh.setMatrixAt(index, matrix)
    const tint = 0.9 + random() * 0.1
    color.setRGB(tint, tint, tint)
    mesh.setColorAt(index, color)
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  scene.add(mesh)
  return mesh
}

function makeDust(scene) {
  const count = 180
  const positions = new Float32Array(count * 3)
  const random = mulberry32(424242)
  const data = []
  for (let i = 0; i < count; i++) {
    const p = {
      x: (random() - 0.5) * 34,
      y: random() * 9,
      z: (random() - 0.5) * 34,
      speed: 0.06 + random() * 0.14,
      phase: random() * Math.PI * 2,
    }
    data.push(p)
    positions[i * 3] = p.x
    positions[i * 3 + 1] = p.y
    positions[i * 3 + 2] = p.z
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    color: 0xfff4c8,
    size: 0.075,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  scene.add(points)
  return { points, data, positions }
}

export function createEnvironment(scene, renderer) {
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.16
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x4a9ce3) },
      horizonColor: { value: new THREE.Color(0xd6efff) },
      sunColor: { value: new THREE.Color(0xfff2cc) },
      sunDirection: { value: new THREE.Vector3(-0.45, 0.62, -0.64).normalize() },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 18), skyMaterial)
  sky.name = 'Sky'
  scene.add(sky)

  scene.fog = new THREE.Fog(0xb9dcec, 52, 152)

  const hemisphere = new THREE.HemisphereLight(0xc4e5ff, 0x536138, 1.48)
  scene.add(hemisphere)

  const sun = new THREE.DirectionalLight(0xfff1d2, 2.45)
  sun.position.set(-44, 74, -36)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 190
  sun.shadow.camera.left = -54
  sun.shadow.camera.right = 54
  sun.shadow.camera.top = 54
  sun.shadow.camera.bottom = -54
  sun.shadow.bias = -0.00035
  sun.shadow.normalBias = 0.025
  sun.target.position.set(0, 20, 0)
  scene.add(sun)
  scene.add(sun.target)

  const fill = new THREE.DirectionalLight(0x8dbce8, 0.38)
  fill.position.set(55, 35, 50)
  scene.add(fill)

  const clouds = makeClouds(scene, 7771)
  const dust = makeDust(scene)
  const clock = new THREE.Clock()
  const baseCloudX = clouds.position.x
  let elapsed = 0

  function update(playerPosition) {
    const dt = Math.min(clock.getDelta(), 0.05)
    elapsed += dt
    sky.position.copy(playerPosition)
    clouds.position.x = baseCloudX + Math.sin(elapsed * 0.006) * 34

    sun.position.set(playerPosition.x - 44, playerPosition.y + 74, playerPosition.z - 36)
    sun.target.position.set(playerPosition.x, playerPosition.y + 5, playerPosition.z)
    sun.target.updateMatrixWorld()

    dust.points.position.set(
      Math.floor(playerPosition.x / 34) * 34,
      Math.max(0, Math.floor(playerPosition.y / 9) * 9),
      Math.floor(playerPosition.z / 34) * 34,
    )
    const positions = dust.positions
    for (let i = 0; i < dust.data.length; i++) {
      const p = dust.data[i]
      positions[i * 3] = p.x + Math.sin(elapsed * p.speed + p.phase) * 1.4
      positions[i * 3 + 1] = p.y + Math.sin(elapsed * p.speed * 0.7 + p.phase) * 0.7
      positions[i * 3 + 2] = p.z + Math.cos(elapsed * p.speed * 0.8 + p.phase) * 1.2
    }
    dust.points.geometry.attributes.position.needsUpdate = true
    return dt
  }

  return {
    update,
    sky,
    sun,
    hemisphere,
    clouds,
    dust,
    sunDirection: skyMaterial.uniforms.sunDirection.value,
  }
}
