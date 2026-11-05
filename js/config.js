// Static game data: factions, units, buildings, map layout, difficulty.
export const MAP_SIZE = 240;

export const FLAT_ZONES = [
  { x: -78, z: 60, r: 27 },   // Allied HQ
  { x: 78, z: -60, r: 27 },   // Axis HQ
  { x: 0, z: 0, r: 13 },      // Flag A
  { x: 27.5, z: 35.6, r: 11 },// Flag B
  { x: -27.5, z: -35.6, r: 11 } // Flag C
];

export const ROAD_POINTS = [
  { x: -78, z: 60 }, { x: -52, z: 41 }, { x: -27.5, z: 24 }, { x: 0, z: 0 },
  { x: 27, z: -21 }, { x: 50, z: -40 }, { x: 78, z: -60 }
];

export const CAPTURE_POINTS = [
  { id: 'A', x: 0, z: 0, label: 'Hill 400' },
  { id: 'B', x: 27.5, z: 35.6, label: 'Crossroads South' },
  { id: 'C', x: -27.5, z: -35.6, label: 'Ridge North' }
];

export const PLAYER_BASE = { x: -78, z: 60 };
export const AXIS_BASE = { x: 78, z: -60 };

export const FACTIONS = {
  player: {
    id: 'player', name: 'United States Army', short: 'US',
    color: 0x4c5133, dark: 0x33371f, accent: 0xe8e4d0, track: 0x2a2a26,
    uiColor: '#9dc08b', insignia: 'star',
    units: { rifle: 'Rifle Squad', recon: 'Recon Jeep', tank: 'M4 Sherman', arty: 'M2 105mm Howitzer' }
  },
  axis: {
    id: 'axis', name: 'Wehrmacht', short: 'GER',
    color: 0x596066, dark: 0x3a4046, accent: 0x151515, track: 0x23211f,
    uiColor: '#d97b5a', insignia: 'cross',
    units: { rifle: 'Volksgrenadier Squad', recon: 'Kübelwagen', tank: 'Panzer IV', arty: '10.5cm leFH Artillery' }
  }
};

export const UNIT_DEFS = {
  rifle: {
    kind: 'infantry', cost: 100, buildTime: 6, hp: 130, speed: 5.4, radius: 1.7,
    range: 23, sight: 33, damage: 9, reload: 1.15, spread: 1.6,
    vsSoft: 1.0, vsHard: 0.22, barY: 1.9, supply: 1
  },
  recon: {
    kind: 'vehicle', cost: 140, buildTime: 8, hp: 95, speed: 11.6, radius: 1.55,
    range: 21, sight: 45, damage: 7, reload: 0.7, spread: 1.8,
    vsSoft: 0.9, vsHard: 0.3, barY: 2.1, supply: 1
  },
  tank: {
    kind: 'armor', cost: 260, buildTime: 14, hp: 370, speed: 7.4, radius: 2.45,
    range: 30, sight: 37, damage: 48, reload: 2.6, spread: 0.9,
    vsSoft: 0.7, vsHard: 1.28, barY: 3.1, supply: 3
  },
  arty: {
    kind: 'artillery', cost: 300, buildTime: 16, hp: 125, speed: 4.6, radius: 2.1,
    range: 66, minRange: 17, sight: 42, damage: 88, reload: 5.2, spread: 2.2,
    vsSoft: 1.55, vsHard: 0.62, barY: 2.6, aoe: 6.5, supply: 2
  }
};

export const BUILDING_DEFS = {
  hq: {
    name: 'Headquarters', hp: 1600, radius: 6.2, cost: 0, buildTime: 0,
    desc: 'The heart of your command. Lose it and the battle is over.'
  },
  barracks: {
    name: 'Barracks', hp: 720, radius: 4.6, cost: 220, buildTime: 18,
    trains: ['rifle', 'recon'],
    desc: 'Trains infantry squads and recon vehicles.'
  },
  factory: {
    name: 'War Factory', hp: 950, radius: 5.4, cost: 380, buildTime: 26,
    trains: ['tank', 'arty'],
    desc: 'Produces medium tanks and field artillery.'
  }
};

export const ECONOMY = {
  startReq: 320,
  baseIncome: 5,       // per second
  captureIncome: 4,    // per second per flag held
  unitCap: 46,
  trickle: 1
};

export const DIFFICULTY = {
  cadet:   { label: 'Cadet',   desc: 'Relaxed pace. Weak enemy economy.', aiIncome: 0.7, aiAggro: 16, hpMul: 0.8 },
  officer: { label: 'Officer', desc: 'A fair fight. Balanced enemy.',     aiIncome: 1.0, aiAggro: 11, hpMul: 1.0 },
  marshal: { label: 'Marshal', desc: 'Relentless elite Wehrmacht.',       aiIncome: 1.35, aiAggro: 8, hpMul: 1.25 }
};

export const SKIRMISH_TIME = 15 * 60; // 15:00 — victory by HQ HP% at timeout otherwise
