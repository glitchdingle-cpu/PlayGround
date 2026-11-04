import * as THREE from 'three'
import { BASE_POSITIONS, buildingsFor, GAME_RULES, getEra, getFaction, rivalOf, rosterFor } from './data.js'
import { Terrain } from './terrain.js'
import { GameUI } from './ui.js'
import { sfx } from './sfx.js'
import { Particles, Weather } from './particles.js'
import { installCore } from './game-core.js'
import { installCombat } from './game-combat.js'
import { installActions } from './game-actions.js'
import { installInput } from './game-input.js'

export class Game {
  constructor(app, options) {
    this.app = app
    this.renderer = app.renderer
    this.options = { ...options }
    this.sfx = sfx
    this.era = getEra(options.eraId)
    this.map = this.era.maps.find(m => m.id === options.mapId) || this.era.maps[0]
    this.playerFaction = getFaction(options.factionId)
    this.enemyFaction = rivalOf(this.playerFaction)
    this.playerRoster = rosterFor(this.playerFaction)
    this.enemyRoster = rosterFor(this.enemyFaction)
    this.buildingsByKey = Object.fromEntries(buildingsFor(this.era.id).map(b => [b.key, b]))

    this.scene = new THREE.Scene()
    this.scene.name = 'Iron Epochs battle'
    this.terrain = new Terrain(this.map, this.scene)
    this.terrain.onDeform = (x, z, r) => this.onTerrainDeform(x, z, r)

    this.camera = new THREE.PerspectiveCamera(46, 1.6, 0.4, 1500)
    this.raycaster = new THREE.Raycaster()
    this.cameraTarget = new THREE.Vector3()
    this.cameraGoal = new THREE.Vector3()
    this.cameraDistance = 108
    this.cameraZoomGoal = 108
    this.pitch = 0.9
    this.yaw = -0.72
    this.shake = 0
    this.viewW = 1440
    this.viewH = 900

    this.units = []
    this.buildings = []
    this.projectiles = []
    this.effects = []
    this.wrecks = []
    this.strikes = []
    this.capturePoints = []
    this.selection = []
    this.particles = new Particles(this.scene, 1900, false)
    this.sparks = new Particles(this.scene, 1100, true)
    this.weather = new Weather(this.scene, this.map)

    this.supplies = GAME_RULES.startSupply
    this.enemySupplies = 1350
    this.income = GAME_RULES.baseIncome
    this.enemyIncome = GAME_RULES.baseIncome
    this.popCap = GAME_RULES.startPopCap
    this.usedPop = 0
    this.queuedPop = 0
    this.elapsed = 0
    this.gameOver = false
    this.endTimer = 0
    this.endShown = false
    this.stats = { kills: 0, built: 0, craters: 0 }
    this.artilleryCooldown = 0
    this.targetingArtillery = false
    this.artilleryPreview = null
    this.mode = null
    this.placement = null
    this.ghost = null
    this.keys = new Set()
    this.pointers = new Map()
    this.drag = null
    this.panDrag = null
    this.pinch = null
    this.hoverEntity = null
    this.hoverAt = 0
    this.mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0 }
    this.econTick = 0
    this.ai = { think: 0, attack: 40, build: 14, guard: 0 }
    this.baseAlert = 0
    this.lastBaseAlert = -30
    this.lastMoveMark = 0
    this.spatialGrid = new Map()
    this.gridTick = 0
    this.overlayTick = 0
    this.overlayFps = 0

    this.playerBase = BASE_POSITIONS[0]
    this.enemyBase = BASE_POSITIONS[1]

    this.setupLights()
    this.setupCamera()
    this.createCapturePoints()
    this.setupBases()
    this.ui = new GameUI(this)
    this.bindEvents()
    this.updateCamera(0, true)
    this.ui.update(true)
    this.ui.toast('COMMAND LINK ESTABLISHED · BUILD YOUR FORCE', 'good')
  }

  get playerUnits() { return this.units.filter(u => u.team === 'player' && !u.dead) }
  get enemyUnits() { return this.units.filter(u => u.team === 'enemy' && !u.dead) }
  get playerBuildings() { return this.buildings.filter(b => b.team === 'player' && !b.dead) }
  get enemyBuildings() { return this.buildings.filter(b => b.team === 'enemy' && !b.dead) }
  get selectedPlayerUnits() { return this.selection.filter(e => e.kind === 'unit' && e.team === 'player' && !e.dead) }
  get selectedOwn() { return this.selection.filter(e => e.team === 'player' && !e.dead) }

  findBuilding(team, key) {
    return this.buildings.find(b => !b.dead && b.team === team && b.def.key === key)
  }
}

installCore(Game.prototype)
installCombat(Game.prototype)
installActions(Game.prototype)
installInput(Game.prototype)
