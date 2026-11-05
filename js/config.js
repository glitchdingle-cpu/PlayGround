// Static game data: 5 factions, map layout, alliance presets, 50 buildables, difficulty, economy.
export const MAP_SIZE = 320;

// ---------- 5 Factions ----------
export const FACTIONS = {
  usa: {
    id: 'usa', name: 'United States', short: 'USA', adjective: 'American',
    color: 0x4c5133, dark: 0x33371f, accent: 0xece8d8, track: 0x2a2a26,
    uiColor: '#9dc08b', ring: 0x8be06a, dot: '#a8d088', insignia: 'star',
    units: { rifle: 'Rifle Squad', recon: 'Recon Jeep', tank: 'M4 Sherman', arty: 'M2 105mm Howitzer' },
    hqName: 'US Headquarters'
  },
  ussr: {
    id: 'ussr', name: 'Soviet Union', short: 'USSR', adjective: 'Soviet',
    color: 0x5a3a2e, dark: 0x3f2820, accent: 0xd8c25a, track: 0x211a16,
    uiColor: '#e07a5a', ring: 0xff6a5a, dot: '#ff8a6a', insignia: 'soviet',
    units: { rifle: 'Rifle Platoon', recon: 'GAZ-67 Scout', tank: 'T-34/85', arty: '122mm M-30 Howitzer' },
    hqName: 'Soviet Headquarters'
  },
  germany: {
    id: 'germany', name: 'Germany', short: 'GER', adjective: 'German',
    color: 0x596066, dark: 0x3a4046, accent: 0x151515, track: 0x23211f,
    uiColor: '#d0d0d0', ring: 0xe0e0e0, dot: '#e8e8e8', insignia: 'cross',
    units: { rifle: 'Volksgrenadier Squad', recon: 'Kübelwagen', tank: 'Panzer IV', arty: '10.5cm leFH' },
    hqName: 'German Headquarters'
  },
  japan: {
    id: 'japan', name: 'Imperial Japan', short: 'JPN', adjective: 'Japanese',
    color: 0x6b5a34, dark: 0x463a20, accent: 0xc8433a, track: 0x2e2416,
    uiColor: '#ffb060', ring: 0xffa040, dot: '#ffc060', insignia: 'sun',
    units: { rifle: 'Type 99 Squad', recon: 'Type 95 Scout Car', tank: 'Chi-Ha Kai', arty: 'Type 92 Battalion Gun' },
    hqName: 'Imperial Headquarters'
  },
  france: {
    id: 'france', name: 'Free France', short: 'FRA', adjective: 'French',
    color: 0x3f4c66, dark: 0x2a3448, accent: 0xd8d5c8, track: 0x1f2430,
    uiColor: '#6aa8ff', ring: 0x5aa8ff, dot: '#8ac0ff', insignia: 'lorraine',
    units: { rifle: 'Tirailleurs Squad', recon: 'Laffly Scout Car', tank: 'SOMUA S35', arty: '105mm Mle 1930' },
    hqName: 'Free French Headquarters'
  }
};
export const FACTION_IDS = Object.keys(FACTIONS);

export const ARENA_RADIUS = 84;   // HQ placement radius from map centre
// Base angles (radians) — pentagon vertices, west first anti-clockwise
export const BASE_ANGLES = { usa: Math.PI, france: Math.PI * 0.62, ussr: Math.PI * 0.2, japan: -Math.PI * 0.2, germany: -Math.PI * 0.62 };
export const BASES = Object.fromEntries(Object.entries(BASE_ANGLES).map(([f, a]) => [
  f, { x: Math.round(Math.cos(a) * ARENA_RADIUS), z: Math.round(Math.sin(a) * ARENA_RADIUS) }
]));

// Flatten radius per HQ + flag
export const FLAT_ZONES = [
  ...Object.values(BASES).map(b => ({ x: b.x, z: b.z, r: 24 })),
  { x: -37, z: 27, r: 11 }, { x: 14, z: 43, r: 11 }, { x: 45, z: 0, r: 11 }, { x: 14, z: -43, r: 11 }, { x: -37, z: -27, r: 11 }
];

// Five spokes to the map centre
export const ROADS = Object.values(BASES).map(b => [
  b,
  { x: b.x * 0.68 + 6, z: b.z * 0.68 },
  { x: b.x * 0.4 - 4, z: b.z * 0.4 },
  { x: 0, z: 0 }
]);
// Backwards compat alias (world.js uses these)
export const ROAD_POINTS = ROADS[0];

export const CAPTURE_POINTS = [
  { id: 'A', x: -37, z: 27, label: 'Crossroads' },
  { id: 'B', x: 14, z: 43, label: 'Hill 400' },
  { id: 'C', x: 45, z: 0, label: 'Ridge East' },
  { id: 'D', x: 14, z: -43, label: 'Ford South' },
  { id: 'E', x: -37, z: -27, label: 'Monastery Hill' }
];

// ---------- Alliance presets (A-team vs B-team; 'ffa' = everyone hostile to everyone) ----------
export const ALLIANCE_PRESETS = [
  { id: 'historic', label: 'Allies vs Axis', desc: 'USA · USSR · France against Germany · Japan', map: { usa: 'A', ussr: 'A', france: 'A', germany: 'B', japan: 'B' } },
  { id: 'germanyJapan', label: 'Axis Survival', desc: 'Germany · Japan against the world', map: { germany: 'A', japan: 'A', usa: 'B', ussr: 'B', france: 'B' } },
  { id: 'germanyUsa', label: 'Germany & USA', desc: 'The Atlantic Accord — Germany and USA together', map: { germany: 'A', usa: 'A', ussr: 'B', japan: 'B', france: 'B' } },
  { id: 'ussrJapan', label: 'USSR & Japan', desc: 'A continental pact — Russia and Japan together', map: { ussr: 'A', japan: 'A', usa: 'B', germany: 'B', france: 'B' } },
  { id: 'ffa', label: 'Free For All', desc: 'Five powers, no friends — last HQ standing', map: { usa: 'ffa', ussr: 'ffa', germany: 'ffa', japan: 'ffa', france: 'ffa' } }
];
export const DEFAULT_ALLIANCES = { ...ALLIANCE_PRESETS[0].map };

// ---------- Units ----------
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

// ---------- Buildings & 50 buildables ----------
// BUILD_DEFS: every placeable structure, incl. barracks & war factory.
// Categories: production | fortification | emplacement | support | camp
export const BUILD_DEFS = {
  // ---- Production (2) ----
  barracks: { name: 'Barracks', cat: 'production', cost: 220, buildTime: 18, hp: 720, radius: 4.6, trains: ['rifle', 'recon'], mesh: 'barracks', desc: 'Trains infantry squads and recon vehicles.' },
  factory:  { name: 'War Factory', cat: 'production', cost: 380, buildTime: 26, hp: 950, radius: 5.4, trains: ['tank', 'arty'], mesh: 'factory', desc: 'Produces medium tanks and field artillery.' },

  // ---- Fortifications (20) ----
  sandbag_line:  { name: 'Sandbag Line', cat: 'fortification', cost: 40, buildTime: 6, hp: 175, radius: 3.1, mesh: 'sandbag_line', desc: 'A straight wall of filled sandbags.' },
  sandbag_curve: { name: 'Sandbag Curve', cat: 'fortification', cost: 45, buildTime: 6, hp: 175, radius: 3.4, mesh: 'sandbag_curve', desc: 'Curved sandbag emplacement.' },
  sandbag_revetment: { name: 'Sandbag Revetment', cat: 'fortification', cost: 50, buildTime: 7, hp: 190, radius: 3.4, mesh: 'sandbag_revetment', desc: 'Angled revetment protecting a firing position.' },
  sandbag_foxhole:{ name: 'Sandbag Foxhole', cat: 'fortification', cost: 35, buildTime: 5, hp: 120, radius: 2.1, mesh: 'sandbag_foxhole', desc: 'Ring of sandbags sheltering infantry.' },
  sandbag_pyramid:{ name: 'Sandbag Pyramid', cat: 'fortification', cost: 30, buildTime: 4, hp: 165, radius: 1.9, mesh: 'sandbag_pyramid', desc: 'A stacked pyramid of sandbags.' },
  log_wall:   { name: 'Log Wall', cat: 'fortification', cost: 55, buildTime: 8, hp: 215, radius: 3.0, mesh: 'log_wall', desc: 'Timber beams stacked into a tough barrier.' },
  crate_wall: { name: 'Crate Wall', cat: 'fortification', cost: 30, buildTime: 4, hp: 120, radius: 2.7, mesh: 'crate_wall', desc: 'Stacked supply crates. Cheap and fast.' },
  tire_stack: { name: 'Tire Stack', cat: 'fortification', cost: 35, buildTime: 4, hp: 150, radius: 2.2, mesh: 'tire_stack', desc: 'Stacked rubber tires — surprisingly resilient.' },
  concrete_wall: { name: 'Concrete Wall', cat: 'fortification', cost: 120, buildTime: 14, hp: 470, radius: 3.2, mesh: 'concrete_wall', desc: 'Pre-cast reinforced concrete barrier.' },
  steel_wall: { name: 'Steel Plate Wall', cat: 'fortification', cost: 100, buildTime: 12, hp: 350, radius: 3.0, mesh: 'steel_wall', desc: 'Bolted steel plates. Shrugs off shellfire.' },
  stone_wall: { name: 'Stone Wall', cat: 'fortification', cost: 75, buildTime: 10, hp: 300, radius: 3.0, mesh: 'stone_wall', desc: 'Dry-stone wall, Ardennes style.' },
  rubble_mound:{ name: 'Rubble Mound', cat: 'fortification', cost: 70, buildTime: 9, hp: 280, radius: 3.3, mesh: 'rubble_mound', desc: 'Spoil and masonry heaped into cover.' },
  dragons_teeth:{ name: "Dragon's Teeth", cat: 'fortification', cost: 90, buildTime: 11, hp: 520, radius: 3.6, mesh: 'dragons_teeth', blockVehicles: true, desc: 'Concrete teeth that halt armour dead.' },
  hedgehog:   { name: 'Czech Hedgehog', cat: 'fortification', cost: 65, buildTime: 8, hp: 390, radius: 2.6, mesh: 'hedgehog', blockVehicles: true, desc: 'Crossed steel beams. Cheap tank stopper.' },
  barbed_wire:{ name: 'Barbed Wire', cat: 'fortification', cost: 25, buildTime: 3, hp: 95, radius: 3.0, mesh: 'barbed_wire', snare: { radius: 3.4, speedMul: 0.5 }, desc: 'Tangles and slows infantry crossing it.' },
  minefield:  { name: 'Minefield', cat: 'fortification', cost: 80, buildTime: 6, hp: 40, radius: 3.0, mesh: 'minefield', mine: { charges: 4, damage: 120, aoe: 4.6 }, desc: 'Four anti-personnel mines. Step carefully.' },
  barrel_cluster:{ name: 'Explosive Barrels', cat: 'fortification', cost: 60, buildTime: 5, hp: 70, radius: 2.4, mesh: 'barrel_cluster', explosive: { damage: 150, aoe: 4.2 }, desc: 'Fuel barrels. Devastating when they go up.' },
  camo_screen:{ name: 'Camo Net Screen', cat: 'fortification', cost: 20, buildTime: 3, hp: 60, radius: 3.0, mesh: 'camo_screen', desc: 'Concealment netting between posts.' },
  trench_line:{ name: 'Trench Line', cat: 'fortification', cost: 60, buildTime: 8, hp: 235, radius: 3.4, mesh: 'trench_line', desc: 'Dug earthworks with sandbagged parapet.' },
  dugout:     { name: 'Dugout', cat: 'fortification', cost: 85, buildTime: 10, hp: 275, radius: 2.6, mesh: 'dugout', desc: 'Timbered shelter dug into the hillside.' },

  // ---- Emplacements (8) ----
  mg_nest:    { name: 'MG Nest', cat: 'emplacement', cost: 110, buildTime: 12, hp: 150, radius: 2.6, mesh: 'mg_nest', weapon: { damage: 7, range: 30, sight: 30, reload: 0.55, spread: 1.3, vsSoft: 1.3, vsHard: 0.12, kind: 'mg', minRange: 0 }, desc: 'Concealed machine-gun position.' },
  sniper_hide:{ name: 'Sniper Hide', cat: 'emplacement', cost: 95, buildTime: 10, hp: 110, radius: 2.2, mesh: 'sniper_hide', weapon: { damage: 26, range: 46, sight: 46, reload: 2.3, spread: 0.8, vsSoft: 3.4, vsHard: 0.1, kind: 'mg', minRange: 0 }, desc: 'Long-range precision fire.' },
  mg_bunker:  { name: 'Machine Gun Bunker', cat: 'emplacement', cost: 220, buildTime: 22, hp: 500, radius: 3.6, mesh: 'pillbox_mg', weapon: { damage: 8, range: 33, sight: 33, reload: 0.6, spread: 1.1, vsSoft: 1.4, vsHard: 0.14, kind: 'mg', minRange: 0 }, desc: 'Armored casemate with MG.' },
  at_pit:     { name: 'Anti-Tank Gun Pit', cat: 'emplacement', cost: 160, buildTime: 16, hp: 180, radius: 3.0, mesh: 'at_pit', weapon: { damage: 66, range: 34, sight: 34, reload: 3.3, spread: 0.9, vsSoft: 0.25, vsHard: 2.3, kind: 'ap', minRange: 0 }, desc: 'Dug-in 37/47mm anti-tank gun.' },
  at_bunker:  { name: 'AT Bunker', cat: 'emplacement', cost: 300, buildTime: 30, hp: 680, radius: 4.0, mesh: 'pillbox_at', weapon: { damage: 74, range: 36, sight: 36, reload: 3.1, spread: 0.8, vsSoft: 0.25, vsHard: 2.6, kind: 'ap', minRange: 0 }, desc: 'Armored casemate with AT gun.' },
  cannon_pit: { name: 'Field Cannon Pit', cat: 'emplacement', cost: 240, buildTime: 24, hp: 230, radius: 3.4, mesh: 'cannon_pit', weapon: { damage: 58, range: 47, minRange: 10, sight: 38, reload: 3.7, spread: 2.0, vsSoft: 1.5, vsHard: 0.7, kind: 'he', aoe: 3.8 }, desc: 'Entrenched gun with plunging fire.' },
  heavy_pillbox: { name: 'Heavy Pillbox', cat: 'emplacement', cost: 420, buildTime: 36, hp: 850, radius: 4.6, mesh: 'pillbox_heavy', weapon: { damage: 10, range: 36, sight: 36, reload: 0.5, spread: 1.0, vsSoft: 1.5, vsHard: 0.22, kind: 'mg', minRange: 0 }, desc: 'Concrete fortress. Slow to kill, slower to miss.' },
  command_bunker: { name: 'Command Bunker', cat: 'emplacement', cost: 380, buildTime: 32, hp: 640, radius: 4.2, mesh: 'pillbox_hq', weapon: { damage: 8, range: 34, sight: 34, reload: 0.6, spread: 1.0, vsSoft: 1.3, vsHard: 0.15, kind: 'mg', minRange: 0 }, aura: { kind: 'damage', radius: 30, mult: 1.08 }, desc: 'Forward command post. Rails the defence.' },

  // ---- Support (9) ----
  field_hospital: { name: 'Field Hospital', cat: 'support', cost: 180, buildTime: 18, hp: 320, radius: 3.2, mesh: 'hospital', aura: { kind: 'healInfantry', radius: 26, rate: 4.2 }, desc: 'Aid tent. Infantry within mend themselves.' },
  field_workshop: { name: 'Field Workshop', cat: 'support', cost: 220, buildTime: 20, hp: 340, radius: 3.4, mesh: 'workshop', aura: { kind: 'healVehicle', radius: 26, rate: 5.2 }, desc: 'Recovery depot. Vehicles repaired in range.' },
  watchtower: { name: 'Watchtower', cat: 'support', cost: 140, buildTime: 14, hp: 210, radius: 1.8, mesh: 'tower', aura: { kind: 'damage', radius: 30, mult: 1.12 }, desc: 'Tall spotter tower. +12% fire for nearby units.' },
  observation_post: { name: 'Observation Post', cat: 'support', cost: 120, buildTime: 12, hp: 170, radius: 2.2, mesh: 'obs_post', aura: { kind: 'sight', radius: 28, mult: 1.3 }, desc: 'Rangefinders and binoculars. +30% sight.' },
  radio_mast: { name: 'Radio Mast', cat: 'support', cost: 90, buildTime: 10, hp: 130, radius: 1.4, mesh: 'radio_mast', aura: { kind: 'sight', radius: 44, mult: 1.55 }, desc: 'Powerful set. Greatly extends vision.' },
  fire_direction: { name: 'Fire Direction Center', cat: 'support', cost: 260, buildTime: 22, hp: 280, radius: 3.0, mesh: 'fdc', aura: { kind: 'artyDamage', radius: 34, mult: 1.4 }, desc: 'Gunnery brain. Howitzers hit +40% harder.' },
  ammo_depot:  { name: 'Ammo Depot', cat: 'support', cost: 175, buildTime: 17, hp: 260, radius: 3.0, mesh: 'ammo_depot', aura: { kind: 'reload', radius: 26, mult: 0.78 }, desc: 'Shell supply. Nearby troops reload 22% faster.' },
  fuel_depot:  { name: 'Fuel Depot', cat: 'support', cost: 150, buildTime: 15, hp: 250, radius: 3.0, mesh: 'fuel_depot', aura: { kind: 'speed', radius: 26, mult: 1.22 }, desc: 'Jerry cans and drums. Vehicles move +22%.' },
  field_kitchen: { name: 'Field Kitchen', cat: 'support', cost: 40, buildTime: 5, hp: 130, radius: 2.2, mesh: 'kitchen', aura: { kind: 'healInfantry', radius: 18, rate: 2.1 }, desc: 'Hot stew. A little goes a long way.' },

  // ---- Camp & Supplies (11) ----
  tent:        { name: 'Tent', cat: 'camp', cost: 25, buildTime: 4, hp: 90, radius: 2.0, mesh: 'tent', desc: 'Simple canvas shelter.' },
  supply_tent: { name: 'Supply Tent', cat: 'camp', cost: 30, buildTime: 4, hp: 95, radius: 2.1, mesh: 'supply_tent', desc: 'Stores rations and gear.' },
  camo_tent:   { name: 'Camo Net Tent', cat: 'camp', cost: 30, buildTime: 4, hp: 85, radius: 2.1, mesh: 'camo_tent', desc: 'Netted tent, hard to spot.' },
  barracks_tent: { name: 'Barracks Tent', cat: 'camp', cost: 45, buildTime: 6, hp: 120, radius: 3.0, mesh: 'barracks_tent', desc: 'Long tent housing a squad.' },
  tent_line:   { name: 'Tent Line', cat: 'camp', cost: 60, buildTime: 7, hp: 150, radius: 3.6, mesh: 'tent_line', desc: 'Three tents in a row.' },
  supply_crates:{ name: 'Supply Crates', cat: 'camp', cost: 20, buildTime: 3, hp: 70, radius: 1.7, mesh: 'supply_crates', desc: 'Wooden crates of supplies.' },
  fuel_tank:   { name: 'Fuel Tank', cat: 'camp', cost: 35, buildTime: 5, hp: 110, radius: 2.1, mesh: 'fuel_tank', desc: 'Horizontal storage tank.' },
  spare_parts: { name: 'Spare Parts', cat: 'camp', cost: 25, buildTime: 4, hp: 75, radius: 1.8, mesh: 'spare_parts', desc: 'Engines and track links.' },
  wood_pile:   { name: 'Wood Pile', cat: 'camp', cost: 15, buildTime: 2, hp: 65, radius: 1.6, mesh: 'wood_pile', desc: 'Seasoned firewood.' },
  barrel_rack: { name: 'Barrel Rack', cat: 'camp', cost: 20, buildTime: 3, hp: 80, radius: 1.7, mesh: 'barrel_rack', desc: 'Oiled rack of drums.' },
  water_tower: { name: 'Water Tower', cat: 'camp', cost: 80, buildTime: 11, hp: 190, radius: 2.2, mesh: 'water_tower', desc: 'Elevated tank. Visible for miles.' }
};
export const BUILD_COUNT = Object.keys(BUILD_DEFS).length; // 50
export const BUILD_CATEGORIES = [
  { id: 'production', label: 'Production' },
  { id: 'fortification', label: 'Fortify' },
  { id: 'emplacement', label: 'Guns' },
  { id: 'support', label: 'Support' },
  { id: 'camp', label: 'Camp' }
];
// Buildings/forts cost & placement rules live here; HQ + barracks + factory are not placeable
// directly — HQ is pre-placed, barracks/factory are placeable as usual.
export const BUILDING_DEFS = {
  hq: { name: 'Headquarters', hp: 1600, radius: 6.2, cost: 0, buildTime: 0, desc: 'The heart of your command. Lose it and the battle is over.', mesh: 'hq' },
  ...BUILD_DEFS
};

export const ECONOMY = {
  startReq: 340,
  baseIncome: 5,
  captureIncome: 3,
  unitCap: 46,
  sandboxStartReq: 3000,
  sandboxIncome: 12
};

export const DIFFICULTY = {
  cadet:   { label: 'Cadet',   desc: 'Relaxed pace. Weak enemy economy.', aiIncome: 0.7, aiAggro: 18, hpMul: 0.8 },
  officer: { label: 'Officer', desc: 'A fair fight. Balanced enemy.',     aiIncome: 1.0, aiAggro: 12, hpMul: 1.0 },
  marshal: { label: 'Marshal', desc: 'Relentless elite powers.',          aiIncome: 1.35, aiAggro: 9, hpMul: 1.25 }
};

export const SKIRMISH_TIME = 15 * 60;
