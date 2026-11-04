// Block ids are stored as bytes inside chunk arrays.
export const BLOCK = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  LOG: 6,
  LEAVES: 7,
  PLANKS: 8,
  BRICK: 9,
  WATER: 10,
  BEDROCK: 11,
  TALL_GRASS: 12,
  POPPY: 13,
  DANDELION: 14,
  SNOW: 15,
  GRAVEL: 16,
  MOSSY_COBBLE: 17,
})

export const TILE = Object.freeze({
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  LOG_SIDE: 6,
  LOG_TOP: 7,
  LEAVES: 8,
  PLANKS: 9,
  BRICK: 10,
  WATER: 11,
  TALL_GRASS: 12,
  POPPY: 13,
  DANDELION: 14,
  SNOW: 15,
  GRAVEL: 16,
  MOSSY_COBBLE: 17,
})

const def = (id, name, top, side = top, bottom = top, extra = {}) => ({
  id,
  name,
  solid: true,
  transparent: false,
  plant: false,
  liquid: false,
  tiles: { top, side, bottom },
  ...extra,
})

export const BLOCKS = []
BLOCKS[BLOCK.AIR] = { id: 0, name: 'Air', solid: false, transparent: true, plant: false, liquid: false }
BLOCKS[BLOCK.GRASS] = def(BLOCK.GRASS, 'Grass Block', TILE.GRASS_TOP, TILE.GRASS_SIDE, TILE.DIRT, { mapColor: '#6b9c3f' })
BLOCKS[BLOCK.DIRT] = def(BLOCK.DIRT, 'Dirt', TILE.DIRT, TILE.DIRT, TILE.DIRT, { mapColor: '#815c3d' })
BLOCKS[BLOCK.STONE] = def(BLOCK.STONE, 'Stone', TILE.STONE, TILE.STONE, TILE.STONE, { mapColor: '#838383' })
BLOCKS[BLOCK.COBBLE] = def(BLOCK.COBBLE, 'Cobblestone', TILE.COBBLE, TILE.COBBLE, TILE.COBBLE, { mapColor: '#737373' })
BLOCKS[BLOCK.SAND] = def(BLOCK.SAND, 'Sand', TILE.SAND, TILE.SAND, TILE.SAND, { mapColor: '#d9cb8b' })
BLOCKS[BLOCK.LOG] = def(BLOCK.LOG, 'Oak Log', TILE.LOG_TOP, TILE.LOG_SIDE, TILE.LOG_TOP, { mapColor: '#755334' })
BLOCKS[BLOCK.LEAVES] = def(BLOCK.LEAVES, 'Oak Leaves', TILE.LEAVES, TILE.LEAVES, TILE.LEAVES, { mapColor: '#406f2e' })
BLOCKS[BLOCK.PLANKS] = def(BLOCK.PLANKS, 'Oak Planks', TILE.PLANKS, TILE.PLANKS, TILE.PLANKS, { mapColor: '#b48a52' })
BLOCKS[BLOCK.BRICK] = def(BLOCK.BRICK, 'Bricks', TILE.BRICK, TILE.BRICK, TILE.BRICK, { mapColor: '#a34d3c' })
BLOCKS[BLOCK.WATER] = { id: BLOCK.WATER, name: 'Water', solid: false, transparent: true, plant: false, liquid: true, tiles: { top: TILE.WATER, side: TILE.WATER, bottom: TILE.WATER }, mapColor: '#3f8bc2' }
BLOCKS[BLOCK.BEDROCK] = def(BLOCK.BEDROCK, 'Bedrock', TILE.STONE, TILE.STONE, TILE.STONE, { mapColor: '#5d5d5d' })
BLOCKS[BLOCK.TALL_GRASS] = { id: BLOCK.TALL_GRASS, name: 'Tall Grass', solid: false, transparent: true, plant: true, liquid: false, tiles: { top: TILE.TALL_GRASS, side: TILE.TALL_GRASS, bottom: TILE.TALL_GRASS }, mapColor: '#5f963c' }
BLOCKS[BLOCK.POPPY] = { id: BLOCK.POPPY, name: 'Poppy', solid: false, transparent: true, plant: true, liquid: false, tiles: { top: TILE.POPPY, side: TILE.POPPY, bottom: TILE.POPPY }, mapColor: '#c73b37' }
BLOCKS[BLOCK.DANDELION] = { id: BLOCK.DANDELION, name: 'Dandelion', solid: false, transparent: true, plant: true, liquid: false, tiles: { top: TILE.DANDELION, side: TILE.DANDELION, bottom: TILE.DANDELION }, mapColor: '#e8c747' }
BLOCKS[BLOCK.SNOW] = def(BLOCK.SNOW, 'Snow', TILE.SNOW, TILE.SNOW, TILE.SNOW, { mapColor: '#eef6fb' })
BLOCKS[BLOCK.GRAVEL] = def(BLOCK.GRAVEL, 'Gravel', TILE.GRAVEL, TILE.GRAVEL, TILE.GRAVEL, { mapColor: '#8c8780' })
BLOCKS[BLOCK.MOSSY_COBBLE] = def(BLOCK.MOSSY_COBBLE, 'Mossy Cobblestone', TILE.MOSSY_COBBLE, TILE.MOSSY_COBBLE, TILE.MOSSY_COBBLE, { mapColor: '#64785a' })

export const HOTBAR = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.COBBLE,
  BLOCK.SAND,
  BLOCK.LOG,
  BLOCK.PLANKS,
  BLOCK.LEAVES,
  BLOCK.BRICK,
]
