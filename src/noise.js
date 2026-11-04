/* Small deterministic noise toolkit used by the procedural world. */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const perm = new Uint8Array(512);
const gradients = [];
{
  const random = mulberry32(90210);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) {
    const angle = (i / 256) * Math.PI * 2;
    gradients.push([Math.cos(angle), Math.sin(angle)]);
  }
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const X = xi & 255;
  const Y = yi & 255;
  const u = fade(xf);
  const v = fade(yf);
  const g = (ix, iy, dx, dy) => {
    const grad = gradients[perm[ix + perm[iy]]];
    return grad[0] * dx + grad[1] * dy;
  };
  const n00 = g(X, Y, xf, yf);
  const n10 = g(X + 1, Y, xf - 1, yf);
  const n01 = g(X, Y + 1, xf, yf - 1);
  const n11 = g(X + 1, Y + 1, xf - 1, yf - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 0.9;
}

export function fbm2(x, y, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * freq, y * freq) * amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum;
}

export function ridge2(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += (1 - Math.abs(noise2(x * freq, y * freq))) * amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* Periodic value noise, for seamless generated textures. */
export function tileNoise(x, y, period = 8) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const wrap = (v) => ((v % period) + period) % period;
  const h = (ix, iy) => hash2(wrap(ix), wrap(iy), 7717);
  const u = fade(xf);
  const v = fade(yf);
  return lerp(
    lerp(h(xi, yi), h(xi + 1, yi), u),
    lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u),
    v
  ) * 2 - 1;
}

export function tileFbm(x, y, octaves = 5, basePeriod = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = basePeriod;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += tileNoise(x * freq, y * freq, freq) * amp;
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = (a, b, t) => a + (b - a) * t;

export function distToSegment2D(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len = vx * vx + vz * vz;
  const t = len ? clamp((wx * vx + wz * vz) / len, 0, 1) : 0;
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
}
