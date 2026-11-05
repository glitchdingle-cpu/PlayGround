// Axis AI commander: build orders, training priorities, capture play, attack waves.
import { G } from './state.js';
import { DIFFICULTY, BUILDING_DEFS, UNIT_DEFS } from './config.js';
import { spawnBuilding } from './commands.js';
import { feedEvent } from './feed.js';
import { audio } from './audio.js';

const AXIS_SOCKETS = [
  { x: 64, z: -43, kind: 'barracks' },
  { x: 89, z: -37, kind: 'factory' },
  { x: 59, z: -68, kind: 'barracks' },
  { x: 93, z: -73, kind: 'factory' }
];

export function initAI() {
  for (const s of AXIS_SOCKETS) delete s.used;
  const attackT = G.difficulty === 'marshal' ? 70 : G.difficulty === 'cadet' ? 125 : 95;
  G.ai = { thinkT: 0.5, attackT, captureT: 8 };
}

const axisUnits = () => G.units.filter(u => u.side === 'axis');
const aisBuildings = () => G.buildings.filter(b => b.side === 'axis');
const countType = (list, type) => list.filter(u => u.type === type).length;

export function updateAI(dt) {
  const ai = G.ai;
  if (!ai) return;
  ai.thinkT -= dt;
  ai.attackT -= dt;
  ai.captureT -= dt;
  if (ai.thinkT <= 0) { ai.thinkT = 1.0; think(); }
  if (ai.captureT <= 0) { ai.captureT = 14; assignCapture(); }
  if (ai.attackT <= 0) tryAttack();
}

function think() {
  const req = G.axis.req;
  const buildings = aisBuildings();
  const queueCount = (b) => b.queue.length;
  const barracks = buildings.filter(b => b.type === 'barracks');
  const factories = buildings.filter(b => b.type === 'factory');
  const pendingKinds = buildings.filter(b => b.buildProgress < 1).map(b => b.type);
  const maxBarracks = G.difficulty === 'cadet' ? 1 : 2;
  const maxFactories = G.difficulty === 'marshal' ? 2 : 1;
  const ai = G.ai;

  const pendingB = pendingKinds.filter(k => k === 'barracks').length;
  const pendingF = pendingKinds.filter(k => k === 'factory').length;

  // --- Construction: barracks #1 -> factory(ies) -> extra barracks
  if (barracks.length + pendingB < 1 && req >= BUILDING_DEFS.barracks.cost + 30) {
    const socket = AXIS_SOCKETS.find(s => s.kind === 'barracks' && !s.used);
    if (socket) { socket.used = true; spawnBuilding('axis', 'barracks', socket.x, socket.z, false); G.axis.req -= BUILDING_DEFS.barracks.cost; return; }
  }
  if (factories.length + pendingF < maxFactories && barracks.length >= 1 && req >= BUILDING_DEFS.factory.cost + 20) {
    const socket = AXIS_SOCKETS.find(s => s.kind === 'factory' && !s.used);
    if (socket) { socket.used = true; spawnBuilding('axis', 'factory', socket.x, socket.z, false); G.axis.req -= BUILDING_DEFS.factory.cost; return; }
  }
  if (barracks.length + pendingB < maxBarracks && factories.length >= 1 && req >= BUILDING_DEFS.barracks.cost + 30) {
    const socket = AXIS_SOCKETS.find(s => s.kind === 'barracks' && !s.used);
    if (socket) { socket.used = true; spawnBuilding('axis', 'barracks', socket.x, socket.z, false); G.axis.req -= BUILDING_DEFS.barracks.cost; return; }
  }

  // --- Training (cap infantry hard until the factory exists)
  const units = axisUnits();
  const saveForFactory = factories.length === 0 && barracks.length >= 1;
  for (const b of buildings) {
    if (b.buildProgress < 1 || queueCount(b) >= 2) continue;
    if (b.type === 'barracks') {
      const rifles = countType(units, 'rifle');
      const recons = countType(units, 'recon');
      const wantRifles = saveForFactory ? 5 : (G.difficulty === 'cadet' ? 4 : 7);
      if (rifles < wantRifles && G.axis.req >= UNIT_DEFS.rifle.cost) {
        enqueue(b, 'rifle');
      } else if (!saveForFactory && recons < 3 && G.axis.req >= UNIT_DEFS.recon.cost && Math.random() < 0.6) {
        enqueue(b, 'recon');
      } else if (!saveForFactory && G.axis.req > 640 && rifles < 14) {
        enqueue(b, 'rifle');
      }
    } else if (b.type === 'factory') {
      const tanks = countType(units, 'tank');
      const arty = countType(units, 'arty');
      if (G.axis.req >= UNIT_DEFS.tank.cost) {
        if (tanks >= 2 && arty * 2 < tanks && G.axis.req >= UNIT_DEFS.arty.cost && Math.random() < 0.62) {
          enqueue(b, 'arty');
        } else {
          enqueue(b, 'tank');
        }
      }
    }
  }
}

function enqueue(b, type) {
  const def = UNIT_DEFS[type];
  if (G.axis.req < def.cost) return;
  G.axis.req -= def.cost;
  b.queue.push({ type, t: def.buildTime, total: def.buildTime });
}

function assignCapture() {
  // Send up to 3 idle troops to the nearest non-Axis flag
  const targets = G.flags.filter(f => f.owner !== 'axis');
  if (!targets.length) return;
  const base = { x: 78, z: -60 };
  targets.sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
  const flag = targets[0];
  const candidates = axisUnits()
    .filter(u => (u.type === 'rifle' || u.type === 'recon') && u.order.kind === 'idle')
    .slice(0, 3);
  for (const u of candidates) {
    u.order = { kind: 'attackmove', x: flag.x, z: flag.z };
    u.anchor = { x: flag.x, z: flag.z };
  }
}

function tryAttack() {
  const d = DIFFICULTY[G.difficulty];
  const military = axisUnits();
  if (military.length >= d.aiAggro) {
    const hq = G.buildings.find(b => b.side === 'player' && b.type === 'hq') || G.buildings.find(b => b.side === 'player');
    if (hq) {
      for (const u of military) {
        u.order = { kind: 'attackmove', x: hq.group.position.x, z: hq.group.position.z };
        u.anchor = { x: hq.group.position.x, z: hq.group.position.z };
      }
      feedEvent('Enemy armor is advancing on your position!', 'axis');
      audio.alarm();
      G.ai.attackT = G.difficulty === 'marshal' ? 55 : G.difficulty === 'officer' ? 75 : 100;
      return;
    }
  }
  G.ai.attackT = 14;
}
