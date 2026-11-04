// Deterministic hashing + value noise + fBm helpers (no dependencies)
const PERM_SIZE = 256;
const perm = new Uint8Array(PERM_SIZE * 2);
(function seedPerm() {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed;
  };
  const p = new Uint8Array(PERM_SIZE);
  for (let i = 0; i < PERM_SIZE; i++) p[i] = i;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = rand() % (i + 1);
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < PERM_SIZE * 2; i++) perm[i] = p[i & 255];
})();

function hash2(ix, iy) {
  return perm[(perm[ix & 255] + iy) & 255] / 255;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = smooth(fx), uy = smooth(fy);
  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1;
}

export function fbm2(x, y, octaves = 5, lacunarity = 2.02, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function ridged2(x, y, octaves = 5) {
  let amp = 0.55, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2(x * freq, y * freq));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm; // 0..~1
}

export function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(x1, z1, x2, z2) { const dx = x1 - x2, dz = z1 - z2; return dx * dx + dz * dz; }
