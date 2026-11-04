import {
  WORLD, FACTIONS, FACTION_ORDER, SECTORS, UNIT_TYPES, UNIT_ORDER,
  STARTING_POSITIONS, getUnitDef
} from './data.js';
import { clamp, distanceToSegment } from './world.js';

let UNIT_ID = 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);
const pick = array => array[Math.floor(Math.random() * array.length)];

class MinHeap {
  constructor() {
    this.items = [];
    this.priorities = [];
  }
  push(item, priority) {
    this.items.push(item);
    this.priorities.push(priority);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[index]) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      [this.priorities[parent], this.priorities[index]] = [this.priorities[index], this.priorities[parent]];
      index = parent;
    }
  }
  pop() {
    const top = this.items[0];
    const lastItem = this.items.pop();
    const lastPriority = this.priorities.pop();
    if (this.items.length) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.priorities[left] < this.priorities[smallest]) smallest = left;
        if (right < this.items.length && this.priorities[right] < this.priorities[smallest]) smallest = right;
        if (smallest === index) break;
        [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
        [this.priorities[smallest], this.priorities[index]] = [this.priorities[index], this.priorities[smallest]];
        index = smallest;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

export class Game {
  constructor(world) {
    this.world = world;
    this.time = 0;
    this.running = false;
    this.paused = false;
    this.over = false;
    this.winner = null;
    this.finishReason = '';
    this.activeId = 'germany';
    this.units = [];
    this.unitMap = new Map();
    this.projectiles = [];
    this.particles = [];
    this.tracers = [];
    this.scorches = [];
    this.strikes = [];
    this.sectors = SECTORS.map(sector => ({
      ...sector,
      owner: sector.owner,
      originalOwner: sector.owner,
      progress: 0,
      captureTeam: null,
      contested: false,
      underAttack: false,
      pulse: 0,
      captureSpeed: 0,
      lastOwnerChange: -100
    }));
    this.sectorMap = new Map(this.sectors.map(sector => [sector.id, sector]));
    this.teams = {};
    FACTION_ORDER.forEach((id, index) => {
      const faction = FACTIONS[id];
      this.teams[id] = {
        id,
        name: faction.name,
        resources: 260,
        alive: true,
        kills: 0,
        losses: 0,
        sectors: 3,
        barracksLevel: 1,
        barrageReady: 12 + index * 8,
        spawnSectorId: null,
        ai: {
          nextThink: 11 + index * 0.8,
          lastRecruit: 0,
          nextBarrageCheck: 24 + index * 5,
          targetIndex: 0
        }
      };
    });
    this.selected = new Set();
    this.selectedSectorId = null;
    this.hoverUnitId = null;
    this.hoverSectorId = null;
    this.targeting = null;
    this.armistice = null;
    this.lastVictoryCheck = 0;
    this.lastNotice = 0;
    this.notifications = [];
    this.log = [];
    this.shake = 0;
    this.flash = 0;
    this.weather = { rain: 0.42, fog: 0.12, front: 0.5 };
    this.weatherTimer = 36;
    this.camera = { x: 1370, y: 630, zoom: 0.88 };
    this.cameraTarget = null;
    this.viewport = { width: 1440, height: 900 };
    this.stats = { shots: 0, shells: 0, captures: 0, casualties: 0 };
    this.selectionRingPulse = 0;

    this.spawnStartingArmies();
    this.refreshSectorCounts();
    this.setSpawnDefaults();
    this.logEvent('The armies of five empires cross the frontier.', null, 'system');
  }

  spawnStartingArmies() {
    FACTION_ORDER.forEach(teamId => {
      const positions = STARTING_POSITIONS[teamId];
      positions.forEach((entry, index) => {
        const unit = this.createUnit(teamId, entry.type, entry.x + rand(-8, 8), entry.y + rand(-8, 8), index);
        this.units.push(unit);
        this.unitMap.set(unit.id, unit);
      });
      const capital = SECTORS.find(sector => sector.id === FACTIONS[teamId].capital);
      if (capital) {
        const guardA = this.createUnit(teamId, 'rifle', capital.x + rand(-58, 58), capital.y + rand(-48, 48), 0);
        const guardB = this.createUnit(teamId, 'mg', capital.x + rand(-58, 58), capital.y + rand(-48, 48), 1);
        guardA.garrison = true;
        guardB.garrison = true;
        this.units.push(guardA, guardB);
        this.unitMap.set(guardA.id, guardA);
        this.unitMap.set(guardB.id, guardB);
      }
    });
  }

  createUnit(teamId, rosterType, x, y, index = 0) {
    const def = getUnitDef(teamId, rosterType, rosterType);
    return {
      id: UNIT_ID++,
      teamId,
      typeKey: rosterType,
      def,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      facing: rand(-Math.PI, Math.PI),
      cooldown: rand(0.1, 0.9),
      targetId: null,
      order: { type: 'idle', x, y, auto: false },
      path: [],
      pathIndex: 0,
      repathTimer: 0,
      suppress: 0,
      entrench: 0,
      digTimer: 0,
      muzzle: 0,
      coverTrench: false,
      coverTimer: rand(0, 0.7),
      moving: false,
      dead: false,
      spawnIndex: index,
      guardX: x,
      guardY: y,
      aiTargetSectorId: null,
      aiRetargetAt: 0,
      arriveAt: 0,
      bob: rand(0, Math.PI * 2),
      lastHit: -10,
      underFire: false,
      damageFlash: 0,
      garrison: false
    };
  }

  start(teamId = this.activeId) {
    this.running = true;
    this.activeId = teamId;
    const faction = FACTIONS[teamId];
    const focal = this.sectorMap.get(this.teams[teamId].spawnSectorId) || this.sectorMap.get(faction.capital);
    this.camera.x = focal.x;
    this.camera.y = focal.y + 30;
    this.camera.zoom = this.viewport.width < 700 ? 0.92 : 1.02;
    this.setSpawnDefaults();
    this.clearSelection();
    const musteringPoint = this.sectorMap.get(this.teams[teamId].spawnSectorId);
    const vanguard = this.units
      .filter(unit => unit.teamId === teamId && !unit.garrison)
      .sort((a, b) => Math.hypot(a.x - musteringPoint.x, a.y - musteringPoint.y) - Math.hypot(b.x - musteringPoint.x, b.y - musteringPoint.y))
      .slice(0, 3);
    if (vanguard.length) this.selectUnits(vanguard, false, true);
    this.logEvent(`You assume command of the ${faction.name}.`, teamId, 'command');
    this.notify(`COMMAND ASSUMED`, faction.name, faction.color);
    this.time = 0;
  }

  get activeFaction() {
    return FACTIONS[this.activeId];
  }

  get activeTeam() {
    return this.teams[this.activeId];
  }

  get selectedUnits() {
    return [...this.selected].map(id => this.unitMap.get(id)).filter(unit => unit && !unit.dead);
  }

  get selectedSector() {
    return this.selectedSectorId ? this.sectorMap.get(this.selectedSectorId) : null;
  }

  teamSectorCount(id) {
    let count = 0;
    for (const sector of this.sectors) if (sector.owner === id) count += 1;
    return count;
  }

  refreshSectorCounts() {
    FACTION_ORDER.forEach(id => { this.teams[id].sectors = this.teamSectorCount(id); });
  }

  sectorIncome(id) {
    const base = 1.8 + this.teamSectorCount(id) * 0.76;
    return base * FACTIONS[id].incomeMod;
  }

  unitCap(id) {
    return Math.floor((10 + this.teamSectorCount(id) * 4.2) * FACTIONS[id].capMod);
  }

  livingUnits(id = this.activeId) {
    return this.units.filter(unit => !unit.dead && unit.teamId === id);
  }

  setSpawnDefaults() {
    FACTION_ORDER.forEach(id => {
      const team = this.teams[id];
      const owned = this.sectors.filter(sector => sector.owner === id);
      if (!team.spawnSectorId || !owned.some(sector => sector.id === team.spawnSectorId)) {
        const faction = FACTIONS[id];
        const capital = owned.find(sector => sector.id === faction.capital);
        const front = owned.sort((a, b) => {
          return this.sectorThreat(b, id) - this.sectorThreat(a, id);
        })[0];
        team.spawnSectorId = (front || capital)?.id || null;
      }
    });
  }

  sectorThreat(sector, id) {
    let score = 0;
    for (const other of this.sectors) {
      if (other.owner === id) continue;
      const distance = Math.hypot(other.x - sector.x, other.y - sector.y);
      score += Math.max(0, 500 - distance) * 0.2;
      if (other.capital) score += 80;
    }
    for (const unit of this.units) {
      if (unit.dead || unit.teamId === id) continue;
      if (Math.hypot(unit.x - sector.x, unit.y - sector.y) < 260) score += 25;
    }
    return score;
  }

  setActiveTeam(teamId, options = {}) {
    if (this.over || !this.teams[teamId]?.alive) return false;
    if (teamId === this.activeId && !options.force) return false;
    this.activeId = teamId;
    this.clearSelection();
    this.targeting = null;
    this.selectedSectorId = this.teams[teamId].spawnSectorId;
    if (options.focus !== false) {
      this.focusTeam(teamId);
    }
    const musteringPoint = this.sectorMap.get(this.teams[teamId].spawnSectorId);
    if (musteringPoint) {
      const vanguard = this.units
        .filter(unit => !unit.dead && unit.teamId === teamId && !unit.garrison)
        .sort((a, b) => Math.hypot(a.x - musteringPoint.x, a.y - musteringPoint.y) - Math.hypot(b.x - musteringPoint.x, b.y - musteringPoint.y))
        .slice(0, 3);
      if (vanguard.length) this.selectUnits(vanguard, false, true);
    }
    this.logEvent(`${FACTIONS[teamId].name} takes the field under your command.`, teamId, 'command');
    this.notify('BANNER SWITCHED', FACTIONS[teamId].name, FACTIONS[teamId].color);
    return true;
  }

  focusTeam(teamId) {
    const team = this.teams[teamId];
    const sector = this.sectorMap.get(team.spawnSectorId) || this.sectorMap.get(FACTIONS[teamId].capital);
    if (!sector) return;
    this.cameraTarget = { x: sector.x, y: sector.y, zoom: this.viewport.width < 700 ? 0.8 : Math.max(this.camera.zoom, 0.82) };
    this.camera.x = sector.x;
    this.camera.y = sector.y;
    this.camera.zoom = this.cameraTarget.zoom;
  }

  focusSector(sectorId) {
    const sector = this.sectorMap.get(sectorId);
    if (!sector) return;
    this.cameraTarget = { x: sector.x, y: sector.y, zoom: this.camera.zoom };
  }

  clearSelection() {
    this.selected.clear();
    this.selectedSectorId = null;
  }

  selectUnits(units, additive = false, silent = false) {
    if (!additive) this.selected.clear();
    for (const unit of units) {
      if (unit && !unit.dead && unit.teamId === this.activeId) this.selected.add(unit.id);
    }
    if (!silent) this.selectedSectorId = null;
    if (this.selected.size) this.selectedSectorId = null;
  }

  unitAt(x, y, anyTeam = false, tolerance = 17) {
    let best = null;
    let bestDistance = Infinity;
    for (const unit of this.units) {
      if (unit.dead) continue;
      if (!anyTeam && unit.teamId !== this.activeId) continue;
      const d = Math.hypot(unit.x - x, unit.y - y);
      if (d < tolerance + unit.def.radius && d < bestDistance) {
        best = unit;
        bestDistance = d;
      }
    }
    return best;
  }

  sectorAt(x, y, tolerance = 62) {
    let best = null;
    let bestDistance = Infinity;
    for (const sector of this.sectors) {
      const d = Math.hypot(sector.x - x, sector.y - y);
      if (d < tolerance && d < bestDistance) {
        best = sector;
        bestDistance = d;
      }
    }
    return best;
  }

  boxSelect(x1, y1, x2, y2, additive = false) {
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const chosen = this.units.filter(unit => {
      return !unit.dead && unit.teamId === this.activeId &&
        unit.x >= left && unit.x <= right && unit.y >= top && unit.y <= bottom;
    });
    this.selectUnits(chosen, additive);
    return chosen;
  }

  orderAt(x, y) {
    const units = this.selectedUnits;
    if (!units.length) return false;
    const target = this.unitAt(x, y, true, 21);
    if (target && target.teamId !== this.activeId) {
      return this.orderAttack(units, target);
    }
    return this.orderMove(units, x, y);
  }

  orderMove(units, x, y) {
    if (!units.length) return false;
    const living = units.filter(unit => !unit.dead);
    if (!living.length) return false;
    const cols = Math.ceil(Math.sqrt(living.length));
    const spacing = 32;
    const centerX = (cols - 1) * spacing / 2;
    const rows = Math.ceil(living.length / cols);
    const centerY = (rows - 1) * spacing / 2;
    const sorted = [...living].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    sorted.forEach((unit, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      let tx = x + (col * spacing - centerX);
      let ty = y + (row * spacing - centerY);
      const point = this.clampPoint(tx, ty);
      unit.order = { type: 'move', x: point.x, y: point.y, auto: false };
      unit.targetId = null;
      unit.guardX = point.x;
      unit.guardY = point.y;
      unit.digTimer = 0;
      this.setUnitPath(unit, point.x, point.y);
    });
    this.effectsMoveMarker(x, y, this.activeFaction.color);
    return true;
  }

  orderAttack(units, target) {
    if (!units.length || !target || target.dead) return false;
    for (const unit of units) {
      if (unit.dead) continue;
      unit.order = { type: 'attack', x: target.x, y: target.y, auto: false };
      unit.targetId = target.id;
      unit.repathTimer = rand(0.05, 0.3);
      unit.digTimer = 0;
      const distance = Math.hypot(unit.x - target.x, unit.y - target.y);
      if (distance > unit.def.range - 8) this.setUnitPath(unit, target.x, target.y);
      else unit.path = [];
    }
    this.effectsAttackMarker(target.x, target.y, FACTIONS[target.teamId].color);
    return true;
  }

  orderDig(units = this.selectedUnits) {
    if (!units.length) return false;
    for (const unit of units) {
      if (unit.dead) continue;
      unit.order = { type: 'dig', x: unit.x, y: unit.y, auto: false };
      unit.targetId = null;
      unit.path = [];
      unit.digTimer = 0;
      unit.guardX = unit.x;
      unit.guardY = unit.y;
    }
    this.notify('DIG IN', 'Infantry are preparing cover', FACTIONS[this.activeId].color);
    return true;
  }

  orderStop(units = this.selectedUnits) {
    if (!units.length) return false;
    for (const unit of units) {
      if (unit.dead) continue;
      unit.order = { type: 'idle', x: unit.x, y: unit.y, auto: false };
      unit.targetId = null;
      unit.path = [];
      unit.pathIndex = 0;
      unit.guardX = unit.x;
      unit.guardY = unit.y;
    }
    return true;
  }

  orderHold(units = this.selectedUnits) {
    this.orderStop(units);
    for (const unit of units) {
      unit.order.type = 'entrench';
      unit.entrench = Math.max(unit.entrench, 0.25);
    }
  }

  selectSpawnSector(sectorId) {
    const sector = this.sectorMap.get(sectorId);
    if (!sector || sector.owner !== this.activeId) return false;
    this.teams[this.activeId].spawnSectorId = sectorId;
    this.selectedSectorId = sectorId;
    return true;
  }

  recruit(typeKey) {
    const team = this.activeTeam;
    if (!team || !team.alive || this.over) return { ok: false, message: 'No command authority.' };
    const def = getUnitDef(this.activeId, typeKey);
    if (this.livingUnits(this.activeId).length >= this.unitCap(this.activeId)) {
      return { ok: false, message: 'Unit cap reached. Take another sector.' };
    }
    if (team.resources < def.cost) {
      return { ok: false, message: `Need ${Math.ceil(def.cost - team.resources)} more requisition.` };
    }
    const spawn = this.getSpawnSector(this.activeId);
    if (!spawn) return { ok: false, message: 'No deployment sector available.' };
    team.resources -= def.cost;
    const point = this.findSpawnPoint(spawn, this.activeId);
    const unit = this.createUnit(this.activeId, typeKey, point.x, point.y, 99);
    this.units.push(unit);
    this.unitMap.set(unit.id, unit);
    this.effectsSpawn(point.x, point.y, FACTIONS[this.activeId].color);
    this.logEvent(`${def.name} deployed at ${spawn.name}.`, this.activeId, 'recruit');
    return { ok: true, unit, message: `${def.name} deployed at ${spawn.name}.` };
  }

  tryRecruitForAI(teamId, typeKey) {
    const team = this.teams[teamId];
    if (!team || !team.alive) return false;
    const def = getUnitDef(teamId, typeKey);
    if (this.livingUnits(teamId).length >= this.unitCap(teamId)) return false;
    if (team.resources < def.cost) return false;
    const spawn = this.getSpawnSector(teamId);
    if (!spawn) return false;
    team.resources -= def.cost;
    const point = this.findSpawnPoint(spawn, teamId);
    const unit = this.createUnit(teamId, typeKey, point.x, point.y, 99);
    this.units.push(unit);
    this.unitMap.set(unit.id, unit);
    this.effectsSpawn(point.x, point.y, FACTIONS[teamId].color);
    return true;
  }

  getSpawnSector(teamId) {
    const team = this.teams[teamId];
    if (!team) return null;
    const chosen = this.sectorMap.get(team.spawnSectorId);
    if (chosen && chosen.owner === teamId) return chosen;
    const owned = this.sectors.filter(sector => sector.owner === teamId);
    if (!owned.length) return null;
    const capital = owned.find(sector => sector.id === FACTIONS[teamId].capital);
    const next = capital || owned[0];
    team.spawnSectorId = next.id;
    return next;
  }

  findSpawnPoint(sector, teamId) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 58;
      const x = sector.x + Math.cos(angle) * radius;
      const y = sector.y + Math.sin(angle) * radius;
      if (this.world.isWalkable?.(x, y) === false) continue;
      if (!this.isWalkable(x, y)) continue;
      return { x, y };
    }
    return { x: sector.x + rand(-30, 30), y: sector.y + rand(-30, 30) };
  }

  barrageReadyIn(teamId = this.activeId) {
    return Math.max(0, this.teams[teamId].barrageReady - this.time);
  }

  beginBarrageTargeting() {
    if (this.over || !this.running) return false;
    if (this.barrageReadyIn() > 0) return false;
    this.targeting = 'barrage';
    return true;
  }

  cancelTargeting() {
    this.targeting = null;
  }

  fireBarrage(x, y) {
    if (this.targeting !== 'barrage') return false;
    if (this.barrageReadyIn() > 0) {
      this.targeting = null;
      return false;
    }
    const teamId = this.activeId;
    this.teams[teamId].barrageReady = this.time + 52;
    this.targeting = null;
    for (let i = 0; i < 6; i += 1) {
      this.strikes.push({
        x: x + rand(-75, 75),
        y: y + rand(-75, 75),
        delay: i * 0.33 + rand(0, 0.18),
        teamId,
        radius: 78,
        damage: 56
      });
    }
    this.notify('ARTILLERY FIRE MISSION', 'Six guns. Thirty seconds of thunder.', FACTIONS[teamId].color);
    this.logEvent(`A creeping barrage falls on the ${this.nearestPlaceName(x, y)}.`, teamId, 'barrage');
    this.makeRing(x, y, 115, FACTIONS[teamId].color, 1.2);
    return true;
  }

  nearestPlaceName(x, y) {
    let best = 'front';
    let distance = Infinity;
    for (const sector of this.sectors) {
      const d = Math.hypot(x - sector.x, y - sector.y);
      if (d < distance) { distance = d; best = sector.name; }
    }
    return distance < 220 ? best : 'open ground';
  }

  notify(title, sub, tone = '#d7bd79') {
    this.notifications.push({ id: Math.random(), title, sub, tone, time: this.time });
    if (this.notifications.length > 4) this.notifications.shift();
    this.lastNotice = this.time;
  }

  logEvent(text, teamId = null, kind = 'battle') {
    this.log.unshift({ text, teamId, kind, time: this.time });
    if (this.log.length > 42) this.log.pop();
  }

  setUnitPath(unit, x, y) {
    if (!this.isWalkable(x, y)) {
      const nearest = this.nearestWalkable(x, y);
      x = nearest.x;
      y = nearest.y;
    }
    const path = this.findPath(unit.x, unit.y, x, y);
    unit.path = path;
    unit.pathIndex = 0;
  }

  isWalkable(x, y) {
    const { walkable, nav } = this.world;
    if (!walkable) return true;
    const col = Math.floor(x / nav.cell);
    const row = Math.floor(y / nav.cell);
    if (col < 0 || row < 0 || col >= nav.cols || row >= nav.rows) return false;
    return walkable[row * nav.cols + col] === 1;
  }

  nearestWalkable(x, y) {
    if (this.isWalkable(x, y)) return { x, y };
    const { walkable, nav } = this.world;
    const startCol = clamp(Math.floor(x / nav.cell), 0, nav.cols - 1);
    const startRow = clamp(Math.floor(y / nav.cell), 0, nav.rows - 1);
    for (let radius = 1; radius < 14; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const col = startCol + dx;
          const row = startRow + dy;
          if (col < 0 || row < 0 || col >= nav.cols || row >= nav.rows) continue;
          if (walkable[row * nav.cols + col]) {
            return { x: (col + 0.5) * nav.cell, y: (row + 0.5) * nav.cell };
          }
        }
      }
    }
    return { x, y };
  }

  lineWalkable(x1, y1, x2, y2) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(distance / 14);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (!this.isWalkable(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }

  findPath(sx, sy, tx, ty) {
    if (this.lineWalkable(sx, sy, tx, ty)) return [{ x: tx, y: ty }];
    const { walkable, nav } = this.world;
    if (!walkable) return [{ x: tx, y: ty }];
    const start = { col: clamp(Math.floor(sx / nav.cell), 0, nav.cols - 1), row: clamp(Math.floor(sy / nav.cell), 0, nav.rows - 1) };
    const goalWorld = this.nearestWalkable(tx, ty);
    const goal = { col: clamp(Math.floor(goalWorld.x / nav.cell), 0, nav.cols - 1), row: clamp(Math.floor(goalWorld.y / nav.cell), 0, nav.rows - 1) };
    const count = nav.cols * nav.rows;
    const gScore = new Float32Array(count);
    gScore.fill(Infinity);
    const cameFrom = new Int32Array(count);
    cameFrom.fill(-1);
    const closed = new Uint8Array(count);
    const heap = new MinHeap();
    const startIndex = start.row * nav.cols + start.col;
    const goalIndex = goal.row * nav.cols + goal.col;
    gScore[startIndex] = 0;
    const heuristic = (col, row) => {
      const dx = Math.abs(col - goal.col);
      const dy = Math.abs(row - goal.row);
      return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * nav.cell;
    };
    heap.push(startIndex, heuristic(start.col, start.row));
    const neighbours = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
    ];
    let found = false;
    let iterations = 0;
    while (heap.size && iterations < 5200) {
      iterations += 1;
      const current = heap.pop();
      if (closed[current]) continue;
      closed[current] = 1;
      if (current === goalIndex) { found = true; break; }
      const col = current % nav.cols;
      const row = Math.floor(current / nav.cols);
      for (const [dc, dr, cost] of neighbours) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue;
        const index = nr * nav.cols + nc;
        if (!walkable[index] || closed[index]) continue;
        if (dc !== 0 && dr !== 0) {
          if (!walkable[row * nav.cols + nc] || !walkable[nr * nav.cols + col]) continue;
        }
        const tentative = gScore[current] + cost * nav.cell;
        if (tentative < gScore[index]) {
          gScore[index] = tentative;
          cameFrom[index] = current;
          heap.push(index, tentative + heuristic(nc, nr));
        }
      }
    }
    if (!found) return [];
    const cells = [];
    let current = goalIndex;
    while (current !== -1 && current !== startIndex) {
      const col = current % nav.cols;
      const row = Math.floor(current / nav.cols);
      cells.push({ x: (col + 0.5) * nav.cell, y: (row + 0.5) * nav.cell });
      current = cameFrom[current];
      if (cells.length > 1200) break;
    }
    cells.reverse();
    cells.push({ x: goalWorld.x, y: goalWorld.y });

    // Smooth the path so units do not visibly march from grid square to grid square.
    const smooth = [];
    let anchor = { x: sx, y: sy };
    let index = 0;
    while (index < cells.length) {
      let farthest = index;
      for (let test = cells.length - 1; test > index; test -= 1) {
        if (this.lineWalkable(anchor.x, anchor.y, cells[test].x, cells[test].y)) {
          farthest = test;
          break;
        }
      }
      smooth.push(cells[farthest]);
      anchor = cells[farthest];
      index = farthest + 1;
    }
    return smooth;
  }

  update(dt) {
    if (!this.running || this.paused || this.over) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.selectionRingPulse += dt;
    this.shake = Math.max(0, this.shake - dt * 18);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = rand(55, 105);
      this.weather.rain = rand(0, 0.65);
      this.weather.fog = rand(0.03, 0.22);
      this.weather.front = rand(0.35, 0.75);
    }

    FACTION_ORDER.forEach(id => {
      const team = this.teams[id];
      if (!team.alive) return;
      team.resources = Math.min(1600, team.resources + this.sectorIncome(id) * dt);
    });

    this.updateUnits(dt);
    this.updateAI(dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateParticles(dt);
    this.updateSectors(dt);
    this.updateVictory(dt);
    this.cleanupDead();
    this.refreshSectorCounts();
    this.setSpawnDefaults();

    if (this.cameraTarget) {
      const t = Math.min(1, dt * 5.5);
      this.camera.x += (this.cameraTarget.x - this.camera.x) * t;
      this.camera.y += (this.cameraTarget.y - this.camera.y) * t;
      const zt = Math.min(1, dt * 4);
      this.camera.zoom += (this.cameraTarget.zoom - this.camera.zoom) * zt;
      if (Math.abs(this.camera.x - this.cameraTarget.x) < 1 && Math.abs(this.camera.y - this.cameraTarget.y) < 1) this.cameraTarget = null;
    }
    this.clampCamera();
  }

  updateUnits(dt) {
    for (const unit of this.units) {
      if (unit.dead) continue;
      unit.cooldown -= dt;
      unit.muzzle = Math.max(0, unit.muzzle - dt);
      unit.damageFlash = Math.max(0, unit.damageFlash - dt);
      unit.underFire = this.time - unit.lastHit < 1.4;
      unit.suppress = Math.max(0, unit.suppress - dt * 6.5);
      unit.coverTimer -= dt;
      if (unit.coverTimer <= 0) {
        unit.coverTimer = rand(0.5, 0.9);
        unit.coverTrench = this.nearTrench(unit.x, unit.y);
      }
      if (unit.entrench > 0 && unit.moving) unit.entrench = Math.max(0, unit.entrench - dt * 0.8);
      if (unit.moving) unit.bob += dt * 8;
      this.updateUnitOrder(unit, dt);
      this.moveUnit(unit, dt);
    }
    this.separateUnits();
  }

  updateUnitOrder(unit, dt) {
    const order = unit.order;
    if (order.type === 'dig') {
      unit.digTimer += dt;
      if (!unit.moving) {
        unit.entrench = Math.min(1, unit.digTimer / 2.2);
        if (unit.digTimer >= 2.2 && order.type === 'dig') {
          order.type = 'entrench';
          unit.entrench = 1;
          this.effectsDigComplete(unit);
        }
      }
    }

    if (order.type === 'attack') {
      const target = this.unitMap.get(unit.targetId);
      if (!target || target.dead) {
        unit.targetId = null;
        unit.order = { type: unit.entrench > 0.3 ? 'entrench' : 'idle', x: unit.x, y: unit.y, auto: false };
        unit.path = [];
        return;
      }
      const distance = Math.hypot(unit.x - target.x, unit.y - target.y);
      const range = unit.def.range;
      const minRange = unit.def.minRange || 0;
      if (distance > range - 6) {
        unit.repathTimer -= dt;
        if (unit.repathTimer <= 0) {
          unit.repathTimer = rand(0.6, 1.15);
          this.setUnitPath(unit, target.x, target.y);
        }
      } else if (minRange && distance < minRange) {
        // Back away from a target that has closed inside the guns' minimum arc.
        const angle = Math.atan2(unit.y - target.y, unit.x - target.x);
        const x = unit.x + Math.cos(angle) * 32;
        const y = unit.y + Math.sin(angle) * 32;
        this.setUnitPath(unit, x, y);
      } else {
        unit.path = [];
        unit.pathIndex = 0;
        unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
        if (unit.cooldown <= 0) this.fireAt(unit, target);
      }
      return;
    }

    if (order.type === 'entrench' && unit.entrench > 0) {
      const target = this.acquireTarget(unit, unit.def.range + 6);
      if (target) {
        unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
        if (unit.cooldown <= 0) this.fireAt(unit, target);
      }
      return;
    }

    if (order.type === 'move') {
      if (!unit.path.length || unit.pathIndex >= unit.path.length) {
        unit.order = { type: 'idle', x: unit.x, y: unit.y, auto: false };
        unit.moving = false;
        unit.arriveAt = this.time;
        unit.guardX = unit.x;
        unit.guardY = unit.y;
      }
      return;
    }

    if (order.type === 'idle') {
      const target = this.acquireTarget(unit, unit.def.range + 8);
      if (target) {
        unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
        if (unit.cooldown <= 0) this.fireAt(unit, target);
      }
    }
  }

  acquireTarget(unit, range) {
    if (unit.def.capture === 0 && unit.def.sprite === 'art') range = unit.def.range;
    let best = null;
    let bestDistance = range;
    for (const other of this.units) {
      if (other.dead || other.teamId === unit.teamId) continue;
      const distance = Math.hypot(unit.x - other.x, unit.y - other.y);
      if (distance < bestDistance) {
        best = other;
        bestDistance = distance;
      }
    }
    return best;
  }

  fireAt(unit, target) {
    const def = unit.def;
    unit.cooldown = def.rof * rand(0.92, 1.08);
    unit.facing = Math.atan2(target.y - unit.y, target.x - unit.x);
    unit.muzzle = 0.08;
    this.stats.shots += 1;
    const muzzleX = unit.x + Math.cos(unit.facing) * 12;
    const muzzleY = unit.y + Math.sin(unit.facing) * 12;
    const distance = Math.hypot(target.x - unit.x, target.y - unit.y);

    if (def.shell) {
      this.stats.shells += 1;
      const spread = target.def.speed > 0 ? Math.min(24, distance * 0.025) : 5;
      const tx = target.x + rand(-spread, spread);
      const ty = target.y + rand(-spread, spread);
      this.projectiles.push({
        kind: 'shell',
        x: muzzleX,
        y: muzzleY,
        x1: muzzleX,
        y1: muzzleY,
        tx,
        ty,
        t: 0,
        duration: 0.55 + distance / 950,
        teamId: unit.teamId,
        damage: def.dmg,
        splash: def.splash || 55,
        sourceId: unit.id,
        color: FACTIONS[unit.teamId].color
      });
      this.particles.push({ kind: 'muzzle', x: muzzleX, y: muzzleY, vx: Math.cos(unit.facing) * 25, vy: Math.sin(unit.facing) * 25, life: 0.24, maxLife: 0.24, size: 12, color: '#f5d18a' });
      this.audio?.shot?.('art', 0.6);
      return;
    }

    const accuracy = def.sprite === 'mg' ? 0.54 : def.sprite === 'tank' ? 0.82 : 0.74;
    const spread = def.sprite === 'mg' ? 15 : 7;
    const hit = Math.random() < accuracy;
    const tx = target.x + rand(-spread, spread);
    const ty = target.y + rand(-spread, spread);
    this.tracers.push({
      x1: muzzleX,
      y1: muzzleY,
      x2: tx,
      y2: ty,
      life: def.sprite === 'tank' ? 0.18 : 0.09,
      maxLife: def.sprite === 'tank' ? 0.18 : 0.09,
      color: def.sprite === 'tank' ? '#ffd27a' : '#f0cf8a',
      width: def.sprite === 'mg' ? 1.1 : 1.4
    });
    this.particles.push({ kind: 'flash', x: muzzleX, y: muzzleY, life: 0.075, maxLife: 0.075, size: def.sprite === 'tank' ? 9 : 5, color: '#ffe2a0' });
    if (hit) {
      let damage = def.dmg * rand(0.84, 1.16);
      if (def.sprite === 'mg' && target.def.armor) damage *= 0.42;
      if (unit.teamId === 'germany') damage *= 1.0;
      this.damageUnit(target, damage, unit, def.suppression || 0);
      this.effectsImpact(tx, ty, def.sprite === 'tank' ? 7 : 3, '#e2c690');
    }
    this.audio?.shot?.(def.sprite === 'tank' ? 'tank' : def.sprite === 'mg' ? 'mg' : 'rifle', 0.5);
  }

  damageUnit(target, amount, source, suppression = 0) {
    if (!target || target.dead) return;
    let damage = amount * 0.84;
    const def = target.def;
    if (def.armor) damage *= (1 - def.armor);
    if (target.entrench > 0.2) damage *= 1 - 0.36 * target.entrench;
    else if (target.coverTrench) damage *= 0.82;
    if (target.teamId === 'austria') {
      const local = this.sectorAt(target.x, target.y, 150);
      if (local && local.owner === 'austria') damage *= 0.82;
    }
    if (target.suppress > 62) damage *= 0.9;
    target.hp -= damage;
    target.lastHit = this.time;
    target.damageFlash = 0.18;
    if (suppression) target.suppress = Math.min(100, target.suppress + suppression);
    if (source) this.particles.push({ kind: 'hit', x: target.x, y: target.y, vx: rand(-20, 20), vy: rand(-25, 8), life: 0.24, maxLife: 0.24, size: rand(1.5, 3.2), color: '#c9a16e' });
    if (target.hp <= 0) this.killUnit(target, source);
  }

  killUnit(unit, source) {
    if (unit.dead) return;
    unit.dead = true;
    unit.hp = 0;
    this.stats.casualties += 1;
    const team = this.teams[unit.teamId];
    if (team) team.losses += 1;
    if (source?.teamId && this.teams[source.teamId]) this.teams[source.teamId].kills += 1;
    for (let i = 0; i < 8; i += 1) {
      this.particles.push({
        kind: i < 4 ? 'smoke' : 'debris',
        x: unit.x + rand(-6, 6),
        y: unit.y + rand(-6, 6),
        vx: rand(-28, 28),
        vy: rand(-38, 8),
        life: rand(0.35, 1.2),
        maxLife: 1.2,
        size: rand(2, 8),
        color: i < 4 ? '#5e5b49' : '#6c6047'
      });
    }
    this.scorches.push({ x: unit.x, y: unit.y, r: rand(9, 15), alpha: 0.22 });
    if (this.scorches.length > 100) this.scorches.shift();
    this.shake = Math.max(this.shake, 0.4);
    if (this.selected.has(unit.id)) this.selected.delete(unit.id);
    if (unit.teamId === this.activeId && Math.random() > 0.55) {
      this.notify('UNIT LOST', `${unit.def.name} have fallen`, '#b55a4a');
    }
  }

  updateTrenches() {
    // Individual cover checks are inexpensive and keep units responsive after moving.
    for (const unit of this.units) {
      if (unit.dead) continue;
      if (!unit.coverTimer || unit.coverTimer > 0.7) unit.coverTrench = this.nearTrench(unit.x, unit.y);
    }
  }

  nearTrench(x, y) {
    for (const line of this.world.trenchLines) {
      for (let i = 0; i < line.length - 1; i += 1) {
        if (distanceToSegment(x, y, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]) < 28) return true;
      }
    }
    return false;
  }

  moveUnit(unit, dt) {
    if (!unit.path.length || unit.pathIndex >= unit.path.length) {
      unit.moving = false;
      return;
    }
    const speed = unit.def.speed * (unit.suppress > 62 ? 0.5 : 1) * (unit.entrench > 0.2 ? 0.7 : 1);
    let remaining = speed * dt;
    unit.moving = remaining > 0;
    while (remaining > 0 && unit.pathIndex < unit.path.length) {
      const point = unit.path[unit.pathIndex];
      const dx = point.x - unit.x;
      const dy = point.y - unit.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1.3) {
        unit.pathIndex += 1;
        continue;
      }
      const step = Math.min(remaining, distance);
      const nx = dx / distance;
      const ny = dy / distance;
      const nextX = unit.x + nx * step;
      const nextY = unit.y + ny * step;
      if (this.isWalkable(nextX, nextY)) {
        unit.x = nextX;
        unit.y = nextY;
        unit.facing += Math.atan2(Math.sin(Math.atan2(ny, nx) - unit.facing), Math.cos(Math.atan2(ny, nx) - unit.facing)) * Math.min(1, dt * 15);
        remaining -= step;
      } else {
        unit.path = [];
        unit.pathIndex = 0;
        if (unit.order.type === 'move') {
          unit.order.type = 'idle';
        }
        break;
      }
      if (distance <= step + 1.3) unit.pathIndex += 1;
    }
    if (unit.pathIndex >= unit.path.length) {
      unit.path = [];
      unit.pathIndex = 0;
      unit.moving = false;
    }
  }

  separateUnits() {
    const living = this.units.filter(unit => !unit.dead);
    for (let i = 0; i < living.length; i += 1) {
      const a = living[i];
      for (let j = i + 1; j < living.length; j += 1) {
        const b = living[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const minDistance = a.def.radius + b.def.radius + 1;
        if (distance >= minDistance) continue;
        const push = (minDistance - distance) * 0.34;
        const nx = dx / distance;
        const ny = dy / distance;
        const ax = a.x - nx * push;
        const ay = a.y - ny * push;
        const bx = b.x + nx * push;
        const by = b.y + ny * push;
        if (this.isWalkable(ax, ay)) { a.x = ax; a.y = ay; }
        if (this.isWalkable(bx, by)) { b.x = bx; b.y = by; }
      }
    }
  }

  updateProjectiles(dt) {
    for (const projectile of this.projectiles) {
      projectile.t += dt;
      if (projectile.t >= projectile.duration) {
        projectile.done = true;
        this.explode(projectile.tx, projectile.ty, projectile.splash, projectile.damage, projectile.teamId, projectile.sourceId);
      }
    }
    this.projectiles = this.projectiles.filter(projectile => !projectile.done);
  }

  explode(x, y, radius, damage, teamId, sourceId) {
    this.stats.shells += 1;
    this.shake = Math.max(this.shake, 2.2);
    this.flash = Math.max(this.flash, 0.2);
    this.scorches.push({ x, y, r: radius * 0.42, alpha: 0.26 });
    if (this.scorches.length > 100) this.scorches.shift();
    this.makeExplosion(x, y, radius);
    for (const unit of this.units) {
      if (unit.dead) continue;
      const distance = Math.hypot(unit.x - x, unit.y - y);
      if (distance > radius) continue;
      if (unit.teamId === teamId) continue;
      const falloff = 1 - (distance / radius) * 0.7;
      this.damageUnit(unit, damage * falloff * rand(0.82, 1.18), { teamId, id: sourceId }, 8);
    }
    for (const sector of this.sectors) {
      if (Math.hypot(sector.x - x, sector.y - y) < radius + 20) sector.pulse = 1;
    }
    this.audio?.explosion?.(1);
  }

  updateStrikes(dt) {
    for (const strike of this.strikes) {
      strike.delay -= dt;
      if (strike.delay <= 0 && !strike.done) {
        strike.done = true;
        this.explode(strike.x, strike.y, strike.radius, strike.damage, strike.teamId, null);
      }
    }
    this.strikes = this.strikes.filter(strike => !strike.done);
  }

  updateParticles(dt) {
    for (const particle of this.particles) {
      particle.life -= dt;
      if (particle.vx) particle.x += particle.vx * dt;
      if (particle.vy) particle.y += particle.vy * dt;
      if (particle.kind === 'smoke') {
        particle.vx *= 0.985;
        particle.vy = (particle.vy || 0) - 8 * dt;
        particle.size += 8 * dt;
      }
      if (particle.kind === 'debris') particle.vy += 85 * dt;
      if (particle.kind === 'ring') particle.size += (particle.growth || 40) * dt;
    }
    this.particles = this.particles.filter(particle => particle.life > 0);
    for (const tracer of this.tracers) tracer.life -= dt;
    this.tracers = this.tracers.filter(tracer => tracer.life > 0);
    for (const sector of this.sectors) sector.pulse = Math.max(0, sector.pulse - dt * 1.4);
  }

  makeExplosion(x, y, radius) {
    this.particles.push({ kind: 'flash', x, y, life: 0.24, maxLife: 0.24, size: radius * 0.72, color: '#f5cc7e' });
    this.particles.push({ kind: 'ring', x, y, life: 0.55, maxLife: 0.55, size: radius * 0.18, growth: radius * 1.9, color: '#d8b06f' });
    for (let i = 0; i < 18; i += 1) {
      this.particles.push({
        kind: i < 10 ? 'smoke' : 'debris',
        x: x + rand(-radius * 0.25, radius * 0.25),
        y: y + rand(-radius * 0.25, radius * 0.25),
        vx: rand(-60, 60),
        vy: rand(-90, 20),
        life: rand(0.5, 1.6),
        maxLife: 1.6,
        size: rand(4, 15),
        color: i < 10 ? pick(['#4b483b', '#5a5544', '#6d634d']) : '#7d6947'
      });
    }
    for (let i = 0; i < 9; i += 1) {
      this.particles.push({
        kind: 'spark',
        x,
        y,
        vx: rand(-160, 160),
        vy: rand(-180, 45),
        life: rand(0.2, 0.65),
        maxLife: 0.65,
        size: rand(1, 2.4),
        color: pick(['#ffdda0', '#ffb45e', '#fff0c0'])
      });
    }
  }

  effectsMoveMarker(x, y, color) {
    this.particles.push({ kind: 'ring', x, y, life: 0.7, maxLife: 0.7, size: 8, growth: 65, color });
    this.particles.push({ kind: 'flag', x, y, life: 1.1, maxLife: 1.1, size: 1, color });
    this.audio?.command?.();
  }

  effectsAttackMarker(x, y, color) {
    this.particles.push({ kind: 'ring', x, y, life: 0.7, maxLife: 0.7, size: 10, growth: 90, color: '#d65c4a' });
    this.particles.push({ kind: 'cross', x, y, life: 0.9, maxLife: 0.9, size: 14, color: '#e2b46c' });
    this.audio?.command?.();
  }

  effectsSpawn(x, y, color) {
    this.particles.push({ kind: 'ring', x, y, life: 0.8, maxLife: 0.8, size: 4, growth: 60, color });
    for (let i = 0; i < 5; i += 1) {
      this.particles.push({ kind: 'smoke', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-15, 15), vy: rand(-25, 0), life: rand(0.3, 0.8), maxLife: 0.8, size: rand(2, 5), color: '#81765c' });
    }
  }

  effectsDigComplete(unit) {
    this.particles.push({ kind: 'ring', x: unit.x, y: unit.y, life: 0.5, maxLife: 0.5, size: 5, growth: 36, color: '#c0a26a' });
  }

  effectsImpact(x, y, size, color) {
    for (let i = 0; i < 2; i += 1) {
      this.particles.push({ kind: 'spark', x, y, vx: rand(-30, 30), vy: rand(-40, 5), life: rand(0.08, 0.22), maxLife: 0.22, size: rand(0.8, 1.8), color });
    }
  }

  makeRing(x, y, radius, color, life = 0.7) {
    this.particles.push({ kind: 'ring', x, y, life, maxLife: life, size: radius * 0.2, growth: radius * 1.2, color });
  }

  updateSectors(dt) {
    const units = this.units.filter(unit => !unit.dead);
    for (const sector of this.sectors) {
      const inside = units.filter(unit => Math.hypot(unit.x - sector.x, unit.y - sector.y) <= sector.radius);
      const teamsInside = new Set(inside.map(unit => unit.teamId));
      const ownerInside = sector.owner ? inside.some(unit => unit.teamId === sector.owner) : false;
      sector.contested = teamsInside.size > 1;
      sector.underAttack = !!sector.owner && teamsInside.has(sector.owner) && teamsInside.size > 1;
      let attackerTeam = null;
      let capturePower = 0;
      if (!sector.contested) {
        for (const teamId of teamsInside) {
          if (teamId === sector.owner) continue;
          const teamPower = inside.filter(unit => unit.teamId === teamId && unit.def.capture > 0 && unit.suppress < 75)
            .reduce((sum, unit) => sum + unit.def.capture, 0);
          if (teamPower > 0) {
            attackerTeam = teamId;
            capturePower = teamPower;
          }
        }
      }
      if (attackerTeam && !ownerInside) {
        if (sector.captureTeam !== attackerTeam) {
          sector.captureTeam = attackerTeam;
          sector.progress = Math.max(0, sector.progress * 0.4);
        }
        sector.captureSpeed = (3 + capturePower * 2.4) * (sector.capital ? 0.4 : 1);
        sector.progress = Math.min(100, sector.progress + dt * sector.captureSpeed);
        if (sector.progress >= 100) this.captureSector(sector, attackerTeam);
      } else {
        sector.captureSpeed = 0;
        if (sector.progress > 0) sector.progress = Math.max(0, sector.progress - dt * 7.5);
        if (sector.progress === 0) sector.captureTeam = null;
      }
    }
  }

  captureSector(sector, teamId) {
    if (sector.owner === teamId) return;
    const previous = sector.owner;
    sector.owner = teamId;
    sector.progress = 0;
    sector.captureTeam = null;
    sector.lastOwnerChange = this.time;
    sector.pulse = 1;
    this.stats.captures += 1;
    const faction = FACTIONS[teamId];
    this.makeRing(sector.x, sector.y, sector.radius * 1.25, faction.color, 1.5);
    for (let i = 0; i < 18; i += 1) {
      this.particles.push({ kind: 'spark', x: sector.x + rand(-25, 25), y: sector.y + rand(-25, 25), vx: rand(-35, 35), vy: rand(-60, -10), life: rand(0.5, 1.1), maxLife: 1.1, size: rand(1, 2.6), color: faction.colorLight });
    }
    this.audio?.capture?.(teamId === this.activeId);
    const team = this.teams[teamId];
    if (sector.capital) {
      this.notify('CAPITAL CAPTURED', `${sector.name} has fallen to ${FACTIONS[teamId].short}`, faction.color);
      this.logEvent(`${sector.name} falls. ${faction.name} takes the enemy capital.`, teamId, 'capital');
    } else {
      this.logEvent(`${faction.name} captures ${sector.name}.`, teamId, 'capture');
      if (teamId === this.activeId) this.notify('GROUND TAKEN', `${sector.name} is ours`, faction.color);
      if (previous === this.activeId) this.notify('SECTOR LOST', `${sector.name} has fallen`, '#b55a4a');
    }
    if (previous && previous !== teamId && sector.capital) {
      this.eliminateTeam(previous, teamId);
    }
    this.refreshSectorCounts();
    this.setSpawnDefaults();
  }

  eliminateTeam(teamId, conquerorId) {
    const team = this.teams[teamId];
    if (!team || !team.alive) return;
    team.alive = false;
    team.resources = 0;
    const faction = FACTIONS[teamId];
    for (const unit of this.units) {
      if (unit.teamId !== teamId || unit.dead) continue;
      unit.dead = true;
      for (let i = 0; i < 4; i += 1) {
        this.particles.push({ kind: 'smoke', x: unit.x, y: unit.y, vx: rand(-20, 20), vy: rand(-32, 0), life: rand(0.4, 1.1), maxLife: 1.1, size: rand(3, 8), color: '#5a5544' });
      }
    }
    for (const sector of this.sectors) {
      if (sector.owner === teamId) {
        sector.owner = null;
        sector.progress = 0;
        sector.captureTeam = null;
      }
    }
    if (this.selected) this.selected.clear();
    this.logEvent(`${faction.name} has capitulated. Its armies lay down their arms.`, conquerorId, 'collapse');
    this.notify('EMPIRE FALLS', `${faction.name} capitulates`, faction.color);
    if (teamId === this.activeId) {
      const survivors = FACTION_ORDER.filter(id => this.teams[id].alive);
      if (survivors.length) {
        setTimeout(() => {
          if (!this.over && this.teams[this.activeId] && !this.teams[this.activeId].alive) {
            this.setActiveTeam(survivors.sort((a, b) => this.teamSectorCount(b) - this.teamSectorCount(a))[0], { force: true });
          }
        }, 1200);
      }
    }
    this.checkGameOver();
  }

  updateVictory(dt) {
    if (this.over) return;
    if (this.time - this.lastVictoryCheck < 0.6) {
      if (this.armistice) {
        this.armistice.remaining -= dt;
        if (this.armistice.remaining <= 0) {
          this.finishGame(this.armistice.teamId, 'armistice');
        }
      }
      return;
    }
    this.lastVictoryCheck = this.time;
    const alive = FACTION_ORDER.filter(id => this.teams[id].alive);
    if (alive.length <= 1) {
      this.finishGame(alive[0] || this.activeId, 'last');
      return;
    }
    const counts = {};
    alive.forEach(id => { counts[id] = this.teamSectorCount(id); });
    const leader = alive.sort((a, b) => counts[b] - counts[a])[0];
    if (counts[leader] >= 11) {
      if (!this.armistice || this.armistice.teamId !== leader) {
        this.armistice = { teamId: leader, remaining: 42 };
        this.notify('ARMISTICE IMMINENT', `${FACTIONS[leader].short} controls ${counts[leader]} of 15 sectors`, FACTIONS[leader].color);
        this.logEvent(`${FACTIONS[leader].name} has broken the enemy line. Armistice in 42 seconds.`, leader, 'victory');
        this.audio?.alarm?.();
      }
    } else if (this.armistice) {
      this.armistice = null;
      this.notify('ARMISTICE BROKEN', 'The front has shifted. The war continues.', '#d7bd79');
    }
  }

  checkGameOver() {
    const alive = FACTION_ORDER.filter(id => this.teams[id].alive);
    if (alive.length <= 1) this.finishGame(alive[0] || this.activeId, 'last');
  }

  finishGame(winnerId, reason) {
    if (this.over) return;
    this.over = true;
    this.winner = winnerId;
    this.finishReason = reason;
    this.running = false;
    this.targeting = null;
    this.armistice = null;
    this.audio?.capture?.(winnerId === this.activeId);
    this.logEvent(`${FACTIONS[winnerId].name} has won the Great War.`, winnerId, 'victory');
  }

  cleanupDead() {
    if (!this.units.some(unit => unit.dead)) return;
    for (const unit of this.units) {
      if (unit.dead) this.unitMap.delete(unit.id);
    }
    this.units = this.units.filter(unit => !unit.dead);
  }

  updateAI(dt) {
    for (const teamId of FACTION_ORDER) {
      if (teamId === this.activeId) continue;
      const team = this.teams[teamId];
      if (!team.alive) continue;
      if (this.time >= team.ai.nextThink) {
        team.ai.nextThink = this.time + rand(1.25, 2.0);
        this.aiThink(teamId);
      }
    }
  }

  aiThink(teamId) {
    const team = this.teams[teamId];
    const units = this.livingUnits(teamId);
    if (!units.length) return;
    const owned = this.sectors.filter(sector => sector.owner === teamId);
    if (!owned.length) return;

    // Replace losses, with a bias toward line infantry and the faction's signature arm.
    if (this.time - team.ai.lastRecruit > 2.5 && units.length < this.unitCap(teamId)) {
      const choices = ['rifle', 'rifle', 'mg', 'rifle', 'art', 'cav', 'special'];
      const affordable = choices.filter(key => team.resources >= getUnitDef(teamId, key).cost);
      if (affordable.length && Math.random() < 0.68) {
        this.tryRecruitForAI(teamId, pick(affordable));
        team.ai.lastRecruit = this.time;
      }
    }

    const threatened = owned.filter(sector => units.some(unit => unit.teamId !== teamId && Math.hypot(unit.x - sector.x, unit.y - sector.y) < sector.radius + 60));
    const idle = units.filter(unit => !unit.dead && (unit.order.type === 'idle' || (unit.order.type === 'move' && !unit.path.length)));
    const mobileIdle = idle.filter(unit => !unit.garrison);
    const defenders = mobileIdle.slice(0, Math.min(mobileIdle.length, threatened.length ? Math.ceil(mobileIdle.length * 0.55) : Math.ceil(mobileIdle.length * 0.34)));
    if (threatened.length) {
      for (const unit of defenders) {
        const threat = [...threatened].sort((a, b) => Math.hypot(unit.x - a.x, unit.y - a.y) - Math.hypot(unit.x - b.x, unit.y - b.y))[0];
        if (Math.hypot(unit.x - threat.x, unit.y - threat.y) > 95) {
          this.orderAIMove(unit, threat.x + rand(-35, 35), threat.y + rand(-35, 35));
        } else {
          const enemy = this.nearestEnemy(unit, 260);
          if (enemy) this.orderAIAttack(unit, enemy);
        }
      }
    }

    // Capital garrisons hold their ground and only march when the capital itself is threatened.
    const factionCapital = this.sectorMap.get(FACTIONS[teamId].capital);
    const capitalThreatened = factionCapital?.owner === teamId && threatened.some(sector => sector.id === factionCapital.id);
    for (const unit of units.filter(unit => unit.garrison && unit.order.type === 'idle')) {
      const distance = factionCapital ? Math.hypot(unit.x - factionCapital.x, unit.y - factionCapital.y) : 0;
      if (capitalThreatened) {
        this.orderAIMove(unit, factionCapital.x + rand(-45, 45), factionCapital.y + rand(-45, 45));
      } else if (factionCapital && distance > 160) {
        this.orderAIMove(unit, factionCapital.x + rand(-45, 45), factionCapital.y + rand(-45, 45));
      }
    }

    const attackers = mobileIdle.filter(unit => !defenders.includes(unit));
    for (const unit of attackers) {
      if (this.time < unit.aiRetargetAt && unit.order.type !== 'idle') continue;
      if (unit.order.type !== 'idle') continue;
      const nearbyEnemy = this.nearestEnemy(unit, 360);
      if (nearbyEnemy && Math.random() < 0.35) {
        this.orderAIAttack(unit, nearbyEnemy);
        unit.aiRetargetAt = this.time + rand(7, 13);
        continue;
      }
      const target = this.aiTargetSector(teamId, unit);
      if (target) {
        unit.aiTargetSectorId = target.id;
        unit.aiRetargetAt = this.time + rand(8, 15);
        const ox = rand(-sectorAvoidRadius(target), sectorAvoidRadius(target));
        const oy = rand(-sectorAvoidRadius(target), sectorAvoidRadius(target));
        this.orderAIMove(unit, target.x + ox, target.y + oy);
      }
    }

    // A field marshal's barrage: look for a dense enemy concentration.
    if (this.time >= team.ai.nextBarrageCheck) {
      team.ai.nextBarrageCheck = this.time + rand(24, 40);
      if (this.barrageReadyIn(teamId) <= 0) {
        const cluster = this.findEnemyCluster(teamId);
        if (cluster) {
          this.teams[teamId].barrageReady = this.time + 52;
          for (let i = 0; i < 4; i += 1) {
            this.strikes.push({ x: cluster.x + rand(-65, 65), y: cluster.y + rand(-65, 65), delay: i * 0.4, teamId, radius: 75, damage: 48 });
          }
          this.logEvent(`${FACTIONS[teamId].short} artillery opens a barrage near ${this.nearestPlaceName(cluster.x, cluster.y)}.`, teamId, 'barrage');
        }
      }
    }

    // Make sure a threatened capital is not left naked.
    const capital = this.sectorMap.get(FACTIONS[teamId].capital);
    if (capital?.owner === teamId && threatened.some(sector => sector.id === capital.id)) {
      const guard = idle.find(unit => !defenders.includes(unit));
      if (guard) this.orderAIMove(guard, capital.x + rand(-30, 30), capital.y + rand(-30, 30));
    }
  }

  orderAIMove(unit, x, y) {
    if (unit.dead) return;
    const point = this.clampPoint(x, y);
    unit.order = { type: 'move', x: point.x, y: point.y, auto: true };
    unit.targetId = null;
    unit.digTimer = 0;
    unit.guardX = point.x;
    unit.guardY = point.y;
    this.setUnitPath(unit, point.x, point.y);
  }

  orderAIAttack(unit, target) {
    if (unit.dead || !target || target.dead) return;
    unit.order = { type: 'attack', x: target.x, y: target.y, auto: true };
    unit.targetId = target.id;
    unit.repathTimer = rand(0.2, 0.7);
    if (Math.hypot(unit.x - target.x, unit.y - target.y) > unit.def.range - 8) {
      this.setUnitPath(unit, target.x, target.y);
    }
  }

  nearestEnemy(unit, range) {
    let best = null;
    let bestD = range;
    for (const other of this.units) {
      if (other.dead || other.teamId === unit.teamId) continue;
      const d = Math.hypot(unit.x - other.x, unit.y - other.y);
      if (d < bestD) { best = other; bestD = d; }
    }
    return best;
  }

  findEnemyCluster(teamId) {
    const enemies = this.units.filter(unit => !unit.dead && unit.teamId !== teamId);
    let best = null;
    let bestScore = 0;
    for (const candidate of enemies) {
      let score = 0;
      let cx = 0;
      let cy = 0;
      for (const other of enemies) {
        const d = Math.hypot(candidate.x - other.x, candidate.y - other.y);
        if (d < 90) {
          score += 1;
          cx += other.x;
          cy += other.y;
        }
      }
      const friendlyNear = this.units.some(unit => !unit.dead && unit.teamId === teamId && Math.hypot(unit.x - candidate.x, unit.y - candidate.y) < 100);
      if (!friendlyNear && score >= 3 && score > bestScore) {
        bestScore = score;
        best = { x: cx / score, y: cy / score };
      }
    }
    return best;
  }

  aiTargetSector(teamId, unit) {
    let candidates = this.sectors.filter(sector => sector.owner !== teamId);
    if (!candidates.length) return null;
    const nonCapitals = candidates.filter(sector => !sector.capital);
    if (this.teamSectorCount(teamId) < 6 && nonCapitals.length) {
      candidates = nonCapitals;
    }
    let best = null;
    let bestScore = Infinity;
    for (const sector of candidates) {
      const distance = Math.hypot(unit.x - sector.x, unit.y - sector.y);
      let score = distance * (sector.capital ? 1.18 : 1);
      if (sector.owner === null) score *= 0.72;
      // Great-power politics: weak empires are less tempting, runaway leaders draw coalitions.
      const ownerStrength = sector.owner ? this.teamSectorCount(sector.owner) : 0;
      if (ownerStrength >= 5) score *= 0.82;
      else if (ownerStrength > 0 && ownerStrength <= 2) score *= 1.24;
      score += rand(0, 220);
      if (score < bestScore) { bestScore = score; best = sector; }
    }
    return best;
  }

  clampPoint(x, y) {
    x = clamp(x, 32, WORLD.w - 32);
    y = clamp(y, 32, WORLD.h - 32);
    if (!this.isWalkable(x, y)) return this.nearestWalkable(x, y);
    return { x, y };
  }

  clampCamera() {
    const viewport = this.viewport;
    const halfW = viewport.width / (2 * this.camera.zoom);
    const halfH = viewport.height / (2 * this.camera.zoom);
    const minX = Math.min(halfW, WORLD.w / 2);
    const maxX = Math.max(WORLD.w - halfW, WORLD.w / 2);
    const minY = Math.min(halfH, WORLD.h / 2);
    const maxY = Math.max(WORLD.h - halfH, WORLD.h / 2);
    this.camera.x = clamp(this.camera.x, minX, maxX);
    this.camera.y = clamp(this.camera.y, minY, maxY);
  }

  registerViewport(width, height) {
    this.viewport.width = width;
    this.viewport.height = height;
    this.clampCamera();
  }

  setAudio(audio) {
    this.audio = audio;
  }
}

function sectorAvoidRadius(sector) {
  return Math.max(25, sector.radius * 0.55);
}
