import * as THREE from 'three'
import { HALF } from './terrain.js'
import { clamp } from './util.js'

const _project = new THREE.Vector3()
const _right = new THREE.Vector3()
const _forward = new THREE.Vector3()

export function installInput(proto) {
  Object.assign(proto, {
    bindEvents() {
      this.abort = new AbortController()
      const signal = this.abort.signal
      const canvas = this.renderer.domElement
      this.canvasEl = canvas
      this.selectBoxEl = document.getElementById('select-box')
      this.tipEl = document.getElementById('cursor-tip')
      this.pointerState = new Map()
      this.pinch = null
      this.suppressTapUntil = 0
      this.hoverClock = 0

      canvas.addEventListener('pointerdown', event => this.onPointerDown(event), { signal })
      window.addEventListener('pointermove', event => this.onPointerMove(event), { signal, passive: true })
      window.addEventListener('pointerup', event => this.onPointerUp(event), { signal })
      window.addEventListener('pointercancel', event => this.onPointerUp(event), { signal })
      canvas.addEventListener('wheel', event => this.onWheel(event), { signal, passive: false })
      canvas.addEventListener('contextmenu', event => event.preventDefault(), { signal })
      window.addEventListener('keydown', event => this.onKeyDown(event), { signal })
      window.addEventListener('keyup', event => this.onKeyUp(event), { signal })
      window.addEventListener('blur', () => this.keys.clear(), { signal })
    },

    // ── pointer helpers ───────────────────────────────────────────────────
    setPointer(event) {
      const canvas = this.canvasEl
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      this.mouse.x = event.clientX - rect.left
      this.mouse.y = event.clientY - rect.top
      this.mouse.ndcX = (this.mouse.x / Math.max(1, rect.width)) * 2 - 1
      this.mouse.ndcY = -(this.mouse.y / Math.max(1, rect.height)) * 2 + 1
    },

    terrainPoint() {
      this.raycaster.setFromCamera({ x: this.mouse.ndcX, y: this.mouse.ndcY }, this.camera)
      if (this.terrain.mesh) {
        const hits = this.raycaster.intersectObject(this.terrain.mesh, false)
        if (hits.length) {
          return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z }
        }
      }
      const origin = this.raycaster.ray.origin
      const direction = this.raycaster.ray.direction
      if (Math.abs(direction.y) < 0.0001) return null
      const t = -origin.y / direction.y
      if (t <= 0) return null
      const x = origin.x + direction.x * t
      const z = origin.z + direction.z * t
      if (Math.abs(x) > HALF || Math.abs(z) > HALF) return null
      return { x, y: this.terrain.sample(x, z), z }
    },

    pickEntity() {
      if (!Number.isFinite(this.mouse.ndcX)) return null
      this.raycaster.setFromCamera({ x: this.mouse.ndcX, y: this.mouse.ndcY }, this.camera)
      const targets = []
      for (const unit of this.units) if (!unit.dead) targets.push(unit.model)
      for (const building of this.buildings) if (!building.dead && building.built) targets.push(building.model)
      const hits = this.raycaster.intersectObjects(targets, true)
      for (const hit of hits) {
        let object = hit.object
        while (object && !object.userData?.entity) object = object.parent
        if (object?.userData?.entity && !object.userData.entity.dead) return object.userData.entity
      }
      return null
    },

    // ── pointer lifecycle ────────────────────────────────────────────────
    onPointerDown(event) {
      if (this.gameOver) {
        if (event.button === 0) this.setPointer(event)
        return
      }
      this.setPointer(event)
      this.pointerState.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType })

      if (event.pointerType === 'touch') {
        if (this.pointerState.size === 2) {
          this.beginPinch()
          this.touchTap = null
          this.panDrag = null
          return
        }
        if (this.pointerState.size > 2) return
        this.touchTap = { x: event.clientX, y: event.clientY, time: performance.now(), moved: false }
        return
      }

      if (event.button === 2) {
        if (this.mode) {
          this.cancelModes()
          return
        }
        const point = this.terrainPoint()
        if (!point) return
        this.issueOrder(point, { target: this.pickEntity() })
        return
      }
      if (event.button === 1) {
        this.panDrag = { x: event.clientX, y: event.clientY }
        event.preventDefault()
        return
      }
      if (event.button !== 0) return
      if (this.handleModeClick()) return
      this.drag = {
        x0: event.clientX,
        y0: event.clientY,
        x1: event.clientX,
        y1: event.clientY,
        moved: false,
        additive: event.shiftKey,
      }
    },

    onPointerMove(event) {
      this.setPointer(event)
      if (this.pointerState.has(event.pointerId)) {
        this.pointerState.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType })
      }
      if (this.touchTap && event.pointerType === 'touch' && this.pointerState.size === 1 && !this.mode) {
        const distance = Math.hypot(event.clientX - this.touchTap.x, event.clientY - this.touchTap.y)
        if (distance > 10 && !this.panDrag) {
          this.panDrag = { x: event.clientX, y: event.clientY }
          this.touchTap.moved = true
        }
      }
      if (this.pinch) {
        this.updatePinch()
        return
      }
      if (this.panDrag) {
        this.panByScreen(event.clientX - this.panDrag.x, event.clientY - this.panDrag.y)
        this.panDrag.x = event.clientX
        this.panDrag.y = event.clientY
      } else if (this.drag) {
        this.drag.x1 = event.clientX
        this.drag.y1 = event.clientY
        if (Math.hypot(this.drag.x1 - this.drag.x0, this.drag.y1 - this.drag.y0) > 5) this.drag.moved = true
        this.drawSelectBox()
      }
      if (this.mode === 'placement') this.updateGhostVisual()
      else if (this.mode === 'artillery') this.updateArtilleryPreview()
      this.updateHover()
    },

    onPointerUp(event) {
      this.setPointer(event)
      const wasTouch = event.pointerType === 'touch'
      this.pointerState.delete(event.pointerId)

      if (this.pinch) {
        if (this.pointerState.size < 2) {
          this.pinch = null
          this.suppressTapUntil = performance.now() + 280
        }
        this.panDrag = null
        return
      }
      if (wasTouch && this.touchTap && this.pointerState.size === 0) {
        const tap = this.touchTap
        this.touchTap = null
        const moved = tap.moved || Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 10
        if (!moved && performance.now() > this.suppressTapUntil) this.handleTouchTap(event)
        this.panDrag = null
        return
      }
      if (this.drag) {
        const drag = this.drag
        this.drag = null
        if (this.selectBoxEl) this.selectBoxEl.classList.add('hidden')
        if (drag.moved) this.boxSelect(drag)
        else this.clickSelect(drag.additive)
      }
      this.panDrag = null
    },

    handleModeClick() {
      if (!this.mode) return false
      if (this.mode === 'placement') {
        this.placeBuilding()
        return true
      }
      const point = this.terrainPoint()
      if (this.mode === 'artillery') {
        if (point) this.callArtillery(point.x, point.z)
        return true
      }
      if (this.mode === 'attackMove') {
        if (point) {
          this.issueOrder(point, { attackMove: true })
          this.cancelModes()
        }
        return true
      }
      if (this.mode === 'rally') {
        if (point) {
          this.setRally(point.x, point.z)
          this.cancelModes()
        }
        return true
      }
      return false
    },

    handleTouchTap(event) {
      this.setPointer(event)
      if (this.handleModeClick()) return
      const hit = this.pickEntity()
      if (hit && hit.team === 'enemy' && this.selectedPlayerUnits.length) {
        const point = this.terrainPoint()
        if (point) this.issueOrder(point, { target: hit })
        return
      }
      if (hit) {
        this.clickSelect(false, hit)
        return
      }
      if (this.selectedPlayerUnits.length) {
        const point = this.terrainPoint()
        if (point) this.issueOrder(point, {})
      } else {
        this.clearSelection()
      }
    },

    // ── pinch & wheel ────────────────────────────────────────────────────
    beginPinch() {
      const points = [...this.pointerState.values()]
      if (points.length < 2) return
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      this.pinch = { distance: Math.max(12, distance), zoom: this.cameraZoomGoal }
      this.drag = null
      if (this.selectBoxEl) this.selectBoxEl.classList.add('hidden')
    },

    updatePinch() {
      if (!this.pinch) return
      const points = [...this.pointerState.values()]
      if (points.length < 2) return
      const distance = Math.max(12, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y))
      const ratio = this.pinch.distance / distance
      this.cameraZoomGoal = clamp(this.pinch.zoom * ratio, 44, 230)
    },

    onWheel(event) {
      event.preventDefault()
      const factor = Math.exp(event.deltaY * 0.00115)
      this.cameraZoomGoal = clamp(this.cameraZoomGoal * factor, 44, 230)
    },

    // ── selection ────────────────────────────────────────────────────────
    clearSelection() {
      for (const entity of this.selection) entity.setSelected?.(false)
      this.selection = []
      this.ui?.updateSelection()
    },

    clickSelect(additive = false, hit = this.pickEntity()) {
      const now = performance.now()
      const isDouble = hit && this.lastClick && now - this.lastClick.time < 330 && this.lastClick.entity === hit
      this.lastClick = { time: now, entity: hit }
      if (isDouble) {
        this.selectSimilar(hit)
        return
      }
      if (!hit) {
        if (!additive) this.clearSelection()
        return
      }
      if (!additive) this.clearSelection()
      const index = this.selection.indexOf(hit)
      if (additive && index >= 0) {
        hit.setSelected(false)
        this.selection.splice(index, 1)
      } else if (index < 0) {
        hit.setSelected(true)
        this.selection.push(hit)
      }
      this.sfx.select()
      this.ui?.updateSelection()
    },

    selectSimilar(hit) {
      this.clearSelection()
      if (hit.kind === 'unit') {
        for (const unit of this.units) {
          if (unit.dead || unit.team !== hit.team || unit.def.key !== hit.def.key) continue
          unit.setSelected(true)
          this.selection.push(unit)
        }
      } else {
        for (const building of this.buildings) {
          if (building.dead || building.team !== hit.team || building.def.key !== hit.def.key) continue
          building.setSelected(true)
          this.selection.push(building)
        }
      }
      this.sfx.select()
      this.ui?.updateSelection()
    },

    drawSelectBox() {
      const box = this.selectBoxEl
      if (!box || !this.drag) return
      const x = Math.min(this.drag.x0, this.drag.x1)
      const y = Math.min(this.drag.y0, this.drag.y1)
      const w = Math.abs(this.drag.x1 - this.drag.x0)
      const h = Math.abs(this.drag.y1 - this.drag.y0)
      box.classList.toggle('hidden', !this.drag.moved)
      box.style.left = `${x}px`
      box.style.top = `${y}px`
      box.style.width = `${w}px`
      box.style.height = `${h}px`
    },

    boxSelect(drag) {
      if (!drag.additive) this.clearSelection()
      const rect = this.canvasEl.getBoundingClientRect()
      const minX = Math.min(drag.x0, drag.x1)
      const maxX = Math.max(drag.x0, drag.x1)
      const minY = Math.min(drag.y0, drag.y1)
      const maxY = Math.max(drag.y0, drag.y1)
      for (const unit of this.playerUnits) {
        _project.set(unit.x, unit.model.position.y + 1.2, unit.z).project(this.camera)
        if (_project.z < -1 || _project.z > 1) continue
        const sx = rect.left + (_project.x * 0.5 + 0.5) * rect.width
        const sy = rect.top + (-_project.y * 0.5 + 0.5) * rect.height
        if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue
        if (!this.selection.includes(unit)) {
          unit.setSelected(true)
          this.selection.push(unit)
        }
      }
      if (this.selection.length) this.sfx.select()
      this.ui?.updateSelection()
    },

    // ── orders ───────────────────────────────────────────────────────────
    issueOrder(point, { target = null, attackMove = false } = {}) {
      const units = this.selectedPlayerUnits
      if (!units.length || !point) return

      if (target && !target.dead && target.team !== 'player') {
        let attacked = false
        for (const unit of units) {
          if (unit.canAttack(target)) {
            unit.attack(target)
            attacked = true
          } else {
            const offset = (Math.random() - 0.5) * 7
            unit.moveTo(target.x + offset, target.z + offset, true)
          }
        }
        this.orderMarker(target.x, target.z, attacked ? '#e0705a' : '#d3b77b', 2.6)
        this.sfx.order()
        return
      }

      if (target && target.team === 'player' && target.hp < target.maxHp - 1) {
        const engineers = units.filter(unit => unit.def.repair)
        if (engineers.length) {
          for (const engineer of engineers) engineer.repair(target)
          this.orderMarker(target.x, target.z, '#8fd3a6', 2.4)
          this.sfx.order()
          return
        }
      }

      const columns = Math.ceil(Math.sqrt(units.length))
      const rows = Math.ceil(units.length / columns)
      const spacing = 3.4
      units.forEach((unit, index) => {
        const ox = ((index % columns) - (columns - 1) / 2) * spacing
        const oz = (Math.floor(index / columns) - (rows - 1) / 2) * spacing
        const x = clamp(point.x + ox, -HALF + 12, HALF - 12)
        const z = clamp(point.z + oz, -HALF + 12, HALF - 12)
        unit.moveTo(x, z, attackMove)
      })
      this.orderMarker(point.x, point.z, attackMove ? '#d3b77b' : '#7ad9c5')
      this.sfx.order()
    },

    // ── hover tooltip ────────────────────────────────────────────────────
    updateHover() {
      const now = performance.now()
      if (now - this.hoverClock < 120) return
      this.hoverClock = now
      const hit = this.pickEntity()
      this.hoverEntity = hit
      if (!this.tipEl) return
      if (!hit) {
        this.tipEl.classList.add('hidden')
        return
      }
      const hp = Math.max(0, Math.ceil((hit.hp / hit.maxHp) * 100))
      const label = hit.team === 'player' ? 'FRIENDLY' : 'HOSTILE'
      this.tipEl.textContent = `${hit.def.name.toUpperCase()} · ${label} · ${hp}%`
      this.tipEl.classList.remove('hidden')
      this.tipEl.style.left = `${this.mouse.x + 18}px`
      this.tipEl.style.top = `${this.mouse.y + 16}px`
    },

    // ── keyboard ─────────────────────────────────────────────────────────
    onKeyDown(event) {
      const key = event.key.toLowerCase()
      const panKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'd', 'q', 'e']
      if (panKeys.includes(key) || key === ' ') event.preventDefault()
      if (event.repeat) {
        if (panKeys.includes(key)) this.keys.add(key)
        return
      }
      if (event.ctrlKey && key === 'a') {
        event.preventDefault()
        this.selectAllArmy()
        return
      }
      if (panKeys.includes(key)) {
        this.keys.add(key)
        return
      }
      switch (key) {
        case 'a':
          this.beginAttackMove()
          break
        case 's':
          this.stopSelected()
          this.sfx.order()
          break
        case 'h':
          this.holdSelected()
          this.sfx.order()
          break
        case 'b':
          this.beginArtillery()
          break
        case 'r':
          this.ui?.setTab('roster')
          this.ui?.openTable()
          break
        case 'escape':
          if (this.mode) this.cancelModes()
          else this.clearSelection()
          break
        case ' ':
          this.focusBase()
          break
        case 'f':
          this.focusSelection()
          break
        case '+':
        case '=':
          this.cameraZoomGoal = clamp(this.cameraZoomGoal * 0.86, 44, 230)
          break
        case '-':
        case '_':
          this.cameraZoomGoal = clamp(this.cameraZoomGoal * 1.16, 44, 230)
          break
        default:
          break
      }
    },

    onKeyUp(event) {
      this.keys.delete(event.key.toLowerCase())
    },

    // ── camera ───────────────────────────────────────────────────────────
    panByScreen(dx, dy) {
      const worldPerPixel = (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.cameraDistance) / Math.max(1, this.viewH)
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      this.cameraGoal.addScaledVector(_right, -dx * worldPerPixel)
      this.cameraGoal.addScaledVector(_forward, dy * worldPerPixel)
      this.cameraGoal.x = clamp(this.cameraGoal.x, -HALF + 18, HALF - 18)
      this.cameraGoal.z = clamp(this.cameraGoal.z, -HALF + 18, HALF - 18)
    },

    updateCamera(dt, immediate = false) {
      const keys = this.keys
      const rotationSpeed = 1.15
      if (keys.has('q')) this.yaw -= rotationSpeed * dt
      if (keys.has('e')) this.yaw += rotationSpeed * dt

      let moveX = 0
      let moveZ = 0
      if (keys.has('arrowup') || keys.has('w')) {
        moveX -= Math.sin(this.yaw)
        moveZ -= Math.cos(this.yaw)
      }
      if (keys.has('arrowdown')) {
        moveX += Math.sin(this.yaw)
        moveZ += Math.cos(this.yaw)
      }
      if (keys.has('arrowright') || keys.has('d')) {
        moveX += Math.cos(this.yaw)
        moveZ -= Math.sin(this.yaw)
      }
      if (keys.has('arrowleft')) {
        moveX -= Math.cos(this.yaw)
        moveZ += Math.sin(this.yaw)
      }
      const magnitude = Math.hypot(moveX, moveZ)
      if (magnitude > 0 && dt > 0) {
        const speed = 62 * clamp(this.cameraDistance / 110, 0.55, 1.6)
        this.cameraGoal.x += (moveX / magnitude) * speed * dt
        this.cameraGoal.z += (moveZ / magnitude) * speed * dt
        this.cameraGoal.x = clamp(this.cameraGoal.x, -HALF + 18, HALF - 18)
        this.cameraGoal.z = clamp(this.cameraGoal.z, -HALF + 18, HALF - 18)
      }

      const targetLerp = immediate ? 1 : 1 - Math.exp(-dt * 6.5)
      const zoomLerp = immediate ? 1 : 1 - Math.exp(-dt * 7.5)
      this.cameraDistance += (this.cameraZoomGoal - this.cameraDistance) * zoomLerp
      this.cameraTarget.x += (this.cameraGoal.x - this.cameraTarget.x) * targetLerp
      this.cameraTarget.z += (this.cameraGoal.z - this.cameraTarget.z) * targetLerp
      const ground = this.terrain.sample(this.cameraTarget.x, this.cameraTarget.z) + 2
      this.cameraTarget.y += (ground - this.cameraTarget.y) * (immediate ? 1 : Math.min(1, dt * 7))

      const cosPitch = Math.cos(this.pitch)
      const sinPitch = Math.sin(this.pitch)
      const distance = this.cameraDistance
      this.camera.position.set(
        this.cameraTarget.x + Math.sin(this.yaw) * cosPitch * distance,
        this.cameraTarget.y + sinPitch * distance,
        this.cameraTarget.z + Math.cos(this.yaw) * cosPitch * distance,
      )
      if (this.shake > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.shake * 2
        this.camera.position.y += (Math.random() - 0.5) * this.shake * 1.2
        this.camera.position.z += (Math.random() - 0.5) * this.shake * 2
        this.shake = Math.max(0, this.shake - dt * 3.4)
      }
      const cameraGround = this.terrain.sample(this.camera.position.x, this.camera.position.z) + 4
      if (this.camera.position.y < cameraGround) this.camera.position.y = cameraGround
      this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z)

      if (this.sun && this.sunTarget) {
        this.sun.position.set(this.cameraTarget.x - 95, this.cameraTarget.y + 150, this.cameraTarget.z + 70)
        this.sunTarget.position.set(this.cameraTarget.x, this.cameraTarget.y - 2, this.cameraTarget.z)
      }
    },
  })
}
