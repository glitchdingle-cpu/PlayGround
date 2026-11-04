import { CATEGORY, BUILDING_ORDER, ROSTER_LAYOUT, GAME_RULES } from './data.js'

const ICONS = {
  soldier: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.6"/><path d="M8.2 21v-6.6L6 11l2.6-2.4h6.8L18 11l-2.2 3.4V21"/><path d="M9 14h6"/><path d="M15.5 13.5 20 10"/></svg>`,
  vehicle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15V9h7l3-3h5l3 5v4"/><path d="M3 15h18"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/><path d="M10 9h6"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 14 9l7 3.5v2L14 12l-.7 6 3 2v1.5l-4.3-1-4.3 1V20l3-2-.7-6-7 2.5v-2L10 9l2-6.5Z"/></svg>`,
  tank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="17" height="5" rx="2"/><path d="M3 13h17"/><path d="M8 13V9h6v4"/><path d="M12 9h6l3 2"/><circle cx="7" cy="18.5" r="1.2"/><circle cx="16" cy="18.5" r="1.2"/></svg>`,
  hq: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l7-4v15"/><path d="M10 21V6l8 4v11"/><path d="M14 21v-5h3v5"/><path d="M17 6V2h4v5"/><path d="M3 21h18"/></svg>`,
  barracks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V11l9-6 9 6v10"/><path d="M3 21h18"/><path d="M6 13h12"/><path d="M10 21v-5h4v5"/></svg>`,
  factory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V10l6 3V8l6 4V6h4v15"/><path d="M3 21h18"/><path d="M7 21v-4h3v4"/><path d="M18 6V2"/></svg>`,
  airfield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 19h20"/><path d="M9 19h6"/><path d="M12 4 13.5 9l6 2.5v1.5L13.5 11 13 16l2 1.5v1L12 17.5 9 18.5v-1L11 16l-.5-5-6 2v-1.5L10.5 9 12 4Z"/></svg>`,
  depot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 12 5l9 7"/><path d="M5 11v10h14V11"/><path d="M8 16h8"/><path d="M8 19h8"/><path d="M10 11v5h4v-5"/></svg>`,
  turret: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16"/><path d="M6 18v-4h9l3 2h3"/><path d="M9 14V11h5v3"/><circle cx="9" cy="20" r="1.5"/><path d="M14 9h5"/></svg>`,
  hospital: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V8l8-4 8 4v13"/><path d="M4 21h16"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>`,
}

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s

export class GameUI {
  constructor(game) {
    this.game = game
    this.activeTab = 'build'
    this.lastSignature = ''
    this.lastPanelTick = 0
    this.captureSignature = ''
    this.minimapDrawn = 0
    this.abort = new AbortController()

    const $ = (id) => document.getElementById(id)
    this.$ = $
    this.el = {
      supply: $('res-supply'), income: $('res-income'), pop: $('res-pop'), timer: $('hud-timer'),
      objective: $('objective-text'), enemyPct: $('enemy-hq-pct'),
      factionName: $('hud-faction-name'), mapName: $('hud-map-name'), eraName: $('hud-era-name'),
      eraNumeral: $('hud-era-numeral'), emblem: $('hud-emblem'),
      capture: $('capture-strip'), warTable: $('war-table'), content: $('wt-content'), wtFooter: $('wt-footer'),
      card: $('selection-card'), selIcon: $('sel-icon'), selKicker: $('sel-kicker'), selName: $('sel-name'),
      selRole: $('sel-role'), selHp: $('sel-hp-fill'), selStats: $('sel-stats'), selActions: $('sel-actions'),
      selQueue: $('sel-queue'), notif: $('notif-stack'), ability: $('cmd-artillery'), abilityRing: $('ability-cd'),
      banner: $('placement-banner'), bannerText: $('placement-text'), lock: $('lock-banner'),
      end: $('end-screen'), endKicker: $('end-kicker'), endTitle: $('end-title'), endDesc: $('end-desc'), endStats: $('end-stats'),
      minimap: $('minimap'), tip: $('cursor-tip'), mobileTable: $('mobile-table-toggle'),
    }

    const era = game.era
    const faction = game.playerFaction
    document.body.dataset.era = era.id
    document.documentElement.style.setProperty('--faction', faction.colors.ui || era.accent)
    document.documentElement.style.setProperty('--accent', era.accent)
    document.documentElement.style.setProperty('--player', faction.colors.ui || '#7ad9c5')
    this.el.emblem.textContent = faction.monogram
    this.el.emblem.style.setProperty('--faction', faction.colors.ui || era.accent)
    this.el.factionName.textContent = faction.name.toUpperCase()
    this.el.mapName.textContent = `${game.map.name.toUpperCase()} · ${game.map.region.split(' · ')[1] || era.years}`
    this.el.eraName.textContent = era.name.toUpperCase()
    this.el.eraNumeral.textContent = era.numeral

    this.bind()
    this.initMinimap()
    this.renderPanels(true)
    this.updateSelection()
  }

  bind() {
    const opts = { signal: this.abort.signal }
    document.querySelectorAll('.wt-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.tab
        document.querySelectorAll('.wt-tab').forEach(b => b.classList.toggle('active', b === btn))
        this.renderPanels(true)
        this.game.sfx.click()
      }, opts)
    })
    this.$('wt-close').addEventListener('click', () => this.closeTable(), opts)
    this.el.mobileTable.addEventListener('click', () => {
      this.el.warTable.classList.toggle('open')
      this.game.sfx.click()
    }, opts)
    this.$('sel-close').addEventListener('click', () => this.game.clearSelection(), opts)
    this.$('cmd-stop').addEventListener('click', () => { this.game.stopSelected(); this.game.sfx.order() }, opts)
    this.$('cmd-hold').addEventListener('click', () => { this.game.holdSelected(); this.game.sfx.order() }, opts)
    this.$('cmd-attack').addEventListener('click', () => { this.game.beginAttackMove(); this.game.sfx.click() }, opts)
    this.$('cmd-artillery').addEventListener('click', () => { this.game.beginArtillery(); this.game.sfx.click() }, opts)
    this.$('mobile-ability').addEventListener('click', () => this.game.beginArtillery(), opts)
    this.$('cmd-roster').addEventListener('click', () => { this.setTab('roster'); this.openTable() }, opts)
    this.$('cmd-base').addEventListener('click', () => this.game.focusBase(), opts)
    this.$('minimap-zoom').addEventListener('click', () => this.game.focusBase(), opts)
    this.$('placement-cancel').addEventListener('click', () => this.game.cancelPlacement(), opts)
    this.$('menu-return').addEventListener('click', () => this.game.requestMenu(), opts)
    this.$('end-menu').addEventListener('click', () => this.game.requestMenu(), opts)
    this.$('end-rematch').addEventListener('click', () => this.game.restart(), opts)
    this.el.minimap.addEventListener('pointerdown', (e) => this.minimapPointer(e), opts)
    this.el.minimap.addEventListener('pointermove', (e) => { if (e.buttons) this.minimapPointer(e) }, opts)
    this.el.minimap.addEventListener('contextmenu', e => e.preventDefault(), opts)
  }

  setTab(tab) {
    this.activeTab = tab
    document.querySelectorAll('.wt-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
    this.renderPanels(true)
  }

  openTable() {
    this.el.warTable.classList.add('open')
  }

  closeTable() {
    this.el.warTable.classList.remove('open')
  }

  renderPanels(force = false) {
    const sig = this.panelSignature()
    if (!force && sig === this.lastSignature) return
    this.lastSignature = sig
    if (this.activeTab === 'build') this.renderBuild()
    else if (this.activeTab === 'roster') this.renderRoster()
    else this.renderIntel()
  }

  panelSignature() {
    const g = this.game
    return [
      this.activeTab,
      Math.floor(g.supplies / 25),
      g.playerUnits.length,
      g.playerBuildings.map(b => `${b.def.key}:${b.built ? 1 : 0}:${b.queue.length}`).join(','),
      g.playerBuildings.filter(b => b.built).map(b => b.def.key).sort().join(','),
      g.selection[0]?.def?.key || g.selection[0]?.def?.name || '',
      g.selection.length,
    ].join('|')
  }

  renderBuild() {
    const g = this.game
    const cards = BUILDING_ORDER.map(key => g.buildingsByKey[key]).filter(Boolean)
    const counts = {}
    for (const b of g.playerBuildings) counts[b.def.key] = (counts[b.def.key] || 0) + 1
    let html = `<div class="panel-section-label"><span>CONSTRUCT STRUCTURES</span><b>${fmt(g.supplies)} SUPPLY</b></div>`
    for (const b of cards) {
      const afford = g.supplies >= b.cost
      html += `<button class="build-card ${afford ? '' : 'disabled'}" data-build="${b.key}" type="button" title="${b.desc}">
        <span class="bc-icon">${ICONS[b.icon] || ICONS.hq}</span>
        <span>
          <span class="bc-name">${b.name}</span>
          <span class="bc-desc">${clip(b.desc, 66)}</span>
        </span>
        <span class="bc-cost"><b>${fmt(b.cost)}</b><small>${b.buildTime}s · ${counts[b.key] || 0} BUILT</small></span>
      </button>`
    }
    html += `<div class="panel-section-label" style="margin-top:12px"><span>FIELD NOTES</span><b>CRATERS</b></div>
      <div class="intel-block"><p>Every shell, bomb and barrage deforms the battlefield. Terrain height, cover and routes change permanently. Artillery and bombers carve the deepest craters.</p></div>`
    this.el.content.innerHTML = html
    this.el.wtFooter.textContent = 'Select a structure, then click the battlefield to place it. Engineers repair nearby damage.'
    this.el.content.querySelectorAll('[data-build]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.game.beginPlacement(btn.dataset.build)
        this.closeTable()
        this.game.sfx.click()
      })
    })
  }

  renderRoster() {
    const g = this.game
    const roster = g.playerRoster
    let html = `<div class="panel-section-label"><span>${g.playerFaction.name.toUpperCase()} ORDER OF BATTLE</span><b>${roster.length} TYPES</b></div>`
    for (const group of ROSTER_LAYOUT) {
      const units = roster.filter(u => u.category === group.category)
      const producer = g.productionForCategory(group.category)
      html += `<div class="panel-section-label"><span>${CATEGORY[group.category].plural.toUpperCase()}</span><b>${producer ? producer.def.name.toUpperCase() : 'NO STRUCTURE'}</b></div>`
      for (const unit of units) {
        const queued = g.queuedCount(unit.id)
        const canProduce = Boolean(producer)
        const afford = g.supplies >= unit.cost
        const req = !canProduce ? `Requires ${this.producerName(group.category)}` : (!afford ? 'Insufficient supply' : '')
        html += `<button class="unit-row ${(!canProduce || !afford) ? 'disabled' : ''} ${queued ? 'queueable' : ''}" data-unit="${unit.id}" type="button" title="${unit.desc}">
          <span class="unit-icon">${ICONS[group.icon]}</span>
          <span>
            <span class="ur-name">${unit.name}${queued ? `<span class="queue-badge">${queued}</span>` : ''}</span>
            <span class="ur-meta">${unit.roleLabel} · ${unit.categoryLabel}</span>
            <span class="ur-stats"><span>DMG ${Math.round(unit.damage)}</span><span>RNG ${Math.round(unit.range)}</span><span>SPD ${unit.speed.toFixed(1)}</span></span>
            ${req ? `<span class="req-line">${req}</span>` : ''}
          </span>
          <span class="ur-cost">${fmt(unit.cost)}<small>SUPPLY</small></span>
          <span class="ur-cost">${unit.pop}<small>POP</small></span>
        </button>`
      }
    }
    this.el.content.innerHTML = html
    this.el.wtFooter.textContent = 'Click a unit to queue it at the nearest matching production structure. Build more structures to parallelise production.'
    this.el.content.querySelectorAll('[data-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const unit = roster.find(u => u.id === btn.dataset.unit)
        if (unit) this.game.queueUnit(unit)
      })
    })
  }

  producerName(category) {
    return category === 'soldier' ? 'Barracks' : category === 'plane' ? 'Airfield' : 'Factory'
  }

  renderIntel() {
    const g = this.game
    const era = g.era
    const faction = g.playerFaction
    const enemy = g.enemyFaction
    const caps = g.capturePoints.filter(c => c.owner === 'player').length
    this.el.content.innerHTML = `
      <div class="intel-block">
        <h4>SECTOR BRIEFING</h4>
        <div class="intel-big">${g.map.name}</div>
        <p>${g.map.brief}</p>
        <div class="intel-kv">
          <div><small>REGION</small><b>${g.map.region}</b></div>
          <div><small>WEATHER</small><b>${(g.map.weather || 'clear').toUpperCase()}</b></div>
          <div><small>YOUR FORCE</small><b>${faction.name}</b></div>
          <div><small>OPPOSITION</small><b>${enemy.name}</b></div>
        </div>
      </div>
      <div class="intel-block">
        <h4>DOCTRINE</h4>
        <div class="intel-big">${faction.doctrine}</div>
        <p>${faction.blurb}</p>
      </div>
      <div class="intel-block">
        <h4>BATTLE STATE</h4>
        <div class="intel-kv">
          <div><small>OBJECTIVES HELD</small><b>${caps} / 3</b></div>
          <div><small>UNITS ALIVE</small><b>${g.playerUnits.length}</b></div>
          <div><small>KILLS</small><b>${g.stats.kills}</b></div>
          <div><small>CRATERS MADE</small><b>${g.stats.craters}</b></div>
        </div>
      </div>
      <div class="intel-block">
        <h4>COMMAND REFERENCE</h4>
        <div class="intel-controls">
          <div><span>Pan camera</span><span><kbd>WASD</kbd> / <kbd>↑↓←→</kbd></span></div>
          <div><span>Zoom</span><span><kbd>WHEEL</kbd> / pinch</span></div>
          <div><span>Select</span><span><kbd>LMB</kbd> drag box</span></div>
          <div><span>Move / attack</span><span><kbd>RMB</kbd> / tap</span></div>
          <div><span>Attack-move</span><span><kbd>A</kbd></span></div>
          <div><span>Artillery barrage</span><span><kbd>B</kbd></span></div>
          <div><span>Roster</span><span><kbd>R</kbd></span></div>
          <div><span>Focus base</span><span><kbd>SPACE</kbd></span></div>
          <div><span>Select army</span><span><kbd>CTRL+A</kbd></span></div>
        </div>
      </div>`
    this.el.wtFooter.textContent = `${era.name} · ${g.map.region} · ${faction.doctrine} vs ${enemy.doctrine}`
  }

  update(force = false) {
    const g = this.game
    this.el.supply.textContent = fmt(g.supplies)
    this.el.income.textContent = `+${g.income.toFixed(0)}/s`
    this.el.pop.textContent = `${g.usedPop} / ${g.popCap}`
    const t = Math.floor(g.elapsed)
    this.el.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    const enemyHq = g.enemyBuildings.find(b => b.def.key === 'hq')
    this.el.enemyPct.textContent = enemyHq ? `${Math.ceil((enemyHq.hp / enemyHq.maxHp) * 100)}%` : 'DESTROYED'
    this.el.objective.textContent = enemyHq ? 'DESTROY ENEMY HQ' : 'ENEMY HQ DESTROYED'
    this.updateSelection()
    this.updateCapture()
    this.updateAbility()
    if (force || g.elapsed - this.lastPanelTick > 0.9) {
      this.lastPanelTick = g.elapsed
      this.renderPanels()
    }
    if (g.elapsed - this.minimapDrawn > 0.1) {
      this.minimapDrawn = g.elapsed
      this.drawMinimap()
    }
  }

  updateCapture() {
    const g = this.game
    const sig = g.capturePoints.map(c => `${c.owner}:${Math.round(c.progress * 10)}:${c.contested ? 1 : 0}`).join(',')
    if (sig === this.captureSignature) return
    this.captureSignature = sig
    this.el.capture.innerHTML = g.capturePoints.map((c, i) => {
      const cls = c.contested ? 'contested' : c.owner || ''
      const owner = c.contested ? 'CONTESTED' : c.owner === 'player' ? 'HELD' : c.owner === 'enemy' ? 'ENEMY' : 'NEUTRAL'
      return `<div class="cap-chip ${cls}"><i></i><span>SECTOR ${String.fromCharCode(65 + i)}</span><b>${owner}</b></div>`
    }).join('')
  }

  updateAbility() {
    const g = this.game
    const cd = g.artilleryCooldown
    if (cd > 0) {
      this.el.ability.classList.add('cooling')
      this.el.ability.disabled = true
      const ratio = Math.min(1, cd / GAME_RULES.artilleryCooldown)
      this.el.abilityRing.style.transform = `scaleY(${ratio})`
      this.el.ability.querySelector('small').textContent = `${Math.ceil(cd)}s`
    } else {
      this.el.ability.classList.remove('cooling')
      this.el.ability.disabled = false
      this.el.abilityRing.style.transform = 'scaleY(0)'
      this.el.ability.querySelector('small').textContent = 'BARRAGE'
    }
    if (g.targetingArtillery) this.el.ability.classList.add('active')
    else this.el.ability.classList.remove('active')
  }

  updateSelection() {
    const g = this.game
    const sel = g.selection
    if (!sel.length) {
      this.el.card.classList.add('hidden')
      this.el.selQueue.classList.add('hidden')
      this.el.selQueue.innerHTML = ''
      return
    }
    this.el.card.classList.remove('hidden')
    this.el.selQueue.classList.add('hidden')
    this.el.selQueue.innerHTML = ''
    if (sel.length === 1) {
      const e = sel[0]
      if (e.kind === 'unit') {
        this.el.selKicker.textContent = e.def.categoryLabel.toUpperCase()
        this.el.selName.textContent = e.def.name.toUpperCase()
        this.el.selRole.textContent = `${e.def.roleLabel} · ${e.def.faction.name}`
        this.el.selIcon.innerHTML = ICONS[e.def.category]
        const hp = Math.max(0, e.hp / e.maxHp)
        this.el.selHp.style.transform = `scaleX(${hp})`
        this.el.selHp.style.background = hp > 0.55 ? 'var(--player)' : hp > 0.25 ? 'var(--accent)' : 'var(--enemy)'
        this.el.selStats.innerHTML = [
          ['DMG', Math.round(e.def.damage)], ['RNG', Math.round(e.def.range)], ['SPD', e.def.speed.toFixed(1)], ['HP', `${Math.ceil(e.hp)}`],
        ].map(([k, v]) => `<div class="sel-stat"><small>${k}</small><b>${v}</b></div>`).join('')
        const actions = []
        actions.push(`<button class="sel-action primary" data-sel="focus" type="button">FOCUS</button>`)
        if (e.def.repair) actions.push(`<button class="sel-action" data-sel="repair" type="button">REPAIR</button>`)
        actions.push(`<button class="sel-action" data-sel="stop" type="button">STOP</button>`)
        if (e.def.category === 'plane') actions.push(`<button class="sel-action" data-sel="return" type="button">RETURN</button>`)
        this.el.selActions.innerHTML = actions.join('')
      } else {
        this.el.selKicker.textContent = 'STRUCTURE'
        this.el.selName.textContent = e.def.name.toUpperCase()
        this.el.selRole.textContent = `${e.def.produces.length ? e.def.produces.map(p => CATEGORY[p].plural).join(' + ') : 'Support structure'}${e.built ? '' : ' · CONSTRUCTING'}`
        this.el.selIcon.innerHTML = ICONS[e.def.icon] || ICONS.hq
        const hp = Math.max(0, e.hp / e.maxHp)
        this.el.selHp.style.transform = `scaleX(${hp})`
        this.el.selHp.style.background = hp > 0.55 ? 'var(--player)' : hp > 0.25 ? 'var(--accent)' : 'var(--enemy)'
        this.el.selStats.innerHTML = [
          ['HP', `${Math.ceil(e.hp)}`],
          ['INCOME', e.def.income ? `+${e.def.income}` : '—'],
          ['POP', e.def.popCap ? `+${e.def.popCap}` : '—'],
          ['QUEUE', e.def.produces.length ? `${e.queue.length}/5` : '—'],
        ].map(([k, v]) => `<div class="sel-stat"><small>${k}</small><b>${v}</b></div>`).join('')
        let html = `<button class="sel-action primary" data-sel="focus" type="button">FOCUS</button>`
        if (e.def.produces.length && e.built) html += `<button class="sel-action" data-sel="train" type="button">TRAIN</button>`
        html += `<button class="sel-action" data-sel="rally" type="button">RALLY</button>`
        this.el.selActions.innerHTML = html
        if (e.queue.length) {
          this.el.selQueue.innerHTML = e.queue.map(q => `<div class="queue-item"><span>${q.def.name}</span><span>${Math.round(q.progress * 100)}%</span></div>`).join('')
          this.el.selQueue.classList.remove('hidden')
        } else {
          this.el.selQueue.innerHTML = ''
          this.el.selQueue.classList.add('hidden')
        }
      }
    } else {
      this.el.selQueue.innerHTML = ''
      this.el.selQueue.classList.add('hidden')
      const soldiers = sel.filter(u => u.def.category === 'soldier').length
      const vehicles = sel.filter(u => u.def.category === 'vehicle').length
      const tanks = sel.filter(u => u.def.category === 'tank').length
      const planes = sel.filter(u => u.def.category === 'plane').length
      this.el.selKicker.textContent = 'FORMATION'
      this.el.selName.textContent = `${sel.length} UNITS SELECTED`
      this.el.selRole.textContent = [soldiers && `${soldiers} INF`, vehicles && `${vehicles} VEH`, tanks && `${tanks} ARM`, planes && `${planes} AIR`].filter(Boolean).join(' · ')
      this.el.selIcon.innerHTML = ICONS.tank
      this.el.selHp.style.transform = 'scaleX(1)'
      this.el.selHp.style.background = 'var(--player)'
      this.el.selStats.innerHTML = [
        ['UNITS', sel.length], ['DMG', Math.round(sel.reduce((a, u) => a + u.def.damage, 0))], ['AVG HP', `${Math.round(sel.reduce((a, u) => a + u.hp / u.maxHp, 0) / sel.length * 100)}%`], ['POP', sel.reduce((a, u) => a + u.def.pop, 0)],
      ].map(([k, v]) => `<div class="sel-stat"><small>${k}</small><b>${v}</b></div>`).join('')
      this.el.selActions.innerHTML = `<button class="sel-action primary" data-sel="focus" type="button">FOCUS</button><button class="sel-action" data-sel="stop" type="button">STOP</button><button class="sel-action" data-sel="hold" type="button">HOLD</button>`
    }
    this.el.selActions.querySelectorAll('[data-sel]').forEach(btn => {
      btn.onclick = () => {
        const a = btn.dataset.sel
        if (a === 'focus') this.game.focusSelection()
        else if (a === 'stop') this.game.stopSelected()
        else if (a === 'hold') this.game.holdSelected()
        else if (a === 'repair') this.game.orderRepair()
        else if (a === 'train') { this.setTab('roster'); this.openTable() }
        else if (a === 'rally') { this.game.beginRally() }
        else if (a === 'return') this.game.returnToBase()
        this.game.sfx.click()
      }
    })
  }

  initMinimap() {
    const g = this.game
    const c = document.createElement('canvas')
    c.width = 160
    c.height = 160
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(160, 160)
    const pal = g.map.palette
    const low = this.hex(pal.low), mid = this.hex(pal.mid), high = this.hex(pal.high)
    for (let y = 0; y < 160; y++) {
      for (let x = 0; x < 160; x++) {
        const wx = (x / 159 - 0.5) * 440
        const wz = (y / 159 - 0.5) * 440
        const h = g.terrain.sample(wx, wz)
        const n = Math.max(0, Math.min(1, (h + 8) / 26))
        const col = n < 0.5 ? this.mix(low, mid, n * 2) : this.mix(mid, high, (n - 0.5) * 2)
        const shade = 0.8 + Math.max(0, Math.min(0.35, (g.terrain.sample(wx - 2, wz) - g.terrain.sample(wx + 2, wz)) * 0.08))
        const i = (y * 160 + x) * 4
        img.data[i] = Math.min(255, col[0] * shade)
        img.data[i + 1] = Math.min(255, col[1] * shade)
        img.data[i + 2] = Math.min(255, col[2] * shade)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    this.minimapBG = c
  }

  hex(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255] }
  mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] }

  drawMinimap() {
    const g = this.game
    const cv = this.el.minimap
    const ctx = cv.getContext('2d')
    const w = cv.width, h = cv.height
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.minimapBG, 0, 0, w, h)
    ctx.fillStyle = 'rgba(6,9,6,0.18)'
    ctx.fillRect(0, 0, w, h)
    const map = (x, z) => [((x + 220) / 440) * w, ((z + 220) / 440) * h]
    // capture points
    for (const c of g.capturePoints) {
      const [x, y] = map(c.x, c.z)
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fillStyle = c.owner === 'player' ? 'rgba(121,217,197,0.28)' : c.owner === 'enemy' ? 'rgba(224,112,90,0.28)' : 'rgba(211,183,123,0.22)'
      ctx.fill()
      ctx.strokeStyle = c.owner === 'player' ? '#7ad9c5' : c.owner === 'enemy' ? '#e0705a' : '#d3b77b'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = ctx.strokeStyle
      ctx.fillRect(x - 1, y - 7, 2, 7)
      ctx.fillRect(x, y - 7, 5, 3)
    }
    // buildings
    for (const b of g.buildings) {
      const [x, y] = map(b.x, b.z)
      const size = b.def.key === 'hq' ? 7 : 4
      ctx.fillStyle = b.team === 'player' ? '#7ad9c5' : '#e0705a'
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'
      ctx.lineWidth = 1
      ctx.strokeRect(x - size / 2, y - size / 2, size, size)
    }
    // units
    for (const u of g.units) {
      const [x, y] = map(u.x, u.z)
      ctx.fillStyle = u.team === 'player' ? '#9ff5df' : '#ff8c72'
      const r = u.def.category === 'plane' ? 2 : u.def.category === 'tank' ? 2 : 1.4
      ctx.fillRect(x - r / 2, y - r / 2, r, r)
    }
    // camera frustum marker
    const t = g.cameraTarget
    const [cx, cy] = map(t.x, t.z)
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1
    const rad = 8 + g.cameraDistance * 0.12
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy)
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4)
    ctx.stroke()
    // scan line
    const t2 = (performance.now() * 0.03) % h
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, t2, w, 1)
  }

  minimapPointer(e) {
    const rect = this.el.minimap.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 440 - 220
    const z = ((e.clientY - rect.top) / rect.height) * 440 - 220
    this.game.setCameraTarget(x, z)
  }

  toast(text, type = '') {
    const div = document.createElement('div')
    div.className = `notif ${type}`
    div.textContent = text
    this.el.notif.appendChild(div)
    while (this.el.notif.children.length > 5) this.el.notif.firstChild.remove()
    setTimeout(() => {
      div.classList.add('out')
      setTimeout(() => div.remove(), 400)
    }, 3600)
  }

  setPlacement(text, valid = true) {
    if (!text) {
      this.el.banner.classList.add('hidden')
      return
    }
    this.el.banner.classList.remove('hidden')
    this.el.banner.classList.toggle('invalid', !valid)
    this.el.bannerText.textContent = text
  }

  setLock(text) {
    if (!text) this.el.lock.classList.add('hidden')
    else { this.el.lock.classList.remove('hidden'); this.el.lock.textContent = text }
  }

  showEnd(victory, stats) {
    this.el.end.classList.remove('hidden')
    this.el.end.classList.toggle('lose', !victory)
    this.el.endKicker.textContent = victory ? 'OPERATION COMPLETE · SECTOR SECURED' : 'OPERATION FAILED · HQ LOST'
    this.el.endTitle.textContent = victory ? 'VICTORY' : 'DEFEAT'
    this.el.endDesc.textContent = victory
      ? `The enemy headquarters is rubble. ${this.game.enemyFaction.name} forces are in retreat, and the ${this.game.map.name} sector is yours.`
      : `Your headquarters has fallen. Regroup, rebuild the production chain, and deny the enemy armour before it reaches your base.`
    this.el.endStats.innerHTML = [
      ['KILLS', stats.kills], ['UNITS BUILT', stats.built], ['CRATERS', stats.craters],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')
    this.el.end.classList.remove('hidden')
  }

  hideEnd() { this.el.end.classList.add('hidden') }
}
