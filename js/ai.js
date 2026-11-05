// AI commanders for every non-player faction: build orders, training, capture play, assault waves.
import { G, areEnemies, isPlayerControlled } from './state.js';
import { DIFFICULTY, UNIT_DEFS, BUILD_DEFS, FACTION_IDS, BASES, ECONOMY } from './config.js';
import { spawnBuilding, trySpend } from './commands.js';
import { feedEvent } from './feed.js';
import { audio } from './audio.js';

const SOCKET_OFFSETS = [
  { dx: -15, dz: 9, kind: 'barracks' },
  { dx: 15, dz: -9, kind: 'factory' },
  { dx: -8, dz: -15, kind: 'barracks' },
  { dx: 14, dz: 13, kind: 'factory' }
];

export function initAI(faction) {
  const base = BASES[faction];
  const attackT = G.difficulty === 'marshal' ? 75 : G.difficulty === 'cadet' ? 135 : 100;
  G.aiState[faction] = {
    faction,
    req: ECONOMY.startReq * 0.9,
    income: ECONOMY.baseIncome,
    base,
    thinkT: 0.5 + Math.random(),
    attackT,
    captureT: 6 + Math.random() * 4,
    socketIdx: 0
  };
}

const factionUnits = (f) => G.units.filter(u => u.faction === f);
const factionBuildings = (f) => G.buildings.filter(b => b.faction === f);
const countType = (list, type) => list.filter(u => u.type === type).length;

export function updateAI(dt) {
  for (const faction of Object.keys(G.aiState)) {
    if (isPlayerControlled(faction)) continue; // defensive — shouldn't happen
    const ai = G.aiState[faction];
    ai.thinkT -= dt;
    ai.attackT -= dt;
    ai.captureT -= dt;
    if (ai.thinkT <= 0) { ai.thinkT = 1.1; think(faction); }
    if (ai.captureT <= 0) { ai.captureT = 14; assignCapture(faction); }
    if (ai.attackT <= 0) tryAttack(faction);
  }
}

function think(faction) {
  const ai = G.aiState[faction];
  const buildings = factionBuildings(faction);
  const units = factionUnits(faction);
  const barracks = buildings.filter(b => b.type === 'barracks');
  const factories = buildings.filter(b => b.type === 'factory');
  const pending = buildings.filter(b => b.buildProgress < 1).map(b => b.type);
  const pendingB = pending.filter(k => k === 'barracks').length;
  const pendingF = pending.filter(k => k === 'factory').length;
  const maxBarracks = G.difficulty === 'cadet' ? 1 : 2;
  const maxFactories = G.difficulty === 'marshal' ? 2 : 1;

  // --- Construction: barracks #1 -> factory -> extra barracks
  if (barracks.length + pendingB < 1) {
    if (tryBuild(faction, 'barracks', 0)) return;
  }
  if (factories.length + pendingF < maxFactories && barracks.length >= 1) {
    if (tryBuild(faction, 'factory', 1)) return;
  }
  if (barracks.length + pendingB < maxBarracks && factories.length >= 1) {
    if (tryBuild(faction, 'barracks', 2)) return;
  }
  if (factories.length + pendingF < maxFactories && barracks.length >= 2 && G.difficulty === 'marshal') {
    if (tryBuild(faction, 'factory', 3)) return;
  }
  // Fortify the home front once the war machine rolls (MG nest near HQ)
  if (factories.length >= 1 && ai.req > 520 && !buildings.some(b => b.type === 'mg_nest')) {
    const nestX = ai.base.x + (Math.random() - 0.5) * 8, nestZ = ai.base.z + (Math.random() - 0.5) * 8;
    if (trySpend(faction, BUILD_DEFS.mg_nest.cost)) {
      spawnBuilding(faction, 'mg_nest', nestX, nestZ, false);
      return;
    }
  }

  // --- Training (cap infantry until the factory exists)
  const saveForFactory = factories.length === 0 && barracks.length >= 1;
  for (const b of buildings) {
    if (b.buildProgress < 1 || b.queue.length >= 2) continue;
    if (b.type === 'barracks') {
      const rifles = countType(units, 'rifle');
      const recons = countType(units, 'recon');
      const wantRifles = saveForFactory ? 5 : (G.difficulty === 'cadet' ? 4 : 7);
      if (rifles < wantRifles && trySpend(faction, UNIT_DEFS.rifle.cost)) {
        b.queue.push({ type: 'rifle', t: UNIT_DEFS.rifle.buildTime, total: UNIT_DEFS.rifle.buildTime });
      } else if (!saveForFactory && recons < 3 && Math.random() < 0.6 && trySpend(faction, UNIT_DEFS.recon.cost)) {
        b.queue.push({ type: 'recon', t: UNIT_DEFS.recon.buildTime, total: UNIT_DEFS.recon.buildTime });
      } else if (!saveForFactory && ai.req > 640 && rifles < 14 && trySpend(faction, UNIT_DEFS.rifle.cost)) {
        b.queue.push({ type: 'rifle', t: UNIT_DEFS.rifle.buildTime, total: UNIT_DEFS.rifle.buildTime });
      }
    } else if (b.type === 'factory') {
      const tanks = countType(units, 'tank');
      const arty = countType(units, 'arty');
      if (trySpend(faction, UNIT_DEFS.tank.cost)) {
        if (tanks >= 2 && arty * 2 < tanks && Math.random() < 0.62 && trySpendBonus(faction, UNIT_DEFS.arty.cost - UNIT_DEFS.tank.cost)) {
          b.queue.push({ type: 'arty', t: UNIT_DEFS.arty.buildTime, total: UNIT_DEFS.arty.buildTime });
        } else {
          b.queue.push({ type: 'tank', t: UNIT_DEFS.tank.buildTime, total: UNIT_DEFS.tank.buildTime });
        }
      }
    }
  }
}

// Bonus spend for arty upgrade (tank already paid, top up the difference)
function trySpendBonus(faction, cost) {
  if (cost <= 0) return true;
  return trySpend(faction, cost);
}

function tryBuild(faction, kind, socketIndex) {
  const socket = SOCKET_OFFSETS[socketIndex];
  const def = BUILD_DEFS[kind];
  if (!socket || !trySpend(faction, def.cost)) return false;
  const b = BASES[faction];
  spawnBuilding(faction, kind, b.x + socket.dx, b.z + socket.dz, false);
  return true;
}

function assignCapture(faction) {
  // Send up to 3 idle troops to the nearest flag this faction doesn't hold
  const targets = G.flags.filter(f => f.owner !== faction);
  if (!targets.length) return;
  const base = BASES[faction];
  targets.sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z));
  const flag = targets[0];
  const candidates = factionUnits(faction)
    .filter(u => (u.type === 'rifle' || u.type === 'recon') && u.order.kind === 'idle')
    .slice(0, 3);
  for (const u of candidates) {
    u.order = { kind: 'attackmove', x: flag.x, z: flag.z };
    u.anchor = { x: flag.x, z: flag.z };
  }
}

function hostileHQs(faction) {
  return G.buildings.filter(b => b.type === 'hq' && areEnemies(faction, b.faction));
}

function tryAttack(faction) {
  const d = DIFFICULTY[G.difficulty];
  const military = factionUnits(faction);
  if (military.length >= d.aiAggro) {
    const hqs = hostileHQs(faction);
    hqs.sort((a, b) => {
      const pa = a.group.position, pb = b.group.position, base = BASES[faction];
      return Math.hypot(pa.x - base.x, pa.z - base.z) - Math.hypot(pb.x - base.x, pb.z - base.z);
    });
    const target = hqs[0];
    if (target) {
      for (const u of military) {
        u.order = { kind: 'attackmove', x: target.group.position.x, z: target.group.position.z };
        u.anchor = { x: target.group.position.x, z: target.group.position.z };
      }
      if (military.some(u => u.type === 'tank')) {
        feedEvent('Enemy armour is advancing on your position!', faction);
      } else {
        feedEvent('Enemy infantry advance on your position!', faction);
      }
      audio.alarm();
      const ai = G.aiState[faction];
      ai.attackT = G.difficulty === 'marshal' ? 60 : G.difficulty === 'officer' ? 80 : 105;
      return;
    }
  }
  G.aiState[faction].attackT = 15;
}
