import * as THREE from 'three'
import { BLOCK, BLOCKS } from './blocks.js'
import { makeCrackTextures } from './textures.js'

const GRAVITY = 27
const WALK_SPEED = 5.3
const SPRINT_SPEED = 7.7
const FLY_SPEED = 11
const PLAYER_WIDTH = 0.62
const PLAYER_HEIGHT = 1.8
const EYE_HEIGHT = 1.62
const REACH = 6.2

const BREAK_TIME = {
  [BLOCK.GRASS]: 0.24,
  [BLOCK.DIRT]: 0.26,
  [BLOCK.SAND]: 0.22,
  [BLOCK.GRAVEL]: 0.26,
  [BLOCK.STONE]: 0.5,
  [BLOCK.COBBLE]: 0.48,
  [BLOCK.MOSSY_COBBLE]: 0.48,
  [BLOCK.BRICK]: 0.52,
  [BLOCK.LOG]: 0.4,
  [BLOCK.PLANKS]: 0.36,
  [BLOCK.LEAVES]: 0.12,
  [BLOCK.SNOW]: 0.16,
}

export class Player {
  constructor({ world, scene, camera, spawn, audio, effects }) {
    this.world = world
    this.scene = scene
    this.camera = camera
    this.audio = audio
    this.effects = effects
    this.spawn = spawn.clone()
    this.position = spawn.clone()
    this.velocity = new THREE.Vector3()
    this.yaw = 0
    this.pitch = -0.12
    this.onGround = false
    this.flying = false
    this.inWater = false
    this.headInWater = false
    this.health = 20
    this.maxHealth = 20
    this.oxygen = 300
    this.dead = false
    this.input = {
      forward: false, back: false, left: false, right: false,
      jump: false, sprint: false, descend: false,
      touchForward: 0, touchRight: 0,
    }
    this.walkPhase = 0
    this.stepDistance = 0
    this.bob = 0
    this.roll = 0
    this.target = null
    this.miningProgress = 0
    this.miningKey = ''
    this.lastDamage = -99
    this.airTime = 0
    this.peakY = spawn.y
    this.drownTimer = 0
    this.onDamage = null
    this.onDeath = null
    this.onHealthChanged = null
    this.onFootstep = null
    this.selected = BLOCK.GRASS
    this.fov = 70
    this.shake = 0
    this.tmp = new THREE.Vector3()

    this.raycaster = new THREE.Raycaster()
    this.raycaster.far = REACH

    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006))
    this.highlight = new THREE.LineSegments(
      outlineGeometry,
      new THREE.LineBasicMaterial({ color: 0x101510, transparent: true, opacity: 0.72, depthTest: true }),
    )
    this.highlight.renderOrder = 4
    this.highlight.visible = false
    scene.add(this.highlight)

    this.crackTextures = makeCrackTextures()
    this.crackMaterial = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), this.crackMaterial)
    this.crackMesh.visible = false
    this.crackMesh.renderOrder = 5
    scene.add(this.crackMesh)
  }

  setSpawn(spawn) {
    this.spawn.copy(spawn)
    this.teleport(spawn)
  }

  teleport(position) {
    this.position.copy(position)
    this.velocity.set(0, 0, 0)
    this.peakY = position.y
    this.airTime = 0
    this.onGround = false
  }

  getEyePosition() {
    return this.tmp.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z)
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity
    this.pitch -= dy * sensitivity
    const limit = Math.PI / 2 - 0.015
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch))
  }

  setTouchMove(x, y) {
    this.input.touchRight = x
    this.input.touchForward = y
  }

  collides(position) {
    const eps = 0.0005
    const half = PLAYER_WIDTH / 2
    const minX = Math.floor(position.x - half + eps)
    const maxX = Math.floor(position.x + half - eps)
    const minY = Math.floor(position.y + eps)
    const maxY = Math.floor(position.y + PLAYER_HEIGHT - eps)
    const minZ = Math.floor(position.z - half + eps)
    const maxZ = Math.floor(position.z + half - eps)
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.world.isSolid(x, y, z)) return true
        }
      }
    }
    return false
  }

  moveAxis(axis, amount) {
    if (amount === 0) return false
    const old = this.position[axis]
    this.position[axis] += amount
    if (this.collides(this.position)) {
      this.position[axis] = old
      return true
    }
    return false
  }

  toggleFly() {
    this.flying = !this.flying
    this.velocity.y = 0
    return this.flying
  }

  takeDamage(amount, cause = 'fall') {
    if (this.dead || amount <= 0) return
    this.health = Math.max(0, this.health - amount)
    this.lastDamage = performance.now() / 1000
    this.shake = Math.min(1, this.shake + 0.35 + amount * 0.07)
    this.audio.hurt()
    if (this.onDamage) this.onDamage(amount, cause)
    if (this.onHealthChanged) this.onHealthChanged(this.health)
    if (this.health <= 0) {
      this.dead = true
      this.velocity.set(0, 0, 0)
      if (this.onDeath) this.onDeath()
    }
  }

  respawn() {
    this.health = this.maxHealth
    this.oxygen = 300
    this.dead = false
    this.lastDamage = -99
    this.teleport(this.world.findSpawn())
    if (this.onHealthChanged) this.onHealthChanged(this.health)
  }

  update(dt) {
    const now = performance.now() / 1000
    if (this.dead) {
      this.highlight.visible = false
      this.crackMesh.visible = false
      this.updateCamera(dt)
      return
    }

    const feetBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 0.15), Math.floor(this.position.z))
    const chestBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 1.35), Math.floor(this.position.z))
    const headBlock = this.world.getBlock(Math.floor(this.position.x), Math.floor(this.position.y + 1.68), Math.floor(this.position.z))
    const wasInWater = this.inWater
    this.inWater = feetBlock === BLOCK.WATER || chestBlock === BLOCK.WATER
    this.headInWater = headBlock === BLOCK.WATER
    if (this.inWater && !wasInWater) {
      if (this.velocity.y < -4) this.effects.splash(this.position.x, this.position.y + 0.1, this.position.z)
      this.audio.splash()
      this.airTime = 0
      this.peakY = this.position.y
    }

    let forwardInput = (this.input.forward ? 1 : 0) - (this.input.back ? 1 : 0) + this.input.touchForward
    let rightInput = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0) + this.input.touchRight
    forwardInput = Math.max(-1, Math.min(1, forwardInput))
    rightInput = Math.max(-1, Math.min(1, rightInput))
    const inputLength = Math.hypot(forwardInput, rightInput)
    if (inputLength > 1) {
      forwardInput /= inputLength
      rightInput /= inputLength
    }

    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    let wishX = forwardInput * -sin + rightInput * cos
    let wishZ = forwardInput * -cos + rightInput * -sin
    const wishLength = Math.hypot(wishX, wishZ)
    if (wishLength > 1) {
      wishX /= wishLength
      wishZ /= wishLength
    }

    const sprinting = this.input.sprint && forwardInput > 0.15 && !this.inWater && !this.flying
    const targetSpeed = this.flying ? FLY_SPEED : this.inWater ? 3.25 : sprinting ? SPRINT_SPEED : WALK_SPEED
    const accel = this.flying ? 8 : this.inWater ? 4.2 : this.onGround ? 15 : 5.5
    const blend = 1 - Math.exp(-accel * dt)
    this.velocity.x += (wishX * targetSpeed - this.velocity.x) * blend
    this.velocity.z += (wishZ * targetSpeed - this.velocity.z) * blend

    if (this.flying) {
      const vertical = (this.input.jump ? 1 : 0) - (this.input.descend ? 1 : 0)
      this.velocity.y += (vertical * FLY_SPEED - this.velocity.y) * (1 - Math.exp(-10 * dt))
      this.onGround = false
    } else if (this.inWater) {
      if (this.input.jump) this.velocity.y = Math.min(4.2, this.velocity.y + 22 * dt)
      else this.velocity.y -= 6.5 * dt
      this.velocity.y = Math.max(this.velocity.y, -3.6)
      this.onGround = false
    } else {
      if (this.input.jump && this.onGround) {
        this.velocity.y = 9.15
        this.onGround = false
        this.audio.jump()
        this.peakY = this.position.y
        this.airTime = 0
      }
      this.velocity.y -= GRAVITY * dt
      this.velocity.y = Math.max(this.velocity.y, -38)
    }

    const wasOnGround = this.onGround
    if (this.moveAxis('x', this.velocity.x * dt)) this.velocity.x = 0
    if (this.moveAxis('z', this.velocity.z * dt)) this.velocity.z = 0
    const hitVertical = this.moveAxis('y', this.velocity.y * dt)
    if (hitVertical) {
      if (this.velocity.y < 0) this.onGround = true
      this.velocity.y = 0
    } else if (!this.inWater && !this.flying) {
      this.onGround = false
    }

    if (this.onGround) {
      if (!wasOnGround) {
        if (this.airTime > 0.15 && this.peakY - this.position.y > 3.5 && !this.inWater) {
          const damage = Math.floor(this.peakY - this.position.y - 3)
          if (damage > 0) this.takeDamage(damage, 'fall')
        }
        this.airTime = 0
        this.peakY = this.position.y
      }
    } else {
      this.airTime += dt
      this.peakY = Math.max(this.peakY, this.position.y)
    }

    if (this.position.y < -8) {
      this.takeDamage(99, 'void')
      this.teleport(this.world.findSpawn())
    }

    if (this.headInWater) {
      this.oxygen = Math.max(0, this.oxygen - dt * 8)
      if (this.oxygen <= 0) {
        this.drownTimer += dt
        if (this.drownTimer > 1) {
          this.drownTimer = 0
          this.takeDamage(2, 'drown')
        }
      }
    } else {
      this.oxygen = Math.min(300, this.oxygen + dt * 35)
      this.drownTimer = 0
    }

    if (now - this.lastDamage > 6 && this.health > 0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + dt * 0.65)
      if (this.onHealthChanged) this.onHealthChanged(this.health)
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z)
    if (this.onGround && horizontalSpeed > 0.25) {
      this.walkPhase += dt * horizontalSpeed * 1.72
      this.bob = Math.sin(this.walkPhase * 2) * Math.min(0.045, horizontalSpeed * 0.007)
      this.roll = Math.sin(this.walkPhase) * Math.min(0.007, horizontalSpeed * 0.0011)
      this.stepDistance += horizontalSpeed * dt
      if (this.stepDistance > (sprinting ? 1.9 : 1.55)) {
        this.stepDistance = 0
        const under = this.world.topBlock(this.position.x, this.position.z)
        const name = BLOCKS[under]?.name || 'grass'
        this.audio.step(/sand/i.test(name) ? 'sand' : /snow/i.test(name) ? 'snow' : /stone|cobble|brick/i.test(name) ? 'stone' : 'grass')
        if (this.onFootstep) this.onFootstep()
      }
    } else {
      this.bob += (0 - this.bob) * Math.min(1, dt * 8)
      this.roll += (0 - this.roll) * Math.min(1, dt * 8)
    }

    this.shake = Math.max(0, this.shake - dt * 1.7)
    this.updateCamera(dt)
  }

  updateCamera(dt) {
    const targetFov = this.input.sprint && !this.inWater ? 75 : 70
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 8)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
    const shakeX = (Math.random() - 0.5) * this.shake * 0.06
    const shakeY = (Math.random() - 0.5) * this.shake * 0.06
    this.camera.position.set(
      this.position.x + shakeX,
      this.position.y + EYE_HEIGHT + this.bob + shakeY,
      this.position.z,
    )
    this.camera.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ')
    this.camera.updateMatrixWorld()
  }

  updateTarget(active = true) {
    if (!active || this.dead) {
      this.highlight.visible = false
      this.crackMesh.visible = false
      this.target = null
      return null
    }
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera)
    const hits = this.raycaster.intersectObjects(this.world.chunkMeshes, false)
    let hit = null
    for (const candidate of hits) {
      if (candidate.object.userData.slot === 'mesh') {
        hit = candidate
        break
      }
    }
    if (!hit) {
      this.highlight.visible = false
      this.crackMesh.visible = false
      this.target = null
      return null
    }
    const normal = hit.face.normal
    const blockX = Math.floor(hit.point.x - normal.x * 0.5)
    const blockY = Math.floor(hit.point.y - normal.y * 0.5)
    const blockZ = Math.floor(hit.point.z - normal.z * 0.5)
    const blockId = this.world.getBlock(blockX, blockY, blockZ)
    const signature = `${blockX},${blockY},${blockZ}`
    if (signature !== this.miningKey) {
      this.miningKey = signature
      this.miningProgress = 0
    }
    this.target = {
      x: blockX, y: blockY, z: blockZ, block: blockId,
      nx: normal.x, ny: normal.y, nz: normal.z,
      signature,
    }
    this.highlight.position.set(blockX + 0.5, blockY + 0.5, blockZ + 0.5)
    this.highlight.visible = true
    return this.target
  }

  updateMining(dt, active, holding, onBreak) {
    if (!active || this.dead) {
      this.crackMesh.visible = false
      return
    }
    const target = this.updateTarget(active)
    if (!target || !holding) {
      this.miningProgress = 0
      this.crackMesh.visible = false
      return
    }
    const definition = BLOCKS[target.block]
    const hardness = BREAK_TIME[target.block] || 0.35
    this.miningProgress += dt / hardness
    const stage = Math.min(5, Math.floor(this.miningProgress * 6))
    this.crackMaterial.map = this.crackTextures[stage]
    this.crackMaterial.needsUpdate = true
    this.crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
    this.crackMesh.visible = this.miningProgress > 0.018
    if (this.miningProgress >= 1) {
      this.world.setBlock(target.x, target.y, target.z, BLOCK.AIR)
      this.effects.burst(target.x, target.y, target.z, target.block, 16)
      this.audio.breakBlock(definition?.name)
      this.miningProgress = 0
      this.crackMesh.visible = false
      this.miningKey = ''
      if (onBreak) onBreak(target)
    }
  }

  placeBlock(blockId, active, onPlace) {
    if (!active || this.dead) return false
    const target = this.target
    if (!target) return false
    const x = target.x + target.nx
    const y = target.y + target.ny
    const z = target.z + target.nz
    if (y <= 0 || y >= 64) return false
    const existing = this.world.getBlock(x, y, z)
    if (BLOCKS[existing].solid) return false
    if (this.intersectsBlock(x, y, z)) return false
    this.world.setBlock(x, y, z, blockId)
    this.effects.burst(x, y, z, blockId, 5, 1.2)
    this.audio.placeBlock()
    if (onPlace) onPlace({ x, y, z, block: blockId })
    return true
  }

  intersectsBlock(x, y, z) {
    const half = PLAYER_WIDTH / 2 + 0.001
    return (
      this.position.x + half > x && this.position.x - half < x + 1 &&
      this.position.y + PLAYER_HEIGHT > y && this.position.y < y + 1 &&
      this.position.z + half > z && this.position.z - half < z + 1
    )
  }

  isUnderwater() {
    return this.headInWater
  }
}
