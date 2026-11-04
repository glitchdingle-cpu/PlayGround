import { fbm2, noise2, smoothstep, clamp, distToSegment2D } from './noise.js';

export const WORLD_RADIUS = 116;
export const WATER_LEVEL = -1.35;
export const POND = { x: 13, z: -22, radius: 17 };
export const SPAWN = { x: 1.5, z: 38 };

export const LANDMARKS = [
  {
    id: 'pool',
    name: 'Mirror Pool',
    subtitle: 'A still eye in the woods',
    text: 'The water keeps a second, softer forest beneath its surface. The old jetty still remembers footsteps.',
    x: 11,
    z: -17,
    color: '#a9cbbd',
    radius: 19,
    glyph: '≈',
  },
  {
    id: 'elder',
    name: 'Elderheart',
    subtitle: 'The tree that was here first',
    text: 'Roots like rivers, a crown like a cathedral. The forest grows quieter when you stand beneath it.',
    x: -44,
    z: -7,
    color: '#c7d69a',
    radius: 22,
    glyph: '♧',
  },
  {
    id: 'stag',
    name: 'The Stagstone',
    subtitle: 'A monument with antlers',
    text: 'No one remembers who raised the stone. The antlers are always warm, even in the deepest shade.',
    x: -31,
    z: 33,
    color: '#d7c9a0',
    radius: 18,
    glyph: '⍙',
  },
  {
    id: 'chapel',
    name: 'Moss Chapel',
    subtitle: 'A prayer half reclaimed',
    text: 'Columns hold up nothing but sky now. Moss has made a softer roof of the ruin.',
    x: 43,
    z: -44,
    color: '#b9c2b6',
    radius: 19,
    glyph: '⌂',
  },
  {
    id: 'arch',
    name: 'Whisper Arch',
    subtitle: 'The wind speaks here',
    text: 'The stone bends but does not break. Hanging vines comb the breeze into a low, patient hum.',
    x: 53,
    z: 19,
    color: '#c9c5ac',
    radius: 17,
    glyph: '∩',
  },
  {
    id: 'glade',
    name: 'Firefly Glade',
    subtitle: 'Where the dusk collects',
    text: 'A ring of pale birches and a carpet of sleeping lights. At the right hour, the whole clearing breathes.',
    x: -12,
    z: -51,
    color: '#e5d69a',
    radius: 19,
    glyph: '✦',
  },
];

export const PATH_POINTS = [
  [
    [1.5, 42],
    [-1, 31],
    [-6, 22],
    [-8, 11],
    [-4, 1],
    [1, -8],
    [8, -12],
    [12, -11],
  ],
  [
    [-4, 1],
    [-14, 0],
    [-25, -2],
    [-35, -5],
    [-44, -7],
  ],
  [
    [-4, 1],
    [-11, 10],
    [-18, 20],
    [-26, 28],
    [-31, 33],
  ],
  [
    [8, -12],
    [20, -22],
    [30, -32],
    [38, -40],
    [43, -44],
  ],
  [
    [8, -12],
    [20, -7],
    [31, 2],
    [43, 12],
    [53, 19],
  ],
  [
    [8, -12],
    [1, -23],
    [-4, -35],
    [-8, -45],
    [-12, -51],
  ],
];

function nearestPath(x, z) {
  let best = 999;
  for (const path of PATH_POINTS) {
    for (let i = 0; i < path.length - 1; i++) {
      const d = distToSegment2D(x, z, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function pathDistance(x, z) {
  return nearestPath(x, z);
}

export function terrainSlope(x, z) {
  const e = 0.65;
  const hx = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  const hz = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  return Math.hypot(hx, hz);
}

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 1.6;
  h += fbm2(x * 0.018 + 4.2, z * 0.018 - 2.1, 4) * 4.3;
  h += fbm2(x * 0.055 - 9.4, z * 0.055 + 6.3, 3) * 1.25;
  h += noise2(x * 0.18 + 12.5, z * 0.18 - 4.9) * 0.22;

  // Soft ridges that give the valley a sense of scale.
  h += 7.2 * Math.exp(-((x - 66) ** 2 + (z + 16) ** 2) / 850);
  h += 5.8 * Math.exp(-((x + 64) ** 2 + (z - 56) ** 2) / 1250);
  h += 4.1 * Math.exp(-((x + 16) ** 2 + (z + 79) ** 2) / 760);

  // The pool bowl.
  const pd = Math.hypot(x - POND.x, z - POND.z);
  const bowl = smoothstep(23, 7, pd);
  h -= 5.2 * bowl;
  // A shallow, meandering outlet toward the south-east.
  const outlet = Math.hypot((x - 26) - (z + 30) * 0.18, (z + 30) * 0.86);
  h -= smoothstep(11, 2.5, Math.max(0, outlet - 2)) * smoothstep(-45, -32, z) * 1.1;

  // A level shelf at the chapel and the glade.
  h = h * (1 - 0.45 * Math.exp(-((x - 43) ** 2 + (z + 44) ** 2) / 150));
  h = h * 0.88 + -0.2 * Math.exp(-((x - 43) ** 2 + (z + 44) ** 2) / 150);

  // Gentle outer rim, swallowed by the mist.
  h += smoothstep(84, 127, r) * 11 + smoothstep(104, 135, r) * 8;

  // Keep the trailhead readable.
  h = h * (1 - 0.26 * Math.exp(-((x - SPAWN.x) ** 2 + (z - SPAWN.z) ** 2) / 190));
  return h;
}

export function groundColor(x, z, h, slope, out = {}) {
  const path = pathDistance(x, z);
  const pd = Math.hypot(x - POND.x, z - POND.z);
  const moisture = fbm2(x * 0.09 + 31, z * 0.09 - 11, 3) * 0.5 + 0.5;
  const variation = fbm2(x * 0.28, z * 0.28, 2);

  let r = 0.29 + variation * 0.035;
  let g = 0.34 + variation * 0.045;
  let b = 0.18 + variation * 0.02;

  // Lush moss in the hollows.
  const moss = smoothstep(-1.4, 2.6, h) * (0.45 + moisture * 0.55);
  r = r * (1 - moss * 0.37) + 0.18 * moss * 0.37;
  g = g * (1 - moss * 0.26) + 0.34 * moss * 0.26;
  b = b * (1 - moss * 0.55) + 0.14 * moss * 0.55;

  // Warm leaf litter on the higher ground.
  const litter = smoothstep(2.2, 8.4, h) * (0.45 + fbm2(x * 0.16 + 7, z * 0.16, 2) * 0.4);
  r += litter * 0.13;
  g += litter * 0.07;
  b += litter * 0.015;

  // Bare rock on steep faces.
  const rock = smoothstep(0.55, 1.35, slope);
  const rr = 0.38 + variation * 0.06;
  const rg = 0.37 + variation * 0.05;
  const rb = 0.31 + variation * 0.05;
  r = r * (1 - rock) + rr * rock;
  g = g * (1 - rock) + rg * rock;
  b = b * (1 - rock) + rb * rock;

  // Wet silt at the water's edge.
  const shore = smoothstep(WATER_LEVEL + 1.75, WATER_LEVEL - 0.12, h) * smoothstep(2.4, 0, path);
  r = r * (1 - shore * 0.72) + 0.22 * shore * 0.72;
  g = g * (1 - shore * 0.72) + 0.21 * shore * 0.72;
  b = b * (1 - shore * 0.72) + 0.14 * shore * 0.72;

  // A worn footpath.
  const trail = smoothstep(1.65, 0.35, path) * smoothstep(1.25, 0.2, slope);
  r = r * (1 - trail) + 0.39 * trail;
  g = g * (1 - trail) + 0.31 * trail;
  b = b * (1 - trail) + 0.2 * trail;

  const wet = smoothstep(WATER_LEVEL + 2.2, WATER_LEVEL - 0.4, h) * (1 - smoothstep(1, 0, path));
  r *= 1 - wet * 0.26;
  g *= 1 - wet * 0.23;
  b *= 1 - wet * 0.17;

  out.r = clamp(r, 0, 1);
  out.g = clamp(g, 0, 1);
  out.b = clamp(b, 0, 1);
  out.path = path;
  out.pd = pd;
  out.slope = slope;
  return out;
}

export function landmarkAt(x, z, visited = null) {
  for (const lm of LANDMARKS) {
    if (visited && visited.has(lm.id)) continue;
    if (Math.hypot(x - lm.x, z - lm.z) < lm.radius) return lm;
  }
  return null;
}
