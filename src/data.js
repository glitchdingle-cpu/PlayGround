// ─────────────────────────────────────────────────────────────────────────────
// IRON EPOCHS — data model
// 3 eras × 3 factions × (5 soldiers + 3 vehicles + 2 planes + 3 tanks)
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORY = {
  soldier: { label: 'Infantry', short: 'INF', icon: 'soldier', plural: 'Soldiers' },
  vehicle: { label: 'Vehicles', short: 'VEH', icon: 'vehicle', plural: 'Vehicles' },
  plane: { label: 'Air Wing', short: 'AIR', icon: 'plane', plural: 'Planes' },
  tank: { label: 'Armour', short: 'ARM', icon: 'tank', plural: 'Tanks' },
}

const ERA_SCALE = {
  ww1: { hp: 0.86, dmg: 0.82, range: 0.9, speed: 0.82, cost: 0.78, pop: 1 },
  ww2: { hp: 1, dmg: 1, range: 1, speed: 1, cost: 1, pop: 1 },
  modern: { hp: 1.22, dmg: 1.32, range: 1.18, speed: 1.28, cost: 1.32, pop: 1.15 },
}

// Shared archetypes. Every faction fields every role, built on these bones.
const ROLES = {
  soldier: {
    rifleman: { label: 'Rifleman', hp: 100, dmg: 12, range: 26, rof: 0.62, speed: 3.8, sight: 42, pop: 1, cost: 80, canHitAir: false, desc: 'Line infantry. Cheap, dependable, holds ground.' },
    assault: { label: 'Assault', hp: 116, dmg: 17, range: 17, rof: 0.32, speed: 4.35, sight: 38, pop: 1, cost: 115, canHitAir: false, desc: 'Close-range shock infantry with rapid fire.' },
    gunner: { label: 'MG Gunner', hp: 138, dmg: 9, range: 36, rof: 0.16, speed: 2.6, sight: 44, pop: 2, cost: 150, canHitAir: false, desc: 'Sustained fire suppresses infantry at long range.' },
    marksman: { label: 'Marksman', hp: 82, dmg: 58, range: 58, rof: 2.25, speed: 3.35, sight: 66, pop: 1, cost: 170, canHitAir: false, desc: 'Extreme-range precision. Fragile if rushed.' },
    engineer: { label: 'Engineer', hp: 112, dmg: 9, range: 15, rof: 0.7, speed: 3.6, sight: 38, pop: 1, cost: 135, canHitAir: false, repair: 16, desc: 'Repairs vehicles and structures in the field.' },
  },
  vehicle: {
    recon: { label: 'Recon Vehicle', hp: 175, dmg: 13, range: 30, rof: 0.5, speed: 8.4, sight: 62, pop: 2, cost: 190, canHitAir: false, desc: 'Fast scout. Great vision, thin skin.' },
    apc: { label: 'Transport APC', hp: 360, dmg: 20, range: 31, rof: 0.8, speed: 5.7, sight: 46, pop: 2, cost: 290, canHitAir: false, desc: 'Armoured support that soaks up small-arms fire.' },
    artillery: { label: 'Artillery', hp: 240, dmg: 105, range: 125, minRange: 26, rof: 4.2, speed: 3.1, sight: 48, pop: 3, cost: 480, canHitAir: false, splash: 12, crater: 6.5, projectile: 'shell', desc: 'Indirect fire. Blasts craters into the terrain.' },
  },
  plane: {
    fighter: { label: 'Fighter', hp: 265, dmg: 33, range: 42, rof: 0.26, speed: 22, sight: 80, pop: 3, cost: 480, canHitAir: true, aircraft: true, desc: 'Air superiority. Intercepts enemy aircraft.' },
    bomber: { label: 'Bomber', hp: 340, dmg: 165, range: 22, rof: 6, speed: 15, sight: 70, pop: 4, cost: 680, canHitAir: false, aircraft: true, splash: 16, crater: 9, projectile: 'bomb', desc: 'Heavy payload. Leaves huge craters.' },
  },
  tank: {
    light: { label: 'Light Tank', hp: 390, dmg: 38, range: 43, rof: 1.15, speed: 6.6, sight: 50, pop: 2, cost: 320, canHitAir: false, desc: 'Fast flanker with a light cannon.' },
    medium: { label: 'Medium Tank', hp: 690, dmg: 66, range: 49, rof: 1.75, speed: 5.05, sight: 52, pop: 3, cost: 520, canHitAir: false, splash: 5, desc: 'The armoured backbone. Balanced and durable.' },
    heavy: { label: 'Heavy Tank', hp: 1120, dmg: 102, range: 54, rof: 2.6, speed: 3.55, sight: 54, pop: 4, cost: 820, canHitAir: false, splash: 7, desc: 'Slow, terrifying, nearly unbreakable frontally.' },
  },
}

const SOLDIER_ROLES = ['rifleman', 'assault', 'gunner', 'marksman', 'engineer']
const VEHICLE_ROLES = ['recon', 'apc', 'artillery']
const PLANE_ROLES = ['fighter', 'bomber']
const TANK_ROLES = ['light', 'medium', 'heavy']
export const ROSTER_LAYOUT = [
  { category: 'soldier', roles: SOLDIER_ROLES },
  { category: 'vehicle', roles: VEHICLE_ROLES },
  { category: 'plane', roles: PLANE_ROLES },
  { category: 'tank', roles: TANK_ROLES },
]

const FACTIONS = {
  // ── WW1 ───────────────────────────────────────────────────────────────────
  britain: {
    id: 'britain', era: 'ww1', name: 'British Empire', short: 'UK', monogram: 'UK', adjective: 'British',
    doctrine: 'Combined Arms', blurb: 'Disciplined infantry and dependable field guns. A balanced force with superb staying power.',
    colors: { primary: 0x59684a, secondary: 0x8f8a6a, accent: 0xd9c68d, ui: '#c9b678', uiDark: '#576244' },
    mods: { hp: 1.05, dmg: 1.04, range: 1.03, speed: 1, cost: 1 },
    names: {
      rifleman: 'Tommy Rifleman', assault: 'Royal Marine Assault', gunner: 'Vickers Gunner', marksman: 'SMLE Marksman', engineer: 'Royal Engineer',
      recon: 'Lanchester Scout', apc: 'Peerless Lorry', artillery: 'BL 60-Pounder',
      fighter: 'Sopwith Camel', bomber: 'Handley Page 0/400',
      light: 'Mark IV “Male”', medium: 'Whippet', heavy: 'Mark V “Composite”',
    },
  },
  germany: {
    id: 'germany', era: 'ww1', name: 'German Empire', short: 'DE', monogram: 'DE', adjective: 'German',
    doctrine: 'Storm Tactics', blurb: 'Elite assault troops and heavy siege guns. Hits harder, but every formation costs more.',
    colors: { primary: 0x505a4b, secondary: 0x6c6b5d, accent: 0xb9a36a, ui: '#b7a77d', uiDark: '#434b40' },
    mods: { hp: 1.02, dmg: 1.13, range: 1.05, speed: 0.97, cost: 1.06 },
    names: {
      rifleman: 'Infanterist', assault: 'Sturmtrupp', gunner: 'MG08 Gunner', marksman: 'Scharfschütze', engineer: 'Pionier',
      recon: 'Ehrhardt Scout', apc: 'Daimler Supply', artillery: '17cm Mörser',
      fighter: 'Fokker D.VII', bomber: 'Gotha G.IV',
      light: 'A7V “Nixe”', medium: 'Lk II', heavy: 'A7V/U',
    },
  },
  ottoman: {
    id: 'ottoman', era: 'ww1', name: 'Ottoman Empire', short: 'OT', monogram: 'OT', adjective: 'Ottoman',
    doctrine: 'Attrition', blurb: 'Massed infantry and stubborn defences. Units are cheaper and tougher, if less accurate.',
    colors: { primary: 0x8f7a50, secondary: 0x75664c, accent: 0x9d3f35, ui: '#c0a574', uiDark: '#6b5a3d' },
    mods: { hp: 1.15, dmg: 0.95, range: 0.94, speed: 0.94, cost: 0.9 },
    names: {
      rifleman: 'Mehmetçik', assault: 'Hücum Taburu', gunner: 'Maxim Gunner', marksman: 'Nişancı', engineer: 'İstihkâm',
      recon: 'Yıldırım Scout', apc: 'Anadolu Kamyon', artillery: 'Krupp 15cm',
      fighter: 'Pfalz D.III', bomber: 'Rumpler Taube',
      light: 'FT-17 “Osman”', medium: 'Mark IV “Ganimet”', heavy: 'A7V “Ganimet”',
    },
  },
  // ── WW2 ───────────────────────────────────────────────────────────────────
  usa: {
    id: 'usa', era: 'ww2', name: 'United States', short: 'US', monogram: 'US', adjective: 'American',
    doctrine: 'Arsenal of Democracy', blurb: 'Cheap, plentiful equipment backed by the world’s strongest air arm.',
    colors: { primary: 0x5c6342, secondary: 0x7d7c5b, accent: 0xd8c58a, ui: '#cbb87e', uiDark: '#4f5638' },
    mods: { hp: 1.02, dmg: 1.02, range: 1.02, speed: 1.04, cost: 0.93, air: 1.14 },
    names: {
      rifleman: 'GI Rifleman', assault: 'Army Ranger', gunner: 'Browning Gunner', marksman: 'Marine Sniper', engineer: 'Combat Engineer',
      recon: 'M8 Greyhound', apc: 'M3 Halftrack', artillery: 'M7 Priest',
      fighter: 'P-51 Mustang', bomber: 'B-17 Flying Fortress',
      light: 'M5 Stuart', medium: 'M4 Sherman', heavy: 'M26 Pershing',
    },
  },
  germany2: {
    id: 'germany2', era: 'ww2', name: 'German Reich', short: 'DE', monogram: 'DE', adjective: 'German',
    doctrine: 'Blitzkrieg', blurb: 'Fast, hard-hitting armour and elite crews. Win the fight before the factories wake up.',
    colors: { primary: 0x5e6059, secondary: 0x4b4d48, accent: 0x9c8a5f, ui: '#aaa18a', uiDark: '#474a44' },
    mods: { hp: 0.99, dmg: 1.14, range: 1.06, speed: 1.07, cost: 1.07 },
    names: {
      rifleman: 'Wehrmacht Grenadier', assault: 'Panzergrenadier', gunner: 'MG42 Gunner', marksman: 'Fallschirmjäger Sniper', engineer: 'Sturmpionier',
      recon: 'Sd.Kfz. 222', apc: 'Sd.Kfz. 251', artillery: 'Hummel',
      fighter: 'Bf 109 G', bomber: 'Ju 88',
      light: 'Pz. II Luchs', medium: 'Pz. IV Ausf. H', heavy: 'Tiger I',
    },
  },
  ussr: {
    id: 'ussr', era: 'ww2', name: 'Soviet Union', short: 'SU', monogram: 'SU', adjective: 'Soviet',
    doctrine: 'Deep Battle', blurb: 'Endless manpower and rugged tanks. Trade lives, then roll over the wreckage.',
    colors: { primary: 0x5b5e44, secondary: 0x6e684d, accent: 0xa84b3c, ui: '#b7a06e', uiDark: '#4a4d36' },
    mods: { hp: 1.19, dmg: 0.96, range: 0.97, speed: 1, cost: 0.88 },
    names: {
      rifleman: 'Krasnoarmeets', assault: 'Shock Trooper', gunner: 'Maxim Gunner', marksman: 'Guard Sniper', engineer: 'Saper',
      recon: 'BA-64', apc: 'ZIS-42 Halftrack', artillery: 'BM-13 Katyusha',
      fighter: 'Yak-3', bomber: 'Pe-2',
      light: 'T-70', medium: 'T-34/85', heavy: 'IS-2',
    },
  },
  // ── MODERN ────────────────────────────────────────────────────────────────
  nato: {
    id: 'nato', era: 'modern', name: 'NATO Task Force', short: 'NATO', monogram: 'NT', adjective: 'NATO',
    doctrine: 'Networked Precision', blurb: 'Long-range optics, precision munitions and air dominance. Expensive, lethal, fragile in a brawl.',
    colors: { primary: 0x4e5d57, secondary: 0x38423f, accent: 0x66c2b1, ui: '#7fd4c3', uiDark: '#34413d' },
    mods: { hp: 0.98, dmg: 1.1, range: 1.15, speed: 1.05, cost: 1.08 },
    names: {
      rifleman: 'NATO Rifleman', assault: 'Delta Operator', gunner: 'M249 Gunner', marksman: 'Designated Marksman', engineer: 'Combat Engineer',
      recon: 'M-ATV Recon', apc: 'Stryker APC', artillery: 'M270 MLRS',
      fighter: 'F-16 Falcon', bomber: 'A-10 Warthog',
      light: 'M10 Booker', medium: 'M1A2 Abrams', heavy: 'Challenger 3',
    },
  },
  russia: {
    id: 'russia', era: 'modern', name: 'Russian Federation', short: 'RU', monogram: 'RU', adjective: 'Russian',
    doctrine: 'Firepower & EW', blurb: 'Heavy armour, rocket artillery and electronic warfare. A sledgehammer, not a scalpel.',
    colors: { primary: 0x4f5748, secondary: 0x3b3f35, accent: 0xc46a4a, ui: '#d08a68', uiDark: '#3b4235' },
    mods: { hp: 1.09, dmg: 1.08, range: 1.04, speed: 0.99, cost: 0.94 },
    names: {
      rifleman: 'Motostrelok', assault: 'Spetsnaz Assault', gunner: 'PKM Gunner', marksman: 'SVD Marksman', engineer: 'Combat Sapper',
      recon: 'Tigr Recon', apc: 'BTR-82A', artillery: 'BM-27 Uragan',
      fighter: 'Su-35S', bomber: 'Su-34',
      light: 'T-72B3', medium: 'T-90M', heavy: 'T-14 Armata',
    },
  },
  china: {
    id: 'china', era: 'modern', name: 'PLA Expeditionary', short: 'CN', monogram: 'CN', adjective: 'Chinese',
    doctrine: 'Combined Arms', blurb: 'Cheap, fast and numerous. Drone-linked formations overwhelm with tempo.',
    colors: { primary: 0x59624a, secondary: 0x3f4636, accent: 0xd0a44e, ui: '#d8b25e', uiDark: '#404735' },
    mods: { hp: 0.98, dmg: 1.04, range: 1.03, speed: 1.08, cost: 0.87 },
    names: {
      rifleman: 'PLA Rifleman', assault: 'Airborne Assault', gunner: 'QJY-88 Gunner', marksman: 'PLA Marksman', engineer: 'Combat Engineer',
      recon: 'Dongfeng Mengshi', apc: 'ZBL-09 APC', artillery: 'PHL-03 MLRS',
      fighter: 'J-10C', bomber: 'H-6K',
      light: 'Type 15', medium: 'Type 96B', heavy: 'ZTZ-99A',
    },
  },
}

const ERA_BUILDINGS = {
  ww1: {
    hq: { name: 'Command Post', desc: 'Field headquarters. Generates supply and anchors your line.' },
    barracks: { name: 'Infantry Barracks', desc: 'Trains all infantry. Unlocks the 5-man roster.' },
    factory: { name: 'Field Workshop', desc: 'Builds vehicles and tanks.' },
    airfield: { name: 'Aerodrome', desc: 'Builds fighters and bombers.' },
    depot: { name: 'Supply Depot', desc: '+10 supply income, +10 population cap.' },
    turret: { name: 'Field Gun Nest', desc: 'Long-range defensive gun. Hits ground and air.' },
    hospital: { name: 'Field Hospital', desc: 'Heals nearby infantry. +5 population cap.' },
  },
  ww2: {
    hq: { name: 'Battalion HQ', desc: 'Command headquarters. Generates supply and anchors your line.' },
    barracks: { name: 'Barracks', desc: 'Trains all infantry. Unlocks the 5-man roster.' },
    factory: { name: 'Tank Factory', desc: 'Builds vehicles and tanks.' },
    airfield: { name: 'Airfield', desc: 'Builds fighters and bombers.' },
    depot: { name: 'Supply Depot', desc: '+10 supply income, +10 population cap.' },
    turret: { name: 'Flak Tower', desc: 'Defensive gun. Hits ground and air.' },
    hospital: { name: 'Field Hospital', desc: 'Heals nearby infantry. +5 population cap.' },
  },
  modern: {
    hq: { name: 'Command Center', desc: 'Networked HQ. Generates supply and coordinates the battle.' },
    barracks: { name: 'Barracks', desc: 'Trains all infantry. Unlocks the 5-man roster.' },
    factory: { name: 'War Factory', desc: 'Builds vehicles and tanks.' },
    airfield: { name: 'Airbase', desc: 'Builds fighters and bombers.' },
    depot: { name: 'Logistics Hub', desc: '+10 supply income, +10 population cap.' },
    turret: { name: 'Defense Turret', desc: 'Automated gun. Hits ground and air.' },
    hospital: { name: 'Field Hospital', desc: 'Heals nearby infantry. +5 population cap.' },
  },
}

const BUILDING_STATS = {
  hq: { cost: 1200, hp: 3600, buildTime: 40, size: 15, income: 8, popCap: 25, produces: [], icon: 'hq' },
  barracks: { cost: 350, hp: 950, buildTime: 14, size: 10, income: 0, popCap: 0, produces: ['soldier'], icon: 'barracks' },
  factory: { cost: 650, hp: 1250, buildTime: 22, size: 12, income: 0, popCap: 0, produces: ['vehicle', 'tank'], icon: 'factory' },
  airfield: { cost: 800, hp: 1050, buildTime: 24, size: 14, income: 0, popCap: 0, produces: ['plane'], icon: 'airfield' },
  depot: { cost: 300, hp: 720, buildTime: 11, size: 8, income: 10, popCap: 10, produces: [], icon: 'depot' },
  turret: { cost: 400, hp: 1050, buildTime: 15, size: 6, income: 0, popCap: 0, produces: [], icon: 'turret', damage: 38, range: 60, rof: 1.1, canHitAir: true },
  hospital: { cost: 450, hp: 680, buildTime: 13, size: 9, income: 0, popCap: 5, produces: [], icon: 'hospital', heal: 10 },
}

export const ERAS = [
  {
    id: 'ww1', name: 'The Great War', years: '1914 — 1918', numeral: 'I',
    tagline: 'Mud, wire, and the arithmetic of attrition.',
    description: 'Massed infantry, lumbering landships and artillery that rewrites the earth itself.',
    accent: '#c9ae76', accentDim: '#776243', bg: '#1a1a13',
    weatherNote: 'Rain · Shellfire · Flanders clay',
    factions: ['britain', 'germany', 'ottoman'],
    buildings: ERA_BUILDINGS.ww1,
    abilityName: 'Creeping Barrage',
    maps: [
      {
        id: 'flanders', name: 'No Man’s Land', region: 'Flanders · 1917', brief: 'Shattered drainage ditches, flooded shell holes and a horizon of splintered trees. Rain never stops.',
        type: 'flanders', weather: 'rain', water: false,
        palette: { low: 0x4a4730, mid: 0x6a6040, high: 0x837653, rock: 0x57503d, fog: 0x8a8a72, sky: 0x9a9a82, sun: 0xd8cba8 },
        props: 'deadTrees', heightScale: 3.2, thumbnail: ['#3f3b28', '#6d6244', '#95855c'],
      },
      {
        id: 'verdun', name: 'Verdun Ridge', region: 'Meuse · 1916', brief: 'Fortified ridgelines and cratered slopes. High ground decides who owns the morning.',
        type: 'verdun', weather: 'fog', water: false,
        palette: { low: 0x4c4a34, mid: 0x66603f, high: 0x807a56, rock: 0x54503f, fog: 0x9a9a8a, sky: 0xa6a690, sun: 0xd6cbaa },
        props: 'ruins', heightScale: 11, thumbnail: ['#44422f', '#676147', '#948c6a'],
      },
      {
        id: 'sinai', name: 'Sinai Dunes', region: 'Sinai · 1917', brief: 'Rolling desert and exposed ridges. Speed and range matter more than trenches.',
        type: 'sinai', weather: 'dust', water: false,
        palette: { low: 0x8d7245, mid: 0xb39860, high: 0xd0b780, rock: 0x9f8453, fog: 0xcab68a, sky: 0xc9b184, sun: 0xffe7b8 },
        props: 'desert', heightScale: 9, thumbnail: ['#8a6f42', '#b89a62', '#dcc28c'],
      },
    ],
  },
  {
    id: 'ww2', name: 'World War Two', years: '1939 — 1945', numeral: 'II',
    tagline: 'Steel, engines, and the world on fire.',
    description: 'Fast armour, massed air power and factories that never sleep. Build the war machine.',
    accent: '#d3b77b', accentDim: '#7b6640', bg: '#181a16',
    weatherNote: 'Ash · Snow · Burning fuel',
    factions: ['usa', 'germany2', 'ussr'],
    buildings: ERA_BUILDINGS.ww2,
    abilityName: 'Rolling Thunder',
    maps: [
      {
        id: 'normandy', name: 'Normandy Bocage', region: 'Normandy · 1944', brief: 'Hedgerow country. Tight sightlines, hidden lanes and deadly ambushes in the green.',
        type: 'normandy', weather: 'clear', water: false,
        palette: { low: 0x3f5530, mid: 0x5c7039, high: 0x7d8b4c, rock: 0x6d6749, fog: 0x9db28b, sky: 0xa8bda4, sun: 0xfff2d0 },
        props: 'hedges', heightScale: 6, thumbnail: ['#33452a', '#586b36', '#83924f'],
      },
      {
        id: 'stalingrad', name: 'Stalingrad Winter', region: 'Stalingrad · 1943', brief: 'A frozen city reduced to rubble. Every block is a fortress; every crater is a grave.',
        type: 'stalingrad', weather: 'snow', water: false,
        palette: { low: 0x5e6062, mid: 0x85888a, high: 0xb8bcbd, rock: 0x6e7173, fog: 0xc3c9ca, sky: 0xb9c3c6, sun: 0xe8eef2 },
        props: 'urbanSnow', heightScale: 5, thumbnail: ['#5c6062', '#868b8d', '#c0c6c8'],
      },
      {
        id: 'pacific', name: 'Pacific Atoll', region: 'Gilberts · 1944', brief: 'A narrow sand spit ringed by lagoon. Nowhere to hide from naval guns or bombers.',
        type: 'pacific', weather: 'clear', water: true,
        palette: { low: 0xc4b283, mid: 0xa3a06b, high: 0x7a8b58, rock: 0x8b8468, fog: 0xbdd0cf, sky: 0x8dc9d6, sun: 0xfff3cf },
        props: 'palms', heightScale: 4.5, thumbnail: ['#d2c294', '#8fa06a', '#3d7f86'],
      },
    ],
  },
  {
    id: 'modern', name: 'Modern Warfare', years: '2027 — 2035', numeral: 'III',
    tagline: 'Information moves faster than the shell.',
    description: 'Networked infantry, main battle tanks, drones and precision strikes. The battlefield is transparent.',
    accent: '#7ad9c5', accentDim: '#376d63', bg: '#111817',
    weatherNote: 'Smoke · Rain · Thermal bloom',
    factions: ['nato', 'russia', 'china'],
    buildings: ERA_BUILDINGS.modern,
    abilityName: 'Precision Barrage',
    maps: [
      {
        id: 'fulda', name: 'Fulda Gap', region: 'Hesse · 2031', brief: 'Rolling farmland and motorway embankments. Long sightlines and deadly open ground.',
        type: 'fulda', weather: 'clear', water: false,
        palette: { low: 0x3d5334, mid: 0x5b6d3e, high: 0x7d8b4d, rock: 0x6e7058, fog: 0x9bb39d, sky: 0x9dc3c1, sun: 0xfff0cc },
        props: 'trees', heightScale: 9, thumbnail: ['#33492d', '#556b3b', '#85945a'],
      },
      {
        id: 'desertstorm', name: 'Desert Storm', region: 'Al-Kharj · 2033', brief: 'Open desert punctuated by oil fires and concrete berms. Armour rules the day.',
        type: 'desertStorm', weather: 'dust', water: false,
        palette: { low: 0x9b8050, mid: 0xbea268, high: 0xdcc38c, rock: 0xa68b58, fog: 0xd6c296, sky: 0xd8bd8b, sun: 0xffe5ac },
        props: 'desertWar', heightScale: 5.5, thumbnail: ['#937849', '#bea066', '#e0c78f'],
      },
      {
        id: 'seoul', name: 'Seoul Outskirts', region: 'Gyeonggi · 2035', brief: 'A sprawl of concrete, overpasses and shattered towers. Close-quarters urban warfare.',
        type: 'seoul', weather: 'rain', water: false,
        palette: { low: 0x4b514d, mid: 0x676e66, high: 0x8a8e7f, rock: 0x6d6e63, fog: 0x9fa79f, sky: 0x9aa9a5, sun: 0xdde2cc },
        props: 'city', heightScale: 3, thumbnail: ['#424844', '#656d63', '#959b85'],
      },
    ],
  },
]

export const BUILDING_ORDER = ['barracks', 'factory', 'airfield', 'depot', 'turret', 'hospital']

export function getEra(id) {
  return ERAS.find(era => era.id === id)
}

export function getFaction(id) {
  return FACTIONS[id]
}

export function factionsForEra(eraId) {
  return getEra(eraId).factions.map(id => FACTIONS[id])
}

export function rivalOf(faction) {
  const era = getEra(faction.era)
  const pool = era.factions.filter(id => id !== faction.id)
  return FACTIONS[pool[(faction.id.length + era.id.length) % pool.length]]
}

function scaleStats(role, eraId, faction) {
  const e = ERA_SCALE[eraId]
  const m = faction.mods
  const air = role.aircraft ? (m.air || 1) : 1
  const stat = n => Math.round(n * 10) / 10
  return {
    hp: Math.round(role.hp * e.hp * m.hp),
    damage: stat(role.dmg * e.dmg * m.dmg * air),
    range: stat(role.range * e.range * (m.range || 1)),
    rof: stat(role.rof),
    speed: stat(role.speed * e.speed * m.speed),
    sight: stat(role.sight * (m.range || 1)),
    pop: Math.max(1, Math.round(role.pop * e.pop)),
    cost: Math.round((role.cost * e.cost * (m.cost || 1)) / 5) * 5,
  }
}

function makeRoster(faction) {
  const list = []
  for (const { category, roles } of ROSTER_LAYOUT) {
    for (const key of roles) {
      const base = ROLES[category][key]
      const s = scaleStats(base, faction.era, faction)
      const id = `${faction.id}-${key}`
      list.push({
        ...base,
        ...s,
        id,
        key,
        category,
        era: faction.era,
        factionId: faction.id,
        faction,
        name: faction.names[key],
        roleLabel: base.label,
        categoryLabel: CATEGORY[category].label,
        minRange: base.minRange || 0,
        splash: base.splash || 0,
        crater: base.crater || 0,
        projectile: base.projectile || 'bullet',
        repair: base.repair || 0,
        aircraft: Boolean(base.aircraft),
        buildTime: Math.round(Math.min(18, Math.max(4, 3 + s.cost / 130))),
      })
    }
  }
  return list
}

const rosterCache = new Map()
export function rosterFor(faction) {
  if (typeof faction === 'string') faction = FACTIONS[faction]
  if (!rosterCache.has(faction.id)) rosterCache.set(faction.id, makeRoster(faction))
  return rosterCache.get(faction.id)
}

export function unitsFor(faction, category) {
  return rosterFor(faction).filter(u => u.category === category)
}

export function buildingsFor(eraId) {
  const era = getEra(eraId)
  const order = ['hq', ...BUILDING_ORDER]
  return order.map(key => {
    const stats = BUILDING_STATS[key]
    const info = era.buildings[key]
    const scale = ERA_SCALE[eraId]
    return {
      ...stats,
      key,
      id: `${eraId}-${key}`,
      era: eraId,
      name: info.name,
      desc: info.desc,
      hp: Math.round(stats.hp * (eraId === 'modern' ? 1.15 : 1)),
      cost: Math.round(stats.cost * (eraId === 'ww1' ? 0.85 : eraId === 'modern' ? 1.12 : 1)),
      damage: stats.damage ? Math.round(stats.damage * scale.dmg) : 0,
      range: stats.range || 0,
      rof: stats.rof || 0,
      heal: stats.heal || 0,
    }
  })
}

export function buildingFor(eraId, key) {
  return buildingsFor(eraId).find(b => b.key === key)
}

export function eraMonogram(eraId) {
  return getEra(eraId).numeral
}

export const GAME_RULES = {
  startSupply: 1650,
  baseIncome: 9,
  captureIncome: 5,
  startPopCap: 55,
  maxPopCap: 110,
  captureRadius: 15,
  captureTime: 7,
  artilleryCooldown: 42,
  artilleryRadius: 19,
  artilleryShells: 7,
}
