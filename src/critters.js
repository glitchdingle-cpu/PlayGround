import * as THREE from 'three'
import { BLOCK } from './blocks.js'
import { SEA_LEVEL } from './world.js'

const geometry = new THREE.BoxGeometry(1, 1, 1)
const materials = new Map()

function material(color) {
  if (!materials.has(color)) {
    materials.set(color, new THREE.MeshLambertMaterial({ color }))
  }
  return materials.get(color)
}

function part(group, color, size, position, rotation = [0, 0, 0], shadow = true) {
  const mesh = new THREE.Mesh(geometry, material(color))
  mesh.scale.set(size[0], size[1], size[2])
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.set(rotation[0], rotation[1], rotation[2])
  mesh.castShadow = shadow
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function makePig() {
  const group = new THREE.Group()
  const pink = 0xe6a0a3
  const dark = 0xcf8589
  part(group, pink, [0.78, 0.62, 1.12], [0, 0.62, 0])
  part(group, pink, [0.56, 0.54, 0.52], [0, 0.68, 0.72])
  part(group, dark, [0.32, 0.22, 0.16], [0, 0.58, 1.0])
  part(group, 0x2a201c, [0.07, 0.07, 0.07], [0.16, 0.82, 0.98], [0, 0, 0], false)
  part(group, 0x2a201c, [0.07, 0.07, 0.07], [-0.16, 0.82, 0.98], [0, 0, 0], false)
  part(group, pink, [0.2, 0.18, 0.08], [0.19, 0.96, 0.65], [0, 0, 0], false)
  part(group, pink, [0.2, 0.18, 0.08], [-0.19, 0.96, 0.65], [0, 0, 0], false)
  const legs = []
  for (const x of [-0.26, 0.26]) {
    for (const z of [-0.35, 0.35]) {
      legs.push(part(group, dark, [0.18, 0.42, 0.18], [x, 0.23, z]))
    }
  }
  const tail = part(group, dark, [0.08, 0.08, 0.2], [0, 0.74, -0.62], [0.5, 0, 0])
  return { group, legs, tail, height: 0.92 }
}

function makeSheep() {
  const group = new THREE.Group()
  const wool = 0xeeeae0
  const face = 0x5b5048
  part(group, wool, [0.92, 0.76, 1.12], [0, 0.78, 0], [0, 0, 0.04])
  part(group, wool, [0.82, 0.28, 0.9], [0.08, 1.14, 0.02], [0, 0.1, 0.05])
  part(group, face, [0.44, 0.48, 0.44], [0, 0.86, 0.65])
  part(group, 0x191512, [0.07, 0.07, 0.06], [0.13, 0.96, 0.88], [0, 0, 0], false)
  part(group, 0x191512, [0.07, 0.07, 0.06], [-0.13, 0.96, 0.88], [0, 0, 0], false)
  const legs = []
  for (const x of [-0.3, 0.3]) {
    for (const z of [-0.33, 0.34]) {
      legs.push(part(group, face, [0.16, 0.5, 0.16], [x, 0.26, z]))
    }
  }
  return { group, legs, height: 1.15 }
}

function makeChicken() {
  const group = new THREE.Group()
  const white = 0xf4f0e4
  const beak = 0xe4a931
  part(group, white, [0.39, 0.38, 0.5], [0, 0.38, 0])
  part(group, white, [0.22, 0.29, 0.24], [0, 0.66, 0.26])
  part(group, 0xd64935, [0.1, 0.14, 0.16], [0, 0.84, 0.25], [0, 0, 0], false)
  part(group, beak, [0.1, 0.07, 0.15], [0, 0.63, 0.43], [0, 0, 0], false)
  part(group, 0x2a201c, [0.05, 0.05, 0.05], [0.08, 0.71, 0.38], [0, 0, 0], false)
  part(group, 0x2a201c, [0.05, 0.05, 0.05], [-0.08, 0.71, 0.38], [0, 0, 0], false)
  part(group, white, [0.12, 0.3, 0.34], [0.25, 0.42, 0], [0, 0, -0.12])
  part(group, white, [0.12, 0.3, 0.34], [-0.25, 0.42, 0], [0, 0, 0.12])
  const legs = []
  legs.push(part(group, beak, [0.05, 0.28, 0.05], [0.09, 0.14, 0.02]))
  legs.push(part(group, beak, [0.05, 0.28, 0.05], [-0.09, 0.14, 0.02]))
  return { group, legs, height: 0.85 }
}

const TYPES = {
  pig: makePig,
  sheep: makeSheep,
  chicken: makeChicken,
}

class Critter {
  constructor(scene, world, type, position) {
    const model = TYPES[type]()
    this.scene = scene
    this.world = world
    this.type = type
    this.group = model.group
    this.legs = model.legs
    this.height = model.height
    this.position = position.clone()
    this.target = position.clone()
    this.speed = type === 'chicken' ? 0.75 : 0.48
    this.phase = Math.random() * 10
    this.timer = Math.random() * 3
    this.walk = 0
    this.group.position.copy(this.position)
    this.group.rotation.y = Math.random() * Math.PI * 2
    scene.add(this.group)
  }

  chooseTarget() {
    this.timer = 2.5 + Math.random() * 4.5
    if (Math.random() < 0.2) {
      this.target.copy(this.position)
      return
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const distance = 1.5 + Math.random() * 5.5
      const x = Math.round(this.position.x + Math.cos(angle) * distance) + 0.5
      const z = Math.round(this.position.z + Math.sin(angle) * distance) + 0.5
      const top = this.world.topBlock(x, z)
      if (top !== BLOCK.GRASS && top !== BLOCK.SAND && top !== BLOCK.SNOW) continue
      const y = this.world.surfaceHeight(x, z)
      if (y <= SEA_LEVEL + 1 || y > 40) continue
      if (Math.abs(y - this.position.y) > 2) continue
      this.target.set(x, y, z)
      return
    }
    this.target.copy(this.position)
  }

  update(dt, time) {
    this.timer -= dt
    if (this.timer <= 0) this.chooseTarget()
    const dx = this.target.x - this.position.x
    const dz = this.target.z - this.position.z
    const distance = Math.hypot(dx, dz)
    let moving = false
    if (distance > 0.12) {
      moving = true
      const step = Math.min(distance, this.speed * dt)
      const nx = this.position.x + (dx / distance) * step
      const nz = this.position.z + (dz / distance) * step
      const y = this.world.surfaceHeight(nx, nz)
      if (y > SEA_LEVEL && Math.abs(y - this.position.y) < 1.25) {
        this.position.x = nx
        this.position.z = nz
        this.position.y = y
      } else {
        this.timer = 0
      }
      const targetYaw = Math.atan2(dx, dz)
      let diff = targetYaw - this.group.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      this.group.rotation.y += diff * Math.min(1, dt * 4)
    }
    this.walk += (moving ? 1 : 0 - this.walk) * Math.min(1, dt * 6)
    this.group.position.copy(this.position)
    this.group.position.y += Math.abs(Math.sin(time * (moving ? 7 : 1.8) + this.phase)) * (moving ? 0.035 : 0.008)
    const stride = Math.sin(time * 8 + this.phase) * 0.38 * this.walk
    this.legs.forEach((leg, index) => {
      leg.rotation.x = stride * (index % 2 === 0 ? 1 : -1)
    })
  }
}

function isWalkable(world, x, z) {
  const top = world.topBlock(x, z)
  if (top !== BLOCK.GRASS && top !== BLOCK.SAND) return false
  const y = world.surfaceHeight(x, z)
  return y > SEA_LEVEL + 1 && y < SEA_LEVEL + 9
}

function findNearbyLand(world, origin, offset, radius = 8) {
  const baseX = Math.round(origin.x + offset[0])
  const baseZ = Math.round(origin.z + offset[1])
  for (let r = 0; r <= radius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.abs(dx) !== r && Math.abs(dz) !== r) continue
        const x = baseX + dx + 0.5
        const z = baseZ + dz + 0.5
        if (!isWalkable(world, x, z)) continue
        return new THREE.Vector3(x, world.surfaceHeight(x, z), z)
      }
    }
  }
  return null
}

export class Critters {
  constructor(scene, world, spawn) {
    this.list = []
    const planned = [
      ['pig', [-8, -3]],
      ['sheep', [9, 1]],
      ['chicken', [5, -6]],
      ['chicken', [-14, 5]],
      ['sheep', [-4, 9]],
    ]
    for (const [type, offset] of planned) {
      const point = findNearbyLand(world, spawn, offset, 9)
      if (!point) continue
      this.list.push(new Critter(scene, world, type, point))
    }
  }

  update(dt, time) {
    for (const critter of this.list) critter.update(dt, time)
  }
}
