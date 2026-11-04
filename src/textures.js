import * as THREE from 'three'
import { mulberry32 } from './noise.js'
import { TILE, BLOCKS } from './blocks.js'

const SIZE = 16
const CELL = 64
const ATLAS_TILES = 8

function canvas(size = SIZE) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return c
}

function paint(ctx, x, y, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

function paletteFill(ctx, colors, random, extra = 0) {
  for (let y = -extra; y < SIZE + extra; y++) {
    for (let x = -extra; x < SIZE + extra; x++) {
      paint(ctx, x, y, colors[(random() * colors.length) | 0])
    }
  }
}

function speckle(ctx, random, colors, count = 22) {
  for (let i = 0; i < count; i++) {
    paint(ctx, (random() * SIZE) | 0, (random() * SIZE) | 0, colors[(random() * colors.length) | 0])
  }
}

function line(ctx, x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0)
  let dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  ctx.fillStyle = color
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

function makeTile(draw) {
  const c = canvas()
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const random = mulberry32(0x9e3779b9 + Math.round(Math.random() * 0))
  draw(ctx, random)
  return c
}

const grassTop = makeTile((ctx, random) => {
  paletteFill(ctx, ['#5d9636', '#68a33c', '#548a30', '#71ae44', '#4d812c'], random)
  speckle(ctx, random, ['#82ba4b', '#46762a', '#90c451'], 28)
  for (let i = 0; i < 9; i++) {
    const x = (random() * 16) | 0
    const y = (random() * 16) | 0
    paint(ctx, x, y, random() > 0.5 ? '#9acb58' : '#3f6e26')
  }
})

const grassSide = makeTile((ctx, random) => {
  paletteFill(ctx, ['#805c3b', '#775335', '#8b6743', '#6e4d31', '#936e47'], random)
  speckle(ctx, random, ['#a17b51', '#5f432a', '#b08a5d'], 22)
  for (let x = 0; x < 16; x++) {
    const depth = 3 + ((random() * 3) | 0)
    for (let y = 0; y < depth; y++) {
      paint(ctx, x, y, ['#5f9a35', '#6ba63d', '#548c2e', '#78b447'][(random() * 4) | 0])
    }
    if (random() > 0.62) paint(ctx, x, depth, '#47772a')
  }
})

const dirt = makeTile((ctx, random) => {
  paletteFill(ctx, ['#805c3b', '#765235', '#8b6743', '#6c4b2e', '#946f49'], random)
  speckle(ctx, random, ['#a47d53', '#5e4128', '#b18a5c', '#6a4930'], 35)
})

const stone = makeTile((ctx, random) => {
  paletteFill(ctx, ['#7d7d7d', '#858585', '#747474', '#8d8d8d', '#6d6d6d'], random)
  speckle(ctx, random, ['#989898', '#626262', '#a0a0a0'], 22)
  line(ctx, 2, 4, 6, 6, '#5e5e5e')
  line(ctx, 6, 6, 5, 9, '#666666')
  line(ctx, 10, 12, 14, 14, '#646464')
  line(ctx, 12, 2, 14, 4, '#686868')
})

const cobble = makeTile((ctx, random) => {
  ctx.fillStyle = '#454545'
  ctx.fillRect(0, 0, 16, 16)
  const stones = [
    [1, 1, 6, 4], [8, 1, 7, 3], [1, 6, 3, 4], [5, 6, 5, 5], [11, 5, 4, 4],
    [1, 11, 6, 4], [8, 10, 2, 5], [11, 11, 4, 4], [8, 14, 2, 2],
  ]
  for (let i = 0; i < stones.length; i++) {
    const [x, y, w, h] = stones[i]
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        paint(ctx, x + xx, y + yy, ['#7c7c7c', '#858585', '#737373', '#8e8e8e'][(random() * 4) | 0])
      }
    }
    for (let xx = 0; xx < w; xx++) paint(ctx, x + xx, y + h - 1, '#5a5a5a')
    for (let yy = 0; yy < h; yy++) paint(ctx, x + w - 1, y + yy, '#666666')
  }
  speckle(ctx, random, ['#999999', '#555555'], 14)
})

const sand = makeTile((ctx, random) => {
  paletteFill(ctx, ['#d8ca88', '#e0d397', '#d0c17d', '#e6daa2', '#cbbc77'], random)
  speckle(ctx, random, ['#efe5b5', '#beae6c', '#f4ecc3'], 30)
  line(ctx, 2, 5, 5, 6, '#c2b371')
  line(ctx, 10, 11, 14, 10, '#c8b875')
})

const logSide = makeTile((ctx, random) => {
  paletteFill(ctx, ['#77532f', '#6d4a2a', '#805b35', '#5f4025', '#89623a'], random)
  for (let x = 0; x < 16; x++) {
    if (x % 4 === 0 || random() > 0.68) {
      const color = random() > 0.45 ? '#513620' : '#976d40'
      for (let y = 0; y < 16; y++) {
        if (random() > 0.1) paint(ctx, x, y, color)
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = 2 + ((random() * 12) | 0)
    const y = 2 + ((random() * 12) | 0)
    paint(ctx, x, y, '#3b2718')
    paint(ctx, x + 1, y, '#5d4026')
  }
})

const logTop = makeTile((ctx, random) => {
  paletteFill(ctx, ['#a27b4e', '#b08757', '#956e45', '#b98f5d'], random)
  const cx = 7.5
  const cy = 7.5
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d > 7.4) paint(ctx, x, y, ['#614324', '#6f4d2a', '#563b20'][(random() * 3) | 0])
      else if (d > 6.7) paint(ctx, x, y, '#4d361f')
      else {
        const ring = Math.floor(d * 0.9)
        if (ring % 2 === 0) paint(ctx, x, y, '#a47d50')
        else paint(ctx, x, y, '#c09a67')
      }
    }
  }
  paint(ctx, 7, 7, '#5d4126')
  paint(ctx, 8, 7, '#5d4126')
})

const leaves = makeTile((ctx, random) => {
  paletteFill(ctx, ['#3c6b2b', '#457a32', '#356126', '#4d8538', '#2e5722'], random)
  speckle(ctx, random, ['#5f9b43', '#294c1e', '#6ba94c', '#23441a'], 58)
  for (let i = 0; i < 13; i++) {
    paint(ctx, (random() * 16) | 0, (random() * 16) | 0, '#173414')
  }
  for (let i = 0; i < 7; i++) {
    paint(ctx, (random() * 16) | 0, (random() * 16) | 0, '#7ab257')
  }
})

const planks = makeTile((ctx, random) => {
  paletteFill(ctx, ['#b68b54', '#c0955c', '#aa7f4b', '#c99f65', '#9e7442'], random)
  for (let y = 0; y < 16; y++) {
    if (y === 4 || y === 9 || y === 14) {
      for (let x = 0; x < 16; x++) paint(ctx, x, y, random() > 0.22 ? '#765331' : '#cfab72')
    }
  }
  for (const [x, y0, y1] of [[7, 0, 4], [5, 5, 9], [12, 10, 14], [2, 10, 14]]) {
    for (let y = y0; y < y1; y++) paint(ctx, x, y, '#806039')
  }
  speckle(ctx, random, ['#d4ae75', '#87643a', '#dfba82'], 18)
  for (let i = 0; i < 5; i++) {
    const x = 1 + ((random() * 14) | 0)
    const y = 1 + ((random() * 14) | 0)
    paint(ctx, x, y, '#8e693e')
    paint(ctx, x + 1, y, '#d1a96f')
  }
})

const brick = makeTile((ctx, random) => {
  ctx.fillStyle = '#b3a79b'
  ctx.fillRect(0, 0, 16, 16)
  for (let row = 0; row < 3; row++) {
    const y = row * 5
    const offset = row % 2 === 0 ? 0 : -4
    for (let bx = offset; bx < 16; bx += 9) {
      for (let yy = 0; yy < 4; yy++) {
        for (let xx = 0; xx < 8; xx++) {
          if (bx + xx < 0 || bx + xx >= 16) continue
          paint(ctx, bx + xx, y + yy, ['#9e4b3d', '#a85343', '#8d4034', '#b45c48'][(random() * 4) | 0])
        }
      }
    }
  }
  speckle(ctx, random, ['#c7b9ab', '#7e382e'], 10)
})

const water = makeTile((ctx, random) => {
  paletteFill(ctx, ['#327cad', '#3786b8', '#2e74a3', '#3c8fc1', '#296c99'], random)
  for (let y = 2; y < 16; y += 5) {
    for (let x = 0; x < 16; x++) {
      if ((x + y) % 7 < 4) paint(ctx, x, y, '#58a8d2')
      if ((x + y) % 11 === 0) paint(ctx, x, y + 1, '#4c9ac6')
    }
  }
  speckle(ctx, random, ['#78c1e5', '#28678e'], 18)
})

const snow = makeTile((ctx, random) => {
  paletteFill(ctx, ['#eef5fb', '#e5eef7', '#f5fbff', '#dce9f5', '#ffffff'], random)
  speckle(ctx, random, ['#c8dbea', '#ffffff', '#b7cee1'], 25)
})

const gravel = makeTile((ctx, random) => {
  paletteFill(ctx, ['#85817b', '#918c85', '#76726d', '#9b968f', '#6c6964'], random)
  for (let i = 0; i < 22; i++) {
    const x = (random() * 15) | 0
    const y = (random() * 15) | 0
    const c = random() > 0.5 ? '#b0aba3' : '#5c5955'
    paint(ctx, x, y, c)
    paint(ctx, x + 1, y, c)
    paint(ctx, x, y + 1, c)
  }
})

const mossyCobble = makeTile((ctx, random) => {
  ctx.drawImage(cobble, 0, 0)
  for (let i = 0; i < 46; i++) {
    const x = (random() * 16) | 0
    const y = (random() * 16) | 0
    paint(ctx, x, y, ['#52733e', '#62834a', '#456535', '#719052'][(random() * 4) | 0])
  }
})

const tallGrass = makeTile((ctx, random) => {
  for (let blade = 0; blade < 9; blade++) {
    const x = 2 + ((random() * 12) | 0)
    const h = 4 + ((random() * 10) | 0)
    const lean = random() > 0.5 ? 1 : -1
    for (let i = 0; i < h; i++) {
      paint(ctx, x + (i > h * 0.55 ? lean : 0), 15 - i, ['#5f9a38', '#73ad45', '#4c822c', '#83ba52'][(random() * 4) | 0])
    }
  }
})

const poppy = makeTile((ctx, random) => {
  for (let i = 0; i < 8; i++) paint(ctx, 8, 15 - i, '#3f7327')
  paint(ctx, 6, 12, '#4b842e')
  paint(ctx, 7, 13, '#4b842e')
  paint(ctx, 4, 9, '#d43b35')
  paint(ctx, 5, 8, '#e54b40')
  paint(ctx, 6, 9, '#c32c2c')
  paint(ctx, 5, 10, '#b92427')
  paint(ctx, 7, 8, '#ee5c4f')
  paint(ctx, 6, 8, '#f0b44b')
  paint(ctx, 6, 9, '#3c2c1d')
  paint(ctx, 3, 8, '#b52c2a')
  paint(ctx, 2, 9, '#8f2323')
})

const dandelion = makeTile((ctx, random) => {
  for (let i = 0; i < 9; i++) paint(ctx, 8, 15 - i, '#457c2a')
  paint(ctx, 9, 11, '#4e892e')
  paint(ctx, 10, 10, '#5c9a36')
  paint(ctx, 7, 7, '#e8c437')
  paint(ctx, 8, 6, '#f5d848')
  paint(ctx, 9, 7, '#d9b32a')
  paint(ctx, 6, 7, '#c9a423')
  paint(ctx, 8, 8, '#f0cb36')
  paint(ctx, 7, 8, '#f5d641')
  paint(ctx, 5, 6, '#e2bc2d')
  paint(ctx, 10, 6, '#c5a020')
})

const TILE_CANVASES = []
TILE_CANVASES[TILE.GRASS_TOP] = grassTop
TILE_CANVASES[TILE.GRASS_SIDE] = grassSide
TILE_CANVASES[TILE.DIRT] = dirt
TILE_CANVASES[TILE.STONE] = stone
TILE_CANVASES[TILE.COBBLE] = cobble
TILE_CANVASES[TILE.SAND] = sand
TILE_CANVASES[TILE.LOG_SIDE] = logSide
TILE_CANVASES[TILE.LOG_TOP] = logTop
TILE_CANVASES[TILE.LEAVES] = leaves
TILE_CANVASES[TILE.PLANKS] = planks
TILE_CANVASES[TILE.BRICK] = brick
TILE_CANVASES[TILE.WATER] = water
TILE_CANVASES[TILE.TALL_GRASS] = tallGrass
TILE_CANVASES[TILE.POPPY] = poppy
TILE_CANVASES[TILE.DANDELION] = dandelion
TILE_CANVASES[TILE.SNOW] = snow
TILE_CANVASES[TILE.GRAVEL] = gravel
TILE_CANVASES[TILE.MOSSY_COBBLE] = mossyCobble

function buildAtlas() {
  const c = document.createElement('canvas')
  c.width = CELL * ATLAS_TILES
  c.height = CELL * ATLAS_TILES
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  for (let i = 0; i < TILE_CANVASES.length; i++) {
    if (!TILE_CANVASES[i]) continue
    const col = i % ATLAS_TILES
    const row = Math.floor(i / ATLAS_TILES)
    ctx.drawImage(TILE_CANVASES[i], col * CELL, row * CELL, CELL, CELL)
  }
  return c
}

export const atlasCanvas = buildAtlas()
export const atlasTexture = new THREE.CanvasTexture(atlasCanvas)
atlasTexture.colorSpace = THREE.SRGBColorSpace
atlasTexture.magFilter = THREE.NearestFilter
atlasTexture.minFilter = THREE.NearestMipmapLinearFilter
atlasTexture.generateMipmaps = true
atlasTexture.wrapS = THREE.ClampToEdgeWrapping
atlasTexture.wrapT = THREE.ClampToEdgeWrapping

const INSET = 0.75 / (CELL * ATLAS_TILES)
const uvCache = new Map()
export function uvRect(tile) {
  if (uvCache.has(tile)) return uvCache.get(tile)
  const col = tile % ATLAS_TILES
  const row = Math.floor(tile / ATLAS_TILES)
  const u0 = (col * CELL) / (CELL * ATLAS_TILES) + INSET
  const u1 = ((col + 1) * CELL) / (CELL * ATLAS_TILES) - INSET
  const vTop = 1 - (row * CELL) / (CELL * ATLAS_TILES) - INSET
  const vBottom = 1 - ((row + 1) * CELL) / (CELL * ATLAS_TILES) + INSET
  const rect = [u0, vBottom, u1, vTop]
  uvCache.set(tile, rect)
  return rect
}

export function makeCrackTextures() {
  const stages = []
  for (let stage = 0; stage < 6; stage++) {
    const c = canvas(16)
    const ctx = c.getContext('2d')
    const random = mulberry32(8923 + stage * 77)
    const lines = 1 + stage * 4
    for (let i = 0; i < lines; i++) {
      let x = (random() * 16) | 0
      let y = (random() * 16) | 0
      const len = 2 + ((random() * (3 + stage * 2)) | 0)
      for (let j = 0; j < len; j++) {
        paint(ctx, x, y, 'rgba(10, 12, 8, 0.78)')
        if (random() > 0.55) x += random() > 0.5 ? 1 : -1
        else y += random() > 0.5 ? 1 : -1
        x = Math.max(0, Math.min(15, x))
        y = Math.max(0, Math.min(15, y))
      }
    }
    const texture = new THREE.CanvasTexture(c)
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.colorSpace = THREE.SRGBColorSpace
    stages.push(texture)
  }
  return stages
}

// Iso cube icon used by the hotbar and inventory panels.
export function drawBlockIcon(target, blockId, size = 48) {
  const block = BLOCKS[blockId]
  if (!block) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  target.width = Math.round(size * dpr)
  target.height = Math.round(size * dpr)
  target.style.width = `${size}px`
  target.style.height = `${size}px`
  const ctx = target.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, size, size)
  const top = TILE_CANVASES[block.tiles.top]
  const side = TILE_CANVASES[block.tiles.side]
  if (!top || !side) return

  const scale = size / 48
  const unit = 48 * scale
  const cx = unit / 2
  const topY = 7 * scale
  const leftX = 7 * scale
  const rightX = 41 * scale
  const shoulderY = 16 * scale
  const middleY = 25 * scale

  function face(originX, originY, ax, ay, bx, by, image, shade) {
    ctx.save()
    ctx.setTransform(
      dpr * (ax / 16), dpr * (ay / 16),
      dpr * (bx / 16), dpr * (by / 16),
      dpr * originX, dpr * originY,
    )
    ctx.drawImage(image, 0, 0)
    ctx.restore()

    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.beginPath()
    ctx.moveTo(originX, originY)
    ctx.lineTo(originX + ax, originY + ay)
    ctx.lineTo(originX + ax + bx, originY + ay + by)
    ctx.lineTo(originX + bx, originY + by)
    ctx.closePath()
    ctx.fillStyle = shade
    ctx.fill()
    ctx.restore()
  }

  const dx = 17 * scale
  const dy = 9 * scale
  const drop = 18 * scale
  face(cx, topY, dx, dy, -dx, dy, top, 'rgba(255,255,255,0.06)')
  face(leftX, shoulderY, dx, dy, 0, drop, side, 'rgba(0,0,0,0.25)')
  face(rightX, shoulderY, -dx, dy, 0, drop, side, 'rgba(0,0,0,0.1)')
  // Soft pixel highlight along the top-left edge.
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = Math.max(1, scale)
  ctx.beginPath()
  ctx.moveTo(cx, topY + 1)
  ctx.lineTo(leftX + 1, shoulderY + 1)
  ctx.lineTo(cx, middleY + 1)
  ctx.stroke()
  ctx.restore()
}
