import * as THREE from 'three'
import { BLOCK, BLOCKS } from './blocks.js'
import { fbm2, hash2, mulberry32, smoothstep } from './noise.js'
import { atlasTexture, uvRect } from './textures.js'

export const CHUNK_X = 16
export const CHUNK_Z = 16
export const WORLD_HEIGHT = 64
export const SEA_LEVEL = 16
const CHUNK_AREA = CHUNK_X * CHUNK_Z
const CHUNK_VOLUME = CHUNK_AREA * WORLD_HEIGHT

const FACES = [
  {
    normal: [1, 0, 0], cornerName: 'side',
    vertices: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    shade: 0.84, axis: 0,
  },
  {
    normal: [-1, 0, 0], cornerName: 'side',
    vertices: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    shade: 0.71, axis: 0,
  },
  {
    normal: [0, 1, 0], cornerName: 'top',
    vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
    shade: 1.0, axis: 1,
  },
  {
    normal: [0, -1, 0], cornerName: 'bottom',
    vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    shade: 0.54, axis: 1,
  },
  {
    normal: [0, 0, 1], cornerName: 'side',
    vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    shade: 0.8, axis: 2,
  },
  {
    normal: [0, 0, -1], cornerName: 'side',
    vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
    shade: 0.67, axis: 2,
  },
]

export const PALETTE = {
  morning: {
    skyTop: 0x3f91df,
    skyHorizon: 0xd8f0ff,
    fog: 0xb9dcec,
    sun: 0xfff0cf,
    ambient: 0xbfe0ff,
    ground: 0x58613a,
  },
}

export function terrainHeight(x, z, seed) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const broad = fbm2(ix * 0.0105, iz * 0.0105, seed, 5) - 0.5
  const detail = fbm2(ix * 0.048, iz * 0.048, seed + 17, 3) - 0.5
  let h = 20.6 + broad * 15.5 + detail * 3.2

  // A soft basin cradles the lake in front of the spawn point.
  const basin = Math.exp(-((ix * ix) / (2 * 27 * 27) + (iz * iz) / (2 * 24 * 24)))
  h -= basin * 8.2

  // A tiny forested island gives the lake a focal point.
  h += 6.4 * Math.exp(-((ix + 15) ** 2 + (iz + 3) ** 2) / (2 * 6.8 * 6.8))

  // Distant mountains rise beyond the opposite shore.
  const ridge = fbm2(ix * 0.0072 + 13.7, iz * 0.0072 - 4.1, seed + 73, 4)
  const far = smoothstep(26, 82, Math.hypot(ix, iz + 8))
  const mask = smoothstep(0.43, 0.7, ridge)
  h += mask * far * 32

  const p1 = 28 * Math.exp(-(((ix + 29) / 38) ** 2 + ((iz + 53) / 25) ** 2))
  const p2 = 23 * Math.exp(-(((ix - 44) / 31) ** 2 + ((iz + 62) / 23) ** 2))
  const p3 = 19 * Math.exp(-(((ix - 1) / 34) ** 2 + ((iz + 80) / 24) ** 2))
  h += (p1 + p2 + p3) * (1 - basin * 0.82)

  return Math.max(2, Math.min(58, Math.floor(h)))
}

function slopeAt(x, z, seed) {
  const h = terrainHeight(x, z, seed)
  return Math.max(
    Math.abs(h - terrainHeight(x + 1, z, seed)),
    Math.abs(h - terrainHeight(x - 1, z, seed)),
    Math.abs(h - terrainHeight(x, z + 1, seed)),
    Math.abs(h - terrainHeight(x, z - 1, seed)),
  )
}

const LANDMARK_TREES = [
  [-20, 15], [21, 23], [-15, -3], [30, 11], [-35, 27], [42, 30], [-7, 43], [18, 40],
]

function treeChance(x, z, seed) {
  const h = terrainHeight(x, z, seed)
  if (h <= SEA_LEVEL + 2 || h > 38) return 0
  if (slopeAt(x, z, seed) > 3) return 0
  const r = hash2(x, z, seed + 991)
  if (r < 0.0015 || r > 0.025) return 0
  const forest = fbm2(x * 0.019, z * 0.019, seed + 221, 3)
  const chance = forest > 0.53 ? 0.023 : forest > 0.47 ? 0.009 : 0.0025
  if (r > chance) return 0
  return h
}

function isLandmarkTree(x, z) {
  return LANDMARK_TREES.some(([tx, tz]) => tx === x && tz === z)
}

export class World {
  constructor(scene, seed = 20260214, renderDistance = 6) {
    this.scene = scene
    this.seed = seed
    this.renderDistance = renderDistance
    this.chunks = new Map()
    this.chunkMeshes = []
    this.dirty = new Set()
    this.time = 0
    this.worldGroup = new THREE.Group()
    this.worldGroup.name = 'VoxelWorld'
    scene.add(this.worldGroup)

    const maxAnisotropy = 4
    atlasTexture.anisotropy = maxAnisotropy
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      alphaTest: 0.38,
      side: THREE.FrontSide,
    })
    this.plantMaterial = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      vertexColors: true,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
    })
    this.waterMaterial = new THREE.MeshPhongMaterial({
      map: atlasTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      shininess: 90,
      specular: 0x9edfff,
      side: THREE.DoubleSide,
    })
    this.clouds = null
  }

  key(cx, cz) {
    return `${cx},${cz}`
  }

  ensureData(cx, cz) {
    const k = this.key(cx, cz)
    let chunk = this.chunks.get(k)
    if (chunk) return chunk
    chunk = {
      cx, cz, key: k,
      data: this.generateChunk(cx, cz),
      mesh: null, plantMesh: null, waterMesh: null,
      dirty: false,
    }
    this.chunks.set(k, chunk)
    return chunk
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_VOLUME)
    const startX = cx * CHUNK_X
    const startZ = cz * CHUNK_Z
    const random = mulberry32((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ this.seed) >>> 0)

    for (let z = 0; z < CHUNK_Z; z++) {
      for (let x = 0; x < CHUNK_X; x++) {
        const wx = startX + x
        const wz = startZ + z
        const h = terrainHeight(wx, wz, this.seed)
        const slope = slopeAt(wx, wz, this.seed)
        const top = this.chooseTopBlock(wx, wz, h, slope)
        const underwater = h < SEA_LEVEL

        for (let y = 0; y <= h; y++) {
          let block
          if (y === 0) block = BLOCK.BEDROCK
          else if (y === h) block = top
          else if (y > h - 4) block = underwater ? BLOCK.SAND : h > 38 ? BLOCK.STONE : BLOCK.DIRT
          else block = BLOCK.STONE
          data[(y * CHUNK_Z + z) * CHUNK_X + x] = block
        }

        if (underwater) {
          for (let y = h + 1; y <= SEA_LEVEL && y < WORLD_HEIGHT; y++) {
            data[(y * CHUNK_Z + z) * CHUNK_X + x] = BLOCK.WATER
          }
        } else if (h + 1 < WORLD_HEIGHT) {
          const ground = data[(h * CHUNK_Z + z) * CHUNK_X + x]
          const canPlant = ground === BLOCK.GRASS && slope < 2
          const roll = random()
          if (canPlant && roll < 0.15) {
            data[((h + 1) * CHUNK_Z + z) * CHUNK_X + x] = BLOCK.TALL_GRASS
          } else if (canPlant && roll < 0.168) {
            data[((h + 1) * CHUNK_Z + z) * CHUNK_X + x] = BLOCK.POPPY
          } else if (canPlant && roll < 0.177) {
            data[((h + 1) * CHUNK_Z + z) * CHUNK_X + x] = BLOCK.DANDELION
          }
        }
      }
    }

    // Trees are evaluated just outside the chunk too, so canopies cross borders cleanly.
    for (let wz = startZ - 3; wz < startZ + CHUNK_Z + 3; wz++) {
      for (let wx = startX - 3; wx < startX + CHUNK_X + 3; wx++) {
        const landmark = isLandmarkTree(wx, wz)
        let base = landmark ? terrainHeight(wx, wz, this.seed) : treeChance(wx, wz, this.seed)
        if (!base && !landmark) continue
        if (base <= SEA_LEVEL + 1) {
          if (!landmark) continue
          base = SEA_LEVEL + 2
        }
        this.placeTree(data, cx, cz, wx, wz, base)
      }
    }

    return data
  }

  chooseTopBlock(wx, wz, h, slope) {
    const patch = fbm2(wx * 0.07, wz * 0.07, this.seed + 5, 2)
    if (h < SEA_LEVEL - 1) {
      return patch > 0.62 ? BLOCK.GRAVEL : BLOCK.SAND
    }
    if (h <= SEA_LEVEL + 1) return BLOCK.SAND
    if (h >= 41) return BLOCK.SNOW
    if (h >= 37 || slope >= 4) return patch > 0.58 ? BLOCK.MOSSY_COBBLE : BLOCK.STONE
    if (slope >= 3) return BLOCK.STONE
    return BLOCK.GRASS
  }

  placeTree(data, cx, cz, wx, wz, base) {
    const random = mulberry32((hash2(wx, wz, this.seed + 401) * 0xffffffff) >>> 0)
    const height = 4 + ((random() * 3) | 0)
    const top = base + height
    const startX = cx * CHUNK_X
    const startZ = cz * CHUNK_Z
    const set = (x, y, z, block, overwrite = false) => {
      const lx = x - startX
      const lz = z - startZ
      if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z || y < 0 || y >= WORLD_HEIGHT) return
      const idx = (y * CHUNK_Z + lz) * CHUNK_X + lx
      if (!overwrite && data[idx] !== BLOCK.AIR) return
      data[idx] = block
    }

    // Low plants are replaced by the trunk.
    for (let y = base + 1; y <= top; y++) set(wx, y, wz, BLOCK.LOG, true)

    for (let dy = -2; dy <= 1; dy++) {
      const y = top + dy
      const radius = dy >= 0 ? 1 : 2
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dz === 0 && y <= top) continue
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && random() > 0.28) continue
          set(wx + dx, y, wz + dz, BLOCK.LEAVES)
        }
      }
    }
    set(wx, top + 2, wz, BLOCK.LEAVES)
    set(wx, top + 3, wz, BLOCK.LEAVES)
  }

  getBlock(wx, wy, wz) {
    if (wy < 0) return BLOCK.BEDROCK
    if (wy >= WORLD_HEIGHT) return BLOCK.AIR
    const cx = Math.floor(wx / CHUNK_X)
    const cz = Math.floor(wz / CHUNK_Z)
    const chunk = this.ensureData(cx, cz)
    const lx = ((wx % CHUNK_X) + CHUNK_X) % CHUNK_X
    const lz = ((wz % CHUNK_Z) + CHUNK_Z) % CHUNK_Z
    return chunk.data[(wy * CHUNK_Z + lz) * CHUNK_X + lx]
  }

  isSolid(wx, wy, wz) {
    return BLOCKS[this.getBlock(wx, wy, wz)].solid
  }

  setBlock(wx, wy, wz, block) {
    if (wy <= 0 || wy >= WORLD_HEIGHT) return false
    const cx = Math.floor(wx / CHUNK_X)
    const cz = Math.floor(wz / CHUNK_Z)
    const chunk = this.ensureData(cx, cz)
    const lx = ((wx % CHUNK_X) + CHUNK_X) % CHUNK_X
    const lz = ((wz % CHUNK_Z) + CHUNK_Z) % CHUNK_Z
    chunk.data[(wy * CHUNK_Z + lz) * CHUNK_X + lx] = block
    this.markDirty(cx, cz)
    if (lx === 0) this.markDirty(cx - 1, cz)
    if (lx === CHUNK_X - 1) this.markDirty(cx + 1, cz)
    if (lz === 0) this.markDirty(cx, cz - 1)
    if (lz === CHUNK_Z - 1) this.markDirty(cx, cz + 1)
    return true
  }

  markDirty(cx, cz) {
    const key = this.key(cx, cz)
    const chunk = this.chunks.get(key)
    if (chunk) this.dirty.add(key)
  }

  ensureArea(centerX, centerZ, radius) {
    // Data first, then meshes, keeps border face queries cheap and deterministic.
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        this.ensureData(centerX + dx, centerZ + dz)
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const key = this.key(centerX + dx, centerZ + dz)
        const chunk = this.chunks.get(key)
        if (chunk && !chunk.mesh) this.buildChunk(chunk)
      }
    }
  }

  buildChunk(chunk) {
    const { data, cx, cz } = chunk
    const solid = { pos: [], norm: [], uv: [], color: [], idx: [] }
    const plants = { pos: [], norm: [], uv: [], color: [], idx: [] }
    const water = { pos: [], norm: [], uv: [], color: [], idx: [] }
    const startX = cx * CHUNK_X
    const startZ = cz * CHUNK_Z
    const blockAt = (x, y, z) => {
      if (x < 0 || x >= CHUNK_X || z < 0 || z >= CHUNK_Z || y < 0 || y >= WORLD_HEIGHT) {
        return this.getBlock(startX + x, y, startZ + z)
      }
      return data[(y * CHUNK_Z + z) * CHUNK_X + x]
    }

    const isOccluder = (x, y, z) => BLOCKS[blockAt(x, y, z)].solid

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_Z; z++) {
        for (let x = 0; x < CHUNK_X; x++) {
          const id = data[(y * CHUNK_Z + z) * CHUNK_X + x]
          if (id === BLOCK.AIR) continue
          const definition = BLOCKS[id]

          if (definition.plant) {
            this.addPlant(plants, x, y, z, id)
            continue
          }

          if (definition.liquid) {
            for (const face of FACES) {
              const [nx, ny, nz] = face.normal
              const neighbor = blockAt(x + nx, y + ny, z + nz)
              if (neighbor !== BLOCK.AIR) continue
              this.addFace(water, x, y, z, face, definition.tiles.top, 1, 0.9)
            }
            continue
          }

          for (const face of FACES) {
            const [nx, ny, nz] = face.normal
            const neighbor = blockAt(x + nx, y + ny, z + nz)
            const neighborDef = BLOCKS[neighbor]
            let visible = !neighborDef.solid
            if (neighbor === BLOCK.LEAVES && id === BLOCK.LEAVES) visible = false
            if (!visible) continue
            const tile = definition.tiles[face.cornerName]
            const ao = this.ambientOcclusion(x, y, z, face, isOccluder)
            this.addFace(solid, x, y, z, face, tile, 1, 1, ao)
          }
        }
      }
    }

    this.finishChunkMesh(chunk, 'mesh', solid, this.opaqueMaterial, true)
    this.finishChunkMesh(chunk, 'plantMesh', plants, this.plantMaterial, false)
    this.finishChunkMesh(chunk, 'waterMesh', water, this.waterMaterial, false)
    chunk.dirty = false
  }

  ambientOcclusion(x, y, z, face, isOccluder) {
    const axis = face.axis
    const normal = face.normal
    const bx = x + normal[0]
    const by = y + normal[1]
    const bz = z + normal[2]
    const otherAxes = [0, 1, 2].filter((a) => a !== axis)
    const result = []
    for (const v of face.vertices) {
      const signs = []
      for (const a of otherAxes) {
        signs.push([a, v[a] ? 1 : -1])
      }
      const s1 = [0, 0, 0]
      s1[signs[0][0]] += signs[0][1]
      const s2 = [0, 0, 0]
      s2[signs[1][0]] += signs[1][1]
      const occ1 = isOccluder(bx + s1[0], by + s1[1], bz + s1[2]) ? 1 : 0
      const occ2 = isOccluder(bx + s2[0], by + s2[1], bz + s2[2]) ? 1 : 0
      const cor = isOccluder(bx + s1[0] + s2[0], by + s1[1] + s2[1], bz + s1[2] + s2[2]) ? 1 : 0
      let brightness
      if (occ1 && occ2) brightness = 0.55
      else brightness = 1 - 0.14 * (occ1 + occ2 + cor)
      result.push(brightness)
    }
    return result
  }

  addFace(target, x, y, z, face, tile, alpha, shade, ao = null) {
    const [u0, v0, u1, v1] = uvRect(tile)
    const base = target.pos.length / 3
    for (let i = 0; i < 4; i++) {
      const v = face.vertices[i]
      target.pos.push(x + v[0], y + v[1], z + v[2])
      target.norm.push(face.normal[0], face.normal[1], face.normal[2])
      const c = (ao ? ao[i] : 1) * face.shade * shade
      target.color.push(c, c, c)
    }
    target.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
    target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  addPlant(target, x, y, z, id) {
    const [u0, v0, u1, v1] = uvRect(BLOCKS[id].tiles.top)
    const planes = [
      [[0.1, 0, 0.1], [0.9, 0, 0.9]],
      [[0.9, 0, 0.1], [0.1, 0, 0.9]],
    ]
    for (const [a, b] of planes) {
      for (let side = 0; side < 2; side++) {
        const base = target.pos.length / 3
        const verts = side === 0
          ? [[a[0], 0, a[2]], [b[0], 0, b[2]], [b[0], 1, b[2]], [a[0], 1, a[2]]]
          : [[b[0], 0, b[2]], [a[0], 0, a[2]], [a[0], 1, a[2]], [b[0], 1, b[2]]]
        for (const v of verts) {
          target.pos.push(x + v[0], y + v[1], z + v[2])
          target.norm.push(0, 1, 0)
          const c = 0.98
          target.color.push(c, c, c)
        }
        target.uv.push(u0, v0, u1, v0, u1, v1, u0, v1)
        target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }
  }

  finishChunkMesh(chunk, slot, target, material, castShadow) {
    const old = chunk[slot]
    if (old) {
      this.worldGroup.remove(old)
      old.geometry.dispose()
      const i = this.chunkMeshes.indexOf(old)
      if (i >= 0) this.chunkMeshes.splice(i, 1)
      chunk[slot] = null
    }
    if (!target.idx.length) return
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(target.pos, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(target.norm, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(target.uv, 2))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(target.color, 3))
    geometry.setIndex(target.idx)
    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(chunk.cx * CHUNK_X, 0, chunk.cz * CHUNK_Z)
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
    mesh.userData.chunk = chunk
    mesh.userData.slot = slot
    chunk[slot] = mesh
    this.worldGroup.add(mesh)
    this.chunkMeshes.push(mesh)
  }

  rebuildDirty() {
    if (!this.dirty.size) return
    for (const key of this.dirty) {
      const chunk = this.chunks.get(key)
      if (!chunk) continue
      this.buildChunk(chunk)
    }
    this.dirty.clear()
  }

  update(playerPosition, radius = this.renderDistance) {
    this.time += 0.016
    const cx = Math.floor(playerPosition.x / CHUNK_X)
    const cz = Math.floor(playerPosition.z / CHUNK_Z)
    if (this.lastCx !== cx || this.lastCz !== cz) {
      this.lastCx = cx
      this.lastCz = cz
      this.ensureArea(cx, cz, radius)
    }
    this.rebuildDirty()

    // Trim far meshes while keeping their block data for fast backtracking.
    const maxDist = (radius + 2.5) * CHUNK_X
    for (const chunk of this.chunks.values()) {
      if (!chunk.mesh) continue
      const dx = (chunk.cx + 0.5) * CHUNK_X - playerPosition.x
      const dz = (chunk.cz + 0.5) * CHUNK_Z - playerPosition.z
      if (dx * dx + dz * dz > maxDist * maxDist) {
        this.removeMeshes(chunk)
      }
    }
  }

  removeMeshes(chunk) {
    for (const slot of ['mesh', 'plantMesh', 'waterMesh']) {
      const mesh = chunk[slot]
      if (!mesh) continue
      this.worldGroup.remove(mesh)
      mesh.geometry.dispose()
      const i = this.chunkMeshes.indexOf(mesh)
      if (i >= 0) this.chunkMeshes.splice(i, 1)
      chunk[slot] = null
    }
  }

  findSpawn() {
    let best = null
    for (let radius = 0; radius < 48; radius++) {
      const steps = radius === 0 ? 1 : Math.max(10, radius * 6)
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2
        const x = Math.round(Math.cos(angle) * radius)
        const z = Math.round(32 + Math.sin(angle) * radius * 0.72)
        const h = terrainHeight(x, z, this.seed)
        const slope = slopeAt(x, z, this.seed)
        if (h <= SEA_LEVEL + 2 || h > SEA_LEVEL + 10 || slope > 2) continue
        best = new THREE.Vector3(x + 0.5, h + 1.02, z + 0.5)
        if (Math.abs(x) < 6) return best
      }
    }
    return best || new THREE.Vector3(0.5, SEA_LEVEL + 4.2, 32.5)
  }

  surfaceHeight(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const block = this.getBlock(Math.floor(x), y, Math.floor(z))
      if (BLOCKS[block].solid) return y + 1
    }
    return 0
  }

  topBlock(x, z) {
    const cx = Math.floor(x / CHUNK_X)
    const cz = Math.floor(z / CHUNK_Z)
    const chunk = this.ensureData(cx, cz)
    const lx = ((Math.floor(x) % CHUNK_X) + CHUNK_X) % CHUNK_X
    const lz = ((Math.floor(z) % CHUNK_Z) + CHUNK_Z) % CHUNK_Z
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = chunk.data[(y * CHUNK_Z + lz) * CHUNK_X + lx]
      if (id !== BLOCK.AIR) return id
    }
    return BLOCK.AIR
  }
}
