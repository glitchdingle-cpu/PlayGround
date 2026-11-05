// Shared mutable game state. Modules import G and read/write it.
import * as THREE from 'three';
import { SKIRMISH_TIME, DEFAULT_ALLIANCES } from './config.js';

export const G = {
  mode: 'menu',          // menu | playing | paused | over
  timeScale: 1,
  time: 0,
  clockTime: 0,
  frame: 0,
  scene: null,
  camera: null,
  renderer: null,
  shake: 0,
  units: [],
  buildings: [],
  projectiles: [],
  effects: [],
  selection: [],
  flags: [],
  craters: [],
  mines: [],
  nextId: 1,
  player: null,          // {req, income} — the human's shared pool
  aiState: {},           // per AI faction: {req, thinkT, attackT, captureT, sockets}
  playerFaction: 'usa',  // skirmish pick; sandbox controls all
  sandbox: false,
  alliances: { ...DEFAULT_ALLIANCES },
  difficulty: 'officer',
  timeLeft: SKIRMISH_TIME,
  winner: null,
  endReason: '',
  attackMoveMode: false,
  placingBuilding: null, // build key from BUILD_DEFS | null
  placementFaction: null,
  muted: false,
  hoveredEnemy: false,
  selectionDirty: true,
  timers: [],
  stats: null,
  cam: {
    target: new THREE.Vector3(0, 0, 0),
    azimuth: 0,
    dist: 66,
    minDist: 24,
    maxDist: 150,
    pitch: 0.66
  },
  keys: {},
  pointer: { x: 0, y: 0, overCanvas: true, downX: 0, downY: 0, dragging: false },
  toast: null
};

export function isPlayerControlled(faction) {
  if (G.sandbox) return true;
  return faction === G.playerFaction;
}
// Alliance lookup: 'A' and 'B' are rival coalitions; 'ffa' factions are hostile to everyone.
export function areEnemies(f1, f2) {
  if (!f1 || !f2 || f1 === f2) return false;
  const t1 = G.alliances[f1] || 'ffa';
  const t2 = G.alliances[f2] || 'ffa';
  if (t1 === 'ffa' || t2 === 'ffa') return true;
  return t1 !== t2;
}
export function sameTeam(f1, f2) {
  if (f1 === f2) return true;
  const t1 = G.alliances[f1] || 'ffa';
  const t2 = G.alliances[f2] || 'ffa';
  if (t1 === 'ffa' || t2 === 'ffa') return false;
  return t1 === t2;
}

export function resetState() {
  G.time = 0;
  G.clockTime = 0;
  G.frame = 0;
  G.shake = 0;
  G.units = [];
  G.buildings = [];
  G.projectiles = [];
  G.effects = [];
  G.selection = [];
  G.flags = [];
  G.craters = [];
  G.mines = [];
  G.nextId = 1;
  G.winner = null;
  G.endReason = '';
  G.attackMoveMode = false;
  G.placingBuilding = null;
  G.placementFaction = null;
  G.timeScale = 1;
  G.timers = [];
  G.aiState = {};
  G.timeLeft = SKIRMISH_TIME;
  G.cam.target.set(0, 0, 0);
  G.cam.azimuth = 0;
  G.cam.dist = 80;
  G.selectionDirty = true;
  G.stats = { perFaction: {} };
  for (const f of ['usa', 'ussr', 'germany', 'japan', 'france']) {
    G.stats.perFaction[f] = { kills: 0, unitsLost: 0, buildingsLost: 0, buildingsDestroyed: 0, unitsTrained: 0, flagsCaptured: 0 };
  }
}
