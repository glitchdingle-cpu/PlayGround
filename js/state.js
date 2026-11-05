// Shared mutable game state. Modules import G and read/write it.
import * as THREE from 'three';
import { SKIRMISH_TIME } from './config.js';

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
  nextId: 1,
  player: null,          // {req, income, faction, stats...}
  axis: null,
  difficulty: 'officer',
  timeLeft: 900,
  winner: null,
  endReason: '',
  stats: null,
  attackMoveMode: false,
  placingBuilding: null, // 'barracks' | 'factory' | null
  muted: false,
  hoveredEnemy: false,
  selectionDirty: true,
  timers: [],
  stats: null,
  ai: null,
  cam: {
    target: new THREE.Vector3(-78, 0, 60),
    azimuth: Math.PI * 1.25,   // looking from south-west toward north-east
    dist: 66,
    minDist: 26,
    maxDist: 120,
    pitch: 0.92                 // radians above horizon-ish elevation factor
  },
  keys: {},
  pointer: { x: 0, y: 0, overCanvas: true, downX: 0, downY: 0, dragging: false },
  toast: null
};

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
  G.nextId = 1;
  G.winner = null;
  G.endReason = '';
  G.attackMoveMode = false;
  G.placingBuilding = null;
  G.timeScale = 1;
  G.timers = [];
  G.ai = null;
  G.selectionDirty = true;
  G.timeLeft = SKIRMISH_TIME;
  G.cam.target.set(-78, 0, 60);
  G.cam.azimuth = -Math.PI / 4;
  G.cam.dist = 62;
  G.stats = {
    player: { kills: 0, unitsLost: 0, buildingsLost: 0, buildingsDestroyed: 0, unitsTrained: 0, flagsCaptured: 0 },
    axis:   { kills: 0, unitsLost: 0, buildingsLost: 0, buildingsDestroyed: 0, unitsTrained: 0, flagsCaptured: 0 }
  };
}
