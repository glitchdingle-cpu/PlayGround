export const WORLD = { w: 2400, h: 1500 };

export const FACTIONS = {
  germany: {
    id: 'germany',
    name: 'German Empire',
    short: 'Germany',
    adjective: 'German',
    leader: 'Kaiser Wilhelm II',
    color: '#777d68',
    colorDark: '#454b3e',
    colorLight: '#c7cbb5',
    accent: '#d7bd79',
    flag: 'germany',
    doctrine: 'Krupp Steel',
    bonus: 'Artillery range +18% · All damage +6%',
    quote: 'We must be the hammer, not the anvil.',
    capital: 'berlin',
    start: { x: 1510, y: 610 },
    incomeMod: 1,
    capMod: 1,
    special: {
      key: 'storm',
      sprite: 'rifle',
      name: 'Sturmtruppen',
      short: 'Storm',
      cost: 110,
      hp: 140,
      dmg: 16,
      range: 135,
      rof: 0.62,
      speed: 47,
      aggro: 255,
      radius: 9,
      capture: 1.1,
      damageReduction: 0.06,
      role: 'Assault infantry',
      desc: 'Hardened shock troops. Fast, accurate and built to break a trench line.'
    }
  },
  france: {
    id: 'france',
    name: 'French Republic',
    short: 'France',
    adjective: 'French',
    leader: 'General Joseph Joffre',
    color: '#4b79ac',
    colorDark: '#2e4d70',
    colorLight: '#b8cde1',
    accent: '#e0c789',
    flag: 'france',
    doctrine: 'Élan Vital',
    bonus: 'Infantry damage +10% · Infantry cost −10%',
    quote: 'They shall not pass.',
    capital: 'paris',
    start: { x: 670, y: 1090 },
    incomeMod: 1,
    capMod: 1,
    special: {
      key: 'char',
      sprite: 'tank',
      name: 'Saint-Chamond',
      short: 'Char',
      cost: 225,
      hp: 370,
      dmg: 29,
      range: 235,
      rof: 1.55,
      speed: 27,
      aggro: 280,
      radius: 15,
      capture: 0.1,
      armor: 0.34,
      role: 'Assault tank',
      desc: 'A steel leviathan with a long 75 mm gun. Slow, stubborn and terrifying.'
    }
  },
  britain: {
    id: 'britain',
    name: 'British Empire',
    short: 'Britain',
    adjective: 'British',
    leader: 'Field Marshal Douglas Haig',
    color: '#527394',
    colorDark: '#334c64',
    colorLight: '#c5d4df',
    accent: '#d5c58d',
    flag: 'britain',
    doctrine: 'BEF Marksmen',
    bonus: 'Infantry range +12% · Movement speed +6%',
    quote: 'The old contemptibles are still here.',
    capital: 'dover',
    start: { x: 350, y: 330 },
    incomeMod: 1.05,
    capMod: 1,
    special: {
      key: 'markiv',
      sprite: 'tank',
      name: 'Mark IV',
      short: 'Mark IV',
      cost: 235,
      hp: 410,
      dmg: 25,
      range: 220,
      rof: 1.45,
      speed: 31,
      aggro: 275,
      radius: 15,
      capture: 0.1,
      armor: 0.4,
      role: 'Landship',
      desc: 'A rolling fortress of riveted steel. The answer to the mud and the wire.'
    }
  },
  austria: {
    id: 'austria',
    name: 'Austria-Hungary',
    short: 'Austria-Hungary',
    adjective: 'Austro-Hungarian',
    leader: 'General Conrad von Hötzendorf',
    color: '#b38b42',
    colorDark: '#6d5226',
    colorLight: '#e0cda1',
    accent: '#d8b46a',
    flag: 'austria',
    doctrine: 'Fortress Empire',
    bonus: 'Units in home sectors take 18% less damage',
    quote: 'The monarchy stands, whatever the cost.',
    capital: 'vienna',
    start: { x: 1710, y: 1180 },
    incomeMod: 0.95,
    capMod: 1.05,
    special: {
      key: 'skoda',
      sprite: 'art',
      name: 'Skoda 305',
      short: 'Skoda',
      cost: 185,
      hp: 90,
      dmg: 66,
      range: 520,
      rof: 4.8,
      speed: 18,
      aggro: 560,
      radius: 12,
      capture: 0,
      minRange: 120,
      splash: 70,
      role: 'Siege howitzer',
      desc: 'A fortress-smashing howitzer. Its shells erase whole sections of trench.'
    }
  },
  russia: {
    id: 'russia',
    name: 'Russian Empire',
    short: 'Russia',
    adjective: 'Russian',
    leader: 'Grand Duke Nicholas',
    color: '#69875e',
    colorDark: '#40563a',
    colorLight: '#c9d5bd',
    accent: '#ddc98c',
    flag: 'russia',
    doctrine: 'The Steamroller',
    bonus: 'Unit cap +20% · Riflemen cost −12%',
    quote: 'The vastness of Russia is our armour.',
    capital: 'warsaw',
    start: { x: 2040, y: 565 },
    incomeMod: 1,
    capMod: 1.2,
    special: {
      key: 'cossack',
      sprite: 'cav',
      name: 'Cossack Host',
      short: 'Cossacks',
      cost: 100,
      hp: 175,
      dmg: 20,
      range: 105,
      rof: 0.82,
      speed: 82,
      aggro: 235,
      radius: 11,
      capture: 1.7,
      role: 'Fast cavalry',
      desc: 'Raiders of the steppe. Superb at seizing ground and running down the wounded.'
    }
  }
};

export const FACTION_ORDER = ['germany', 'france', 'britain', 'austria', 'russia'];

export const UNIT_TYPES = {
  rifle: {
    key: 'rifle',
    sprite: 'rifle',
    name: 'Riflemen',
    short: 'Rifles',
    cost: 58,
    hp: 122,
    dmg: 11,
    range: 152,
    rof: 0.85,
    speed: 38,
    aggro: 245,
    radius: 9,
    capture: 1,
    role: 'Line infantry',
    desc: 'The backbone of every army. Can seize and hold ground.'
  },
  mg: {
    key: 'mg',
    sprite: 'mg',
    name: 'Machine Gun',
    short: 'MG',
    cost: 92,
    hp: 104,
    dmg: 4.8,
    range: 238,
    rof: 0.16,
    speed: 27,
    aggro: 305,
    radius: 10,
    capture: 0.35,
    suppression: 5.5,
    role: 'Support',
    desc: 'A wall of lead. Suppresses infantry and punishes open ground.'
  },
  art: {
    key: 'art',
    sprite: 'art',
    name: 'Field Artillery',
    short: 'Artillery',
    cost: 145,
    hp: 84,
    dmg: 43,
    range: 455,
    rof: 3.6,
    speed: 20,
    aggro: 515,
    radius: 11,
    capture: 0,
    minRange: 110,
    splash: 56,
    shell: true,
    role: 'Siege',
    desc: 'Indirect fire. Devastating against clusters and fortifications.'
  },
  cav: {
    key: 'cav',
    sprite: 'cav',
    name: 'Cavalry',
    short: 'Cavalry',
    cost: 98,
    hp: 162,
    dmg: 18,
    range: 102,
    rof: 0.9,
    speed: 72,
    aggro: 230,
    radius: 11,
    capture: 1.35,
    role: 'Mounted',
    desc: 'Fast-moving raiders. Excellent for capturing undefended sectors.'
  },
  special: {
    key: 'special',
    sprite: 'rifle',
    name: 'Special Unit',
    short: 'Special',
    cost: 120,
    hp: 130,
    dmg: 15,
    range: 140,
    rof: 0.75,
    speed: 40,
    aggro: 250,
    radius: 10,
    capture: 1,
    role: 'Elite',
    desc: 'A unique unit of this empire.'
  }
};

export const SECTORS = [
  // Britain — the Channel coast
  { id: 'dover', name: 'Dover', sub: 'Channel Command', x: 330, y: 300, capital: true, owner: 'britain', radius: 108 },
  { id: 'ypres', name: 'Ypres', sub: 'Salient', x: 610, y: 405, capital: false, owner: 'britain', radius: 96 },
  { id: 'lille', name: 'Lille', sub: 'Industrial Belt', x: 770, y: 590, capital: false, owner: 'britain', radius: 96 },

  // France — the western republic
  { id: 'paris', name: 'Paris', sub: 'Grand Quartier', x: 625, y: 1115, capital: true, owner: 'france', radius: 112 },
  { id: 'reims', name: 'Reims', sub: 'Champagne', x: 850, y: 790, capital: false, owner: 'france', radius: 96 },
  { id: 'verdun', name: 'Verdun', sub: 'The Sacred Road', x: 1040, y: 900, capital: false, owner: 'france', radius: 98 },

  // Germany — the iron centre
  { id: 'berlin', name: 'Berlin', sub: 'Great General Staff', x: 1550, y: 600, capital: true, owner: 'germany', radius: 112 },
  { id: 'cologne', name: 'Cologne', sub: 'Rhine Depot', x: 1260, y: 355, capital: false, owner: 'germany', radius: 96 },
  { id: 'metz', name: 'Metz', sub: 'Fortress Belt', x: 1285, y: 805, capital: false, owner: 'germany', radius: 98 },

  // Austria-Hungary — the gilded southeast
  { id: 'vienna', name: 'Vienna', sub: 'Imperial Court', x: 1730, y: 1225, capital: true, owner: 'austria', radius: 112 },
  { id: 'prague', name: 'Prague', sub: 'Bohemian Gate', x: 1490, y: 1010, capital: false, owner: 'austria', radius: 96 },
  { id: 'budapest', name: 'Budapest', sub: 'Danube Line', x: 2050, y: 1150, capital: false, owner: 'austria', radius: 98 },

  // Russia — the eastern steamroller
  { id: 'warsaw', name: 'Warsaw', sub: 'Stavka Forward', x: 2040, y: 545, capital: true, owner: 'russia', radius: 112 },
  { id: 'minsk', name: 'Minsk', sub: 'Western Army', x: 2205, y: 285, capital: false, owner: 'russia', radius: 94 },
  { id: 'lviv', name: 'Lviv', sub: 'Galician Front', x: 1900, y: 860, capital: false, owner: 'russia', radius: 96 }
];

export const SECTOR_BY_ID = Object.fromEntries(SECTORS.map(sector => [sector.id, sector]));

export const FACTION_SECTORS = Object.fromEntries(
  Object.keys(FACTIONS).map(id => [id, SECTORS.filter(sector => sector.owner === id).map(sector => sector.id)])
);

export const STARTING_POSITIONS = {
  britain: [
    { type: 'rifle', x: 390, y: 345 }, { type: 'rifle', x: 430, y: 300 },
    { type: 'mg', x: 575, y: 435 }, { type: 'art', x: 660, y: 470 },
    { type: 'special', x: 720, y: 535 }, { type: 'cav', x: 505, y: 505 }
  ],
  france: [
    { type: 'rifle', x: 690, y: 1080 }, { type: 'rifle', x: 735, y: 1120 },
    { type: 'mg', x: 880, y: 820 }, { type: 'art', x: 905, y: 760 },
    { type: 'special', x: 990, y: 925 }, { type: 'cav', x: 770, y: 880 }
  ],
  germany: [
    { type: 'rifle', x: 1490, y: 645 }, { type: 'rifle', x: 1540, y: 600 },
    { type: 'mg', x: 1310, y: 760 }, { type: 'art', x: 1360, y: 820 },
    { type: 'special', x: 1240, y: 740 }, { type: 'cav', x: 1435, y: 680 }
  ],
  austria: [
    { type: 'rifle', x: 1690, y: 1165 }, { type: 'rifle', x: 1740, y: 1195 },
    { type: 'mg', x: 1530, y: 1045 }, { type: 'art', x: 1580, y: 1000 },
    { type: 'special', x: 1600, y: 1080 }, { type: 'cav', x: 1810, y: 1080 }
  ],
  russia: [
    { type: 'rifle', x: 2010, y: 585 }, { type: 'rifle', x: 2075, y: 560 },
    { type: 'mg', x: 1935, y: 825 }, { type: 'art', x: 1980, y: 880 },
    { type: 'special', x: 1850, y: 835 }, { type: 'cav', x: 2110, y: 690 }
  ]
};

export const UNIT_ORDER = ['rifle', 'mg', 'art', 'cav', 'special'];

export const ORDER_NAMES = {
  idle: 'Holding',
  move: 'Advancing',
  attack: 'Engaging',
  dig: 'Digging in',
  entrench: 'Entrenched',
  capture: 'Taking ground',
  retreat: 'Falling back'
};

export function getUnitDef(factionId, typeKey, rosterType = typeKey) {
  const faction = FACTIONS[factionId];
  let base;
  if (typeKey === 'special') {
    base = { ...UNIT_TYPES.special, ...faction.special };
  } else {
    base = { ...UNIT_TYPES[typeKey] };
    if (factionId === 'russia' && typeKey === 'rifle') base.name = 'Russian Rifles';
    if (factionId === 'germany' && typeKey === 'rifle') base.name = 'Infantry';
    if (factionId === 'britain' && typeKey === 'rifle') base.name = 'BEF Rifles';
    if (factionId === 'france' && typeKey === 'rifle') base.name = 'Poilus';
    if (factionId === 'austria' && typeKey === 'rifle') base.name = 'K.u.K. Infantry';
    if (factionId === 'france' && typeKey === 'art') base.name = '75 mm Battery';
    if (factionId === 'britain' && typeKey === 'mg') base.name = 'Vickers Gun';
    if (factionId === 'germany' && typeKey === 'mg') base.name = 'MG 08';
  }
  base.key = typeKey;
  base.faction = factionId;
  base.rosterType = rosterType;

  if (factionId === 'germany') {
    base.dmg *= 1.06;
    if (base.sprite === 'art') base.range *= 1.18;
  }
  if (factionId === 'france' && typeKey === 'rifle') {
    base.dmg *= 1.1;
    base.cost = Math.round(base.cost * 0.9);
  }
  if (factionId === 'britain') {
    if (typeKey === 'rifle') base.range *= 1.12;
    base.speed *= 1.06;
  }
  if (factionId === 'russia' && typeKey === 'rifle') {
    base.cost = Math.round(base.cost * 0.88);
  }
  if (factionId === 'russia') base.hp *= 1.04;

  base.cost = Math.round(base.cost);
  return base;
}

export function unitLabel(factionId, typeKey) {
  return getUnitDef(factionId, typeKey).name;
}

export const AI_NAMES = {
  germany: ['von Kluck', 'von Moltke', 'Hindenburg', 'Ludendorff'],
  france: ['Foch', 'Pétain', 'Joffre', 'Mangin'],
  britain: ['Haig', 'Plumer', 'Rawlinson', 'Byng'],
  austria: ['Conrad', 'Böhm-Ermolli', 'Pflanzer-Baltin'],
  russia: ['Brusilov', 'Rennenkampf', 'Samsonov', 'Alexeyev']
};
