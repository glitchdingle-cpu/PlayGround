import './style.css'
import * as THREE from 'three'
import { Game } from './game.js'
import { MenuScene, MenuUI } from './menu.js'
import { getEra, getFaction } from './data.js'

class IronEpochsApp {
  constructor() {
    this.viewport = document.getElementById('viewport')
    this.menuEl = document.getElementById('menu')
    this.gameEl = document.getElementById('game-ui')
    this.loadingEl = document.getElementById('loading')
    this.fatalEl = document.getElementById('fatal')
    this.state = { eraId: 'ww1', mapId: 'flanders', factionId: 'britain' }
    this.game = null
    this.menuScene = null
    this.clock = new THREE.Clock()
    this.lastFrame = 0
    this.frames = 0

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
      this.renderer.shadowMap.enabled = true
      this.renderer.setClearColor(0x0d100c, 1)
      this.renderer.domElement.setAttribute('aria-label', 'Iron Epochs battlefield')
      this.viewport.appendChild(this.renderer.domElement)
    } catch (error) {
      this.showFatal(error)
      return
    }

    this.menuUI = new MenuUI(this.state, {
      onChange: () => this.refreshMenuScene(),
      onStart: () => this.startGame(),
    })
    this.refreshMenuScene()

    this.onResize = () => this.resize()
    window.addEventListener('resize', this.onResize)
    window.visualViewport?.addEventListener('resize', this.onResize)
    window.addEventListener('error', event => this.showFatal(event.error || event.message))
    window.addEventListener('unhandledrejection', event => this.showFatal(event.reason))

    this.animate = this.animate.bind(this)
    requestAnimationFrame(this.animate)

    // Give the menu one complete frame, then drop the loading curtain.
    requestAnimationFrame(() => {
      if (this.menuScene) this.renderer.render(this.menuScene.scene, this.menuScene.camera)
      window.__IRON_EPOCHS_READY__ = true
      setTimeout(() => {
        this.loadingEl?.classList.add('out')
        setTimeout(() => this.loadingEl?.classList.add('hidden'), 700)
      }, 180)
    })
  }

  refreshMenuScene() {
    if (this.game) return
    if (this.menuScene) {
      this.menuScene.dispose()
      this.menuScene = null
    }
    try {
      this.menuScene = new MenuScene(this.renderer, this.state)
      this.menuScene.resize(window.innerWidth, window.innerHeight)
      this.renderer.setClearColor(0x0d100c, 1)
    } catch (error) {
      this.showFatal(error)
    }
  }

  startGame() {
    if (this.game) return
    this.launch({ ...this.state })
  }

  launch(options) {
    const era = getEra(options.eraId)
    if (!era) return this.requestMenu()
    const mapId = era.maps.some(map => map.id === options.mapId) ? options.mapId : era.maps[0].id
    const factionId = era.factions.includes(options.factionId) ? options.factionId : era.factions[0]
    const opts = { eraId: era.id, mapId, factionId }

    if (this.menuScene) {
      this.menuScene.dispose()
      this.menuScene = null
    }
    this.menuEl.classList.add('hidden')
    this.gameEl.classList.remove('hidden')

    try {
      this.game = new Game(this, opts)
      this.game.resize(window.innerWidth, window.innerHeight)
      this.game.ui.hideEnd()
      this.game.ui.closeTable()
      this.game.ui.setPlacement(null)
      this.game.ui.setLock(null)
      this.renderer.setClearColor(0x0d100c, 1)
      document.activeElement instanceof HTMLElement && document.activeElement.blur()
      this.clock.getDelta()
    } catch (error) {
      this.game = null
      this.gameEl.classList.add('hidden')
      this.menuEl.classList.remove('hidden')
      this.refreshMenuScene()
      this.showFatal(error)
    }
  }

  returnToMenu() {
    if (!this.game) return
    const options = { ...this.game.options }
    try {
      this.game.dispose()
    } catch (error) {
      console.error(error)
    }
    this.game = null
    this.state.eraId = options.eraId
    this.state.mapId = options.mapId
    this.state.factionId = options.factionId
    this.gameEl.classList.add('hidden')
    this.menuEl.classList.remove('hidden')
    this.menuUI?.render()
    this.refreshMenuScene()
    this.clock.getDelta()
  }

  // Kept for the menu UI's "return" contract.
  requestMenu() { this.returnToMenu() }

  restartGame(options) {
    const opts = options || this.game?.options || this.state
    const next = { ...opts }
    this.state.eraId = next.eraId
    this.state.mapId = next.mapId
    this.state.factionId = next.factionId
    if (this.game) {
      try {
        this.game.dispose()
      } catch (error) {
        console.error(error)
      }
      this.game = null
    }
    this.launch(next)
  }

  resize() {
    const width = Math.max(1, window.innerWidth)
    const height = Math.max(1, window.innerHeight)
    if (!this.renderer) return
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    this.renderer.setSize(width, height)
    if (this.game) this.game.resize(width, height)
    else this.menuScene?.resize(width, height)
  }

  animate() {
    requestAnimationFrame(this.animate)
    const dt = Math.min(0.05, this.clock.getDelta())
    this.frames++
    if (this.game && !this.game.disposed) {
      this.game.update(dt)
      this.renderer.render(this.game.scene, this.game.camera)
    } else if (this.menuScene) {
      this.menuScene.update(dt)
      this.renderer.render(this.menuScene.scene, this.menuScene.camera)
    }
  }

  showFatal(error) {
    console.error(error)
    if (!this.fatalEl) return
    const message = error?.stack || error?.message || String(error || 'Unknown rendering error')
    this.fatalEl.textContent = `IRON EPOCHS FAILED TO START\n\n${message}\n\nTry reloading the battle.`
    this.fatalEl.classList.remove('hidden')
    this.loadingEl?.classList.add('hidden')
    window.__IRON_EPOCHS_ERROR__ = message
  }
}

const app = new IronEpochsApp()

window.__IRON_EPOCHS__ = {
  app,
  get game() { return app.game },
  get menuScene() { return app.menuScene },
  get state() { return app.state },
  startGame: () => app.startGame(),
  returnToMenu: () => app.returnToMenu(),
}
