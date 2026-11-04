import * as THREE from 'three'
import { BLOCKS } from './blocks.js'

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)
const splashGeometry = new THREE.BoxGeometry(1, 0.65, 1)

export class Effects {
  constructor(scene) {
    this.scene = scene
    this.particles = []
    this.materials = new Map()
  }

  materialFor(color, opacity = 1) {
    const key = `${color}-${opacity}`
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshLambertMaterial({ color, transparent: true, opacity }))
    }
    return this.materials.get(key)
  }

  burst(x, y, z, blockId, count = 14, power = 3.2) {
    const block = BLOCKS[blockId]
    const color = new THREE.Color(block?.mapColor || '#9b8b70')
    const material = this.materialFor(color.getHex())
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(cubeGeometry, material)
      const size = 0.06 + Math.random() * 0.1
      mesh.scale.setScalar(size)
      mesh.position.set(
        x + 0.2 + Math.random() * 0.6,
        y + 0.2 + Math.random() * 0.6,
        z + 0.2 + Math.random() * 0.6,
      )
      mesh.castShadow = false
      mesh.receiveShadow = true
      const angle = Math.random() * Math.PI * 2
      const speed = power * (0.35 + Math.random() * 0.8)
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * power,
        vz: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.55,
        maxLife: 1,
        spin: (Math.random() - 0.5) * 8,
      })
      this.scene.add(mesh)
    }
  }

  splash(x, y, z, count = 22) {
    const material = this.materialFor(0x8fd4ff, 0.88)
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(splashGeometry, material)
      const size = 0.09 + Math.random() * 0.12
      mesh.scale.set(size, size, size)
      mesh.position.set(x + (Math.random() - 0.5) * 1.4, y, z + (Math.random() - 0.5) * 1.4)
      const angle = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 2.6
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 2.2 + Math.random() * 3.2,
        vz: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        spin: (Math.random() - 0.5) * 9,
      })
      this.scene.add(mesh)
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        this.particles.splice(i, 1)
        continue
      }
      p.vy -= 17 * dt
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.position.z += p.vz * dt
      p.mesh.rotation.x += p.spin * dt
      p.mesh.rotation.z += p.spin * 0.7 * dt
      const fade = Math.min(1, p.life / 0.22)
      p.mesh.scale.multiplyScalar(0.985)
      p.mesh.material.opacity = fade
    }
  }

  clear() {
    for (const p of this.particles) this.scene.remove(p.mesh)
    this.particles.length = 0
  }
}
