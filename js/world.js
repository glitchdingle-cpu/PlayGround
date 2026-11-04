// Everwild — procedural wilderness: terrain, sky, water, forest and landmarks
import * as THREE from './vendor/three.module.js';
import { fbm2, ridged2, clamp, smoothstep, dist2 } from './noise.js';

export const WATER_LEVEL = 0;
export const WORLD_HALF = 220;          // terrain/water sample extent (±220 m)
const TERRAIN_SIZE = 440;

/* ============================================================
   TERRAIN HEIGHT FIELD (shared by mesh, physics and shaders)
   ============================================================ */
export function terrainHeight(x, z) {
  // Rolling meadow base + fine detail
  const hills = fbm2(x * 0.011 + 3.1, z * 0.011 + 7.7, 5) * 12.5
              + fbm2(x * 0.047 + 13.2, z * 0.047 + 5.9, 3) * 3.0;

  // Northern granite massif — ridged multifractal, fades in toward -z
  const northMask = smoothstep(50, -135, z);
  let r = ridged2(x * 0.0075 + 11.7, z * 0.0075 + 5.1, 5);
  r = Math.pow(r, 2.3) * 128;
  const mountains = r * northMask;

  // Enclosing rim mountains east / west / south
  const rimX = smoothstep(145, 212, Math.abs(x)) * (26 + 22 * fbm2(x * 0.02 + 5.0, z * 0.02 + 1.0, 3));
  const rimZ = smoothstep(165, 214, z) * (24 + 18 * fbm2(x * 0.02 + 9.0, z * 0.02 + 4.0, 3));

  // Crystal Lake basin
  const dL2 = dist2(x, z, 0, 34);
  const lake = -21 * Math.exp(-dL2 / (40 * 40));

  // The Great Falls — a sheer granite cliff rising off the lake's north shore
  const cliffX = (x - 10) / 5.4;
  const fallsShelf = 16.0 * Math.exp(-cliffX * cliffX) * smoothstep(-2.5, -8.5, z);

  return hills + mountains + rimX + rimZ + lake + fallsShelf + 8.5;
}

/* Height map baked to a float texture so the water shader can compute depth */
export function makeHeightTexture(res = 256) {
  const data = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    const z = (j / (res - 1) - 0.5) * TERRAIN_SIZE;
    for (let i = 0; i < res; i++) {
      const x = (i / (res - 1) - 0.5) * TERRAIN_SIZE;
      data[j * res + i] = (terrainHeight(x, z) + 70) / 170; // encode [-70, 100]
    }
  }
  const tex = new THREE.DataTexture(data, res, res, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/* ============================================================
   SKY PALETTE — one source of truth for sky / fog / lights / water
   ============================================================ */
export function skyPalette(elev) {
  // elev = raw sun height (sin of day arc); negative = below horizon
  const goldF = clamp(1 - Math.abs(elev - 0.16) / 0.38, 0, 1) * smoothstep(-0.15, 0.02, elev);
  const nightF = smoothstep(0.05, -0.22, elev);
  const dayF = 1 - Math.max(goldF, nightF);

  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const DAY_ZEN = [0.13, 0.35, 0.60], GOLD_ZEN = [0.34, 0.30, 0.50], NIGHT_ZEN = [0.008, 0.013, 0.042];
  const DAY_HOR = [0.66, 0.78, 0.83], GOLD_HOR = [1.00, 0.58, 0.27], NIGHT_HOR = [0.052, 0.068, 0.135];

  let zen = mix3(DAY_ZEN, GOLD_ZEN, goldF);
  zen = mix3(zen, NIGHT_ZEN, nightF);
  let hor = mix3(DAY_HOR, GOLD_HOR, goldF);
  hor = mix3(hor, NIGHT_HOR, nightF);

  const sunTint = mix3(mix3([1.0, 0.97, 0.88], [1.0, 0.52, 0.21], goldF), [0.72, 0.80, 1.0], nightF);
  const fog = mix3(mix3(hor, zen, 0.25), [0.045, 0.055, 0.11], nightF);

  return {
    zenith: zen, horizon: hor, sunTint, fog,
    nightF, goldF, dayF,
    sunIntensity: clamp(1.15 + elev, 0.22, 2.85) * (1 - nightF * 0.82),
    hemiIntensity: clamp(0.32 + elev * 0.55, 0.18, 0.85),
    dirColor: mix3(mix3([1.0, 0.98, 0.92], [1.0, 0.62, 0.32], goldF), [0.55, 0.65, 0.95], nightF),
  };
}

/* ============================================================
   SMALL CANVAS TEXTURE HELPERS
   ============================================================ */
function makeDetailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 205 + Math.random() * 50;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(56, 56);
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255, 218, 130, 0)');
  grad.addColorStop(0.35, 'rgba(255, 218, 130, 0.55)');
  grad.addColorStop(0.8, 'rgba(255, 218, 130, 0.18)');
  grad.addColorStop(1, 'rgba(255, 218, 130, 0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

function makeSoftDiscTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* Merge simple geometries (position/normal/uv) into one non-indexed geometry */
function mergeGeometries(geoms) {
  const parts = geoms.map(g => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o3 = 0, o2 = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o3);
    nor.set(g.attributes.normal.array, o3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o2);
    o3 += g.attributes.position.count * 3;
    o2 += g.attributes.position.count * 2;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/* Wind-swayed materials registry so the render loop can tick the time uniform */
const windMaterials = [];
export function tickWind(t) {
  for (const m of windMaterials) m.userData.uWindTime.value = t;
}

/* Inject wind sway into a MeshStandardMaterial (keeps instanceMatrix support) */
function addWindSway(material, strength, baseY, topY) {
  material.userData.uWindTime = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = material.userData.uWindTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wpos = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpos = instanceMatrix * wpos;
          #endif
          float phase = wpos.x * 0.16 + wpos.z * 0.14;
          float sway = sin(uWindTime * 1.45 + phase) + 0.45 * sin(uWindTime * 2.6 + phase * 1.7);
          float h = smoothstep(${baseY.toFixed(2)}, ${topY.toFixed(2)}, position.y);
          transformed.x += sway * ${strength.toFixed(3)} * h;
          transformed.z += cos(uWindTime * 1.1 + phase * 1.3) * ${(strength * 0.7).toFixed(3)} * h;
        }`);
  };
  windMaterials.push(material);
}

/* Seeded RNG for stable forest layout */
function makeRNG(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ============================================================
   TERRAIN MESH
   ============================================================ */
export function buildTerrain(scene) {
  const segs = 210;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  // Vertex colors: grass → sand → rock → snow
  const colors = new Float32Array(pos.count * 3);
  const nrm = geo.attributes.normal;
  const cGrassA = new THREE.Color(0x3d6630), cGrassB = new THREE.Color(0x6f9a48), cDry = new THREE.Color(0x8d8a4d);
  const cSand = new THREE.Color(0xc2b183), cMud = new THREE.Color(0x5e574a);
  const cRockA = new THREE.Color(0x54514c), cRockB = new THREE.Color(0x7e7b73);
  const cSnow = new THREE.Color(0xf2f4f6);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), h = pos.getY(i), z = pos.getZ(i);
    const ny = nrm.getY(i);
    const patch = fbm2(x * 0.075 + 21.0, z * 0.075 + 8.0, 3) * 0.5 + 0.5;
    const dry = smoothstep(0.28, 0.62, fbm2(x * 0.05 + 47.0, z * 0.05 + 15.0, 3));

    tmp.copy(cGrassA).lerp(cGrassB, patch);
    tmp.lerp(cDry, dry * 0.55);

    // Sandy shoreline + muddy lakebed
    const sandW = smoothstep(2.1, 0.9, h);
    tmp.lerp(cSand, sandW);
    if (h < WATER_LEVEL + 0.15) tmp.lerp(cMud, clamp((WATER_LEVEL - h) / 5 + 0.35, 0, 0.8));

    // Exposed rock on steeps and at altitude
    const rockW = Math.max(smoothstep(0.82, 0.58, ny), smoothstep(46, 66, h) * 0.9);
    if (rockW > 0) {
      const rockVar = fbm2(x * 0.14 + 3.0, z * 0.14 + 61.0, 3) * 0.5 + 0.5;
      const rc = new THREE.Color().copy(cRockA).lerp(cRockB, rockVar);
      tmp.lerp(rc, clamp(rockW, 0, 1));
    }

    // Snow caps with noisy snowline
    const snowLine = 58 + fbm2(x * 0.03 + 71.0, z * 0.03 + 33.0, 3) * 9;
    const snowW = smoothstep(snowLine, snowLine + 7, h) * smoothstep(0.35, 0.6, ny);
    if (snowW > 0) tmp.lerp(cSnow, clamp(snowW, 0, 1));

    // Crevice shading
    const ao = 0.72 + 0.28 * (fbm2(x * 0.16 + 91.0, z * 0.16 + 17.0, 2) * 0.5 + 0.5);
    colors[i * 3] = tmp.r * ao; colors[i * 3 + 1] = tmp.g * ao; colors[i * 3 + 2] = tmp.b * ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: makeDetailTexture(),
    roughness: 0.97,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

/* ============================================================
   SKY DOME — gradient, sun/moon, stars, procedural clouds
   ============================================================ */
export function buildSky(scene) {
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uGold: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uSunDir;
      uniform float uTime, uNight, uGold;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i), b = hash21(i + vec2(1, 0));
        float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.52; }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;

        // Palette — mirrors skyPalette() on the CPU
        vec3 dayZen = vec3(0.13, 0.35, 0.60), dayHor = vec3(0.66, 0.78, 0.83);
        vec3 goldZen = vec3(0.34, 0.30, 0.50), goldHor = vec3(1.00, 0.58, 0.27);
        vec3 nightZen = vec3(0.008, 0.013, 0.042), nightHor = vec3(0.052, 0.068, 0.135);
        vec3 zen = mix(mix(dayZen, goldZen, uGold), nightZen, uNight);
        vec3 hor = mix(mix(dayHor, goldHor, uGold), nightHor, uNight);

        float grad = pow(smoothstep(-0.12, 0.62, h), 0.78);
        vec3 col = mix(hor, zen, grad);
        // haze hugging the horizon / ground fog below eye level
        col = mix(col, hor * 0.92, smoothstep(0.02, -0.14, h));

        // ---- Sun ----
        vec3 sunDir = normalize(uSunDir);
        float sd = dot(d, sunDir);
        vec3 sunCol = mix(mix(vec3(1.0, 0.97, 0.88), vec3(1.0, 0.55, 0.22), uGold), vec3(0.0), uNight);
        float disc = smoothstep(0.99938, 0.99972, sd);
        float halo = pow(max(sd, 0.0), 300.0) * 1.6 + pow(max(sd, 0.0), 28.0) * 0.38 * (0.6 + uGold);
        col += sunCol * (disc * 3.2 + halo);

        // ---- Moon (opposite the sun) ----
        vec3 moonDir = -sunDir;
        float md = dot(d, moonDir);
        float moonDisc = smoothstep(0.99955, 0.99985, md);
        float moonHalo = pow(max(md, 0.0), 600.0) * 0.9 + pow(max(md, 0.0), 60.0) * 0.12;
        float moonUp = smoothstep(0.02, 0.2, moonDir.y);
        // maria detail
        float maria = vnoise(d.xy * 230.0 + d.z * 150.0);
        vec3 moonCol = vec3(0.86, 0.89, 0.94) * (0.75 + 0.25 * maria);
        col += moonCol * moonDisc * 1.9 * moonUp + vec3(0.6, 0.68, 0.85) * moonHalo * moonUp;

        // ---- Stars ----
        if (uNight > 0.12 && h > -0.02) {
          vec2 cellId = floor(d.xz * 260.0 / max(0.25, d.y + 0.6));
          float star = hash21(cellId);
          float twinkle = 0.65 + 0.35 * sin(uTime * 2.4 + star * 40.0);
          float starMask = smoothstep(0.992, 1.0, star) * twinkle * uNight * smoothstep(-0.02, 0.18, h);
          col += vec3(0.9, 0.93, 1.0) * starMask * 1.6;
        }

        // ---- Procedural clouds ----
        if (h > 0.015) {
          vec2 cp = d.xz / (h + 0.18) * 1.35;
          cp += vec2(uTime * 0.011, uTime * 0.004);
          float cl = fbm(cp * 1.65 + fbm(cp * 3.1) * 0.9);
          float cover = smoothstep(0.50, 0.74, cl);
          // fade clouds at the horizon to avoid hard cutoff
          cover *= smoothstep(0.015, 0.16, h);
          vec3 cloudLit = mix(mix(vec3(1.02, 1.0, 0.98), vec3(1.0, 0.78, 0.55), uGold), vec3(0.16, 0.18, 0.26), uNight);
          vec3 cloudShade = mix(mix(vec3(0.72, 0.76, 0.80), vec3(0.62, 0.45, 0.42), uGold), vec3(0.05, 0.06, 0.10), uNight);
          float shade = fbm(cp * 3.4 - uTime * 0.008) * 0.6;
          vec3 cloudCol = mix(cloudLit, cloudShade, shade);
          // silver lining near the sun
          cloudCol += sunCol * pow(max(sd, 0.0), 18.0) * 0.5;
          col = mix(col, cloudCol, cover * 0.88);
        }

        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(760, 40, 24), mat);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, uniforms };
}

/* ============================================================
   WATER — gerstner vertex waves, depth tint, shore foam, sun glitter
   ============================================================ */
export function buildWater(scene, heightTex) {
  const uniforms = {
    uTime: { value: 0 },
    uHeightMap: { value: heightTex },
    uWaterLevel: { value: WATER_LEVEL },
    uWorldHalf: { value: WORLD_HALF },
    uWorldSize: { value: TERRAIN_SIZE },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uCamPos: { value: new THREE.Vector3() },
    uZenith: { value: new THREE.Vector3(0.13, 0.35, 0.6) },
    uHorizon: { value: new THREE.Vector3(0.66, 0.78, 0.83) },
    uSunTint: { value: new THREE.Vector3(1, 0.97, 0.88) },
    uSunSpec: { value: 1.0 },
    uNight: { value: 0 },
    uFogColor: { value: new THREE.Color(0.6, 0.7, 0.75) },
    uFogNear: { value: 110 },
    uFogFar: { value: 430 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;

      vec3 gerstnerNormal(vec2 p, out vec3 outPos) {
        // 4 directional waves — height + analytic gradient
        float h = 0.0; vec2 grad = vec2(0.0);
        // (dirX, dirY, amplitude, wavelength m)
        vec4 waves[4];
        waves[0] = vec4( 0.94,  0.34, 0.150, 11.0);
        waves[1] = vec4(-0.66,  0.75, 0.105,  6.8);
        waves[2] = vec4( 0.42, -0.91, 0.062,  4.2);
        waves[3] = vec4(-0.88, -0.47, 0.038,  2.6);
        for (int i = 0; i < 4; i++) {
          vec2 dir = normalize(waves[i].xy);
          float amp = waves[i].z;
          float k = 6.28318 / waves[i].w;
          float c = sqrt(9.8 / k) * 0.62;   // dispersion-ish phase speed
          float phase = k * dot(dir, p) - c * uTime;
          h += amp * sin(phase);
          grad += dir * (amp * k * cos(phase));
        }
        vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));
        outPos = vec3(0.0, h, 0.0);
        return n;
      }

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 disp;
        vec3 n = gerstnerNormal(wp.xz, disp);
        wp.y += disp.y;
        vWorldPos = wp.xyz;
        vNormalW = n;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uHeightMap;
      uniform float uTime, uWaterLevel, uWorldHalf, uWorldSize, uSunSpec, uNight;
      uniform vec3 uSunDir, uMoonDir, uCamPos, uZenith, uHorizon, uSunTint;
      uniform vec3 uFogColor;
      uniform float uFogNear, uFogFar;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i), b = hash21(i + vec2(1, 0));
        float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.13; a *= 0.5; }
        return v;
      }

      void main() {
        // ---- Detail normal: two scrolling noise octaves ----
        vec2 p = vWorldPos.xz;
        float t = uTime;
        vec2 o1 = vec2(t * 0.055, t * 0.032);
        vec2 o2 = vec2(-t * 0.041, t * 0.060);
        float e = 0.055;
        float nC = fbm(p * 1.9 + o1) + 0.5 * fbm(p * 4.7 + o2);
        float nX = fbm((p + vec2(e, 0.0)) * 1.9 + o1) + 0.5 * fbm((p + vec2(e, 0.0)) * 4.7 + o2);
        float nZ = fbm((p + vec2(0.0, e)) * 1.9 + o1) + 0.5 * fbm((p + vec2(0.0, e)) * 4.7 + o2);
        vec3 detailN = normalize(vec3((nC - nX) * 2.1, 1.0, (nC - nZ) * 2.1));
        vec3 N = normalize(vNormalW + vec3(detailN.x, 0.0, detailN.z) * 0.85);

        vec3 viewDir = normalize(uCamPos - vWorldPos);

        // ---- Depth from baked height map ----
        vec2 huv = (vWorldPos.xz + uWorldHalf) / uWorldSize;
        float terrainH = texture2D(uHeightMap, huv).r * 170.0 - 70.0;
        float depth = uWaterLevel - terrainH;

        // ---- Base water body colour ----
        vec3 shallow = vec3(0.16, 0.46, 0.44);
        vec3 deep    = vec3(0.008, 0.10, 0.17);
        vec3 body = mix(shallow, deep, clamp(depth / 5.5, 0.0, 1.0));
        // sandy glow where the shelf is barely submerged
        body = mix(vec3(0.32, 0.42, 0.34), body, clamp(depth / 0.85, 0.0, 1.0));

        // ---- Sky reflection (fake but coherent) ----
        float fres = 0.025 + 0.975 * pow(1.0 - max(dot(viewDir, N), 0.0), 5.0);
        vec3 refl = reflect(-viewDir, N);
        float rh = clamp(refl.y, 0.0, 1.0);
        vec3 skyRef = mix(uHorizon, uZenith, pow(rh, 0.72));

        vec3 col = mix(body, skyRef, clamp(fres * 0.92 + 0.07, 0.0, 1.0));

        // ---- Sun glitter ----
        vec3 sunDir = normalize(uSunDir);
        vec3 moonDir = normalize(uMoonDir);
        float glit = fbm(p * 14.0 + vec2(t * 0.35, -t * 0.28));
        float glitMask = smoothstep(0.68, 0.97, glit);
        float specS = pow(max(dot(refl, sunDir), 0.0), 240.0) * (0.9 + 1.9 * glitMask);
        float glintS = pow(max(dot(refl, sunDir), 0.0), 44.0) * 0.16;
        col += uSunTint * (specS + glintS) * uSunSpec;
        // broad sheen path on the water toward the light
        col += uSunTint * pow(max(dot(refl, sunDir), 0.0), 8.0) * 0.045 * (1.0 - uNight);

        // ---- Moon glitter ----
        float specM = pow(max(dot(refl, moonDir), 0.0), 320.0) * (1.2 + 1.8 * glitMask);
        col += vec3(0.75, 0.83, 1.0) * specM * smoothstep(0.02, 0.25, moonDir.y);

        // ---- Shore foam & lapping bands ----
        float shore = smoothstep(1.35, 0.12, depth);          // 1 at waterline
        if (shore > 0.01) {
          float foamN = fbm(p * 3.1 + vec2(t * 0.22, -t * 0.16));
          float lap = sin(depth * 9.0 - t * 1.7 + foamN * 5.0) * 0.5 + 0.5;
          float band = smoothstep(0.55, 0.95, lap) * smoothstep(0.9, 0.25, depth);
          float whitecap = smoothstep(0.62, 0.85, foamN * 0.62 + shore * 0.5 - 0.12);
          float foam = clamp(band * 0.75 + whitecap * shore, 0.0, 1.0);
          col = mix(col, vec3(0.93, 0.96, 0.94), foam * 0.8);
        }

        // ---- Alpha: opaque in deep, soft at the very edge ----
        float alpha = mix(0.72, 0.96, clamp(depth / 1.4, 0.0, 1.0));

        // ---- Fog ----
        float dist = distance(uCamPos, vWorldPos);
        float fogF = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogColor, fogF);

        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const geo = new THREE.PlaneGeometry(560, 560, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_LEVEL;
  mesh.name = 'water';
  mesh.renderOrder = 2;
  scene.add(mesh);
  return { mesh, uniforms };
}

/* ============================================================
   FOREST — instanced pines, bushes, rocks, grass, flowers
   ============================================================ */
export function buildForest(scene, clearings) {
  const rng = makeRNG(20261104);
  const dummy = new THREE.Object3D();
  const isClear = (x, z, pad = 0) => clearings.some(c => dist2(x, z, c.x, c.z) < (c.r + pad) * (c.r + pad));
  const slopeAt = (x, z) => {
    const d = 1.5;
    const dx = terrainHeight(x + d, z) - terrainHeight(x - d, z);
    const dz = terrainHeight(x, z + d) - terrainHeight(x, z - d);
    return Math.hypot(dx, dz) / (2 * d);
  };

  /* ---- Pines: merged 3-tier canopy + trunk, two instanced meshes ---- */
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.30, 2.4, 7);
  trunkGeo.translate(0, 1.2, 0);
  const cone1 = new THREE.ConeGeometry(1.75, 2.6, 8); cone1.translate(0, 3.1, 0);
  const cone2 = new THREE.ConeGeometry(1.28, 2.1, 8); cone2.translate(0, 4.6, 0);
  const cone3 = new THREE.ConeGeometry(0.82, 1.7, 8); cone3.translate(0, 5.9, 0);
  const canopyGeo = mergeGeometries([cone1, cone2, cone3]);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.95 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02 });
  addWindSway(canopyMat, 0.16, 2.4, 6.6);

  const treePos = [];
  let attempts = 0;
  while (treePos.length < 2100 && attempts < 22000) {
    attempts++;
    const x = (rng() * 2 - 1) * 205;
    const z = (rng() * 2 - 1) * 205;
    const h = terrainHeight(x, z);
    if (h < 1.7 || h > 54) continue;
    if (slopeAt(x, z) > 0.62) continue;
    const density = fbm2(x * 0.021 + 99.0, z * 0.021 + 31.0, 3);
    if (density < -0.08 && rng() > 0.35) continue;   // clearings & meadows
    if (isClear(x, z, 2)) continue;
    treePos.push({ x, z, h, s: 0.72 + rng() * 0.85, rot: rng() * Math.PI * 2 });
  }

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePos.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treePos.length);
  trunks.castShadow = true; canopies.castShadow = true;
  canopies.receiveShadow = true;
  const canopyColor = new THREE.Color();
  treePos.forEach((t, i) => {
    dummy.position.set(t.x, t.h - 0.15, t.z);
    dummy.scale.setScalar(t.s);
    dummy.rotation.set(0, t.rot, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);
    const g = 0.75 + rng() * 0.5;
    canopyColor.setRGB(0.16 * g + 0.02, 0.34 * g, 0.17 * g + 0.02);
    canopies.setColorAt(i, canopyColor);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  scene.add(trunks, canopies);

  /* ---- Bushes ---- */
  const bushGeo = new THREE.IcosahedronGeometry(0.62, 1);
  bushGeo.scale(1, 0.72, 1);
  bushGeo.translate(0, 0.42, 0);
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x39582c, roughness: 0.92 });
  addWindSway(bushMat, 0.05, 0.1, 0.9);
  const bushCount = 520;
  const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
  bushes.castShadow = true;
  let bi = 0, bAtt = 0;
  while (bi < bushCount && bAtt++ < 6000) {
    const x = (rng() * 2 - 1) * 200, z = (rng() * 2 - 1) * 200;
    const h = terrainHeight(x, z);
    if (h < 1.6 || h > 46 || slopeAt(x, z) > 0.6 || isClear(x, z, 1)) continue;
    dummy.position.set(x, h - 0.05, z);
    dummy.scale.setScalar(0.6 + rng() * 1.15);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.updateMatrix();
    bushes.setMatrixAt(bi, dummy.matrix);
    bi++;
  }
  bushes.count = bi;
  bushes.instanceMatrix.needsUpdate = true;
  scene.add(bushes);

  /* ---- Rocks & boulders ---- */
  const rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6e6b64, roughness: 0.98, flatShading: true });
  const rockCount = 430;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocks.castShadow = true; rocks.receiveShadow = true;
  let ri = 0, rAtt = 0;
  while (ri < rockCount && rAtt++ < 7000) {
    const x = (rng() * 2 - 1) * 208, z = (rng() * 2 - 1) * 208;
    const h = terrainHeight(x, z);
    if (h < WATER_LEVEL + 0.2) continue;
    const big = rng() > 0.88;
    dummy.position.set(x, h + 0.08, z);
    dummy.scale.set(
      (big ? 1.6 : 0.4) + rng() * (big ? 2.4 : 0.9),
      (big ? 1.2 : 0.35) + rng() * (big ? 1.6 : 0.75),
      (big ? 1.6 : 0.4) + rng() * (big ? 2.4 : 0.9)
    );
    dummy.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6);
    dummy.updateMatrix();
    rocks.setMatrixAt(ri, dummy.matrix);
    ri++;
  }
  rocks.count = ri;
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  /* ---- Grass tufts ---- */
  const tuftGeo = new THREE.ConeGeometry(0.085, 0.62, 5);
  tuftGeo.translate(0, 0.3, 0);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x557c38, roughness: 0.9 });
  addWindSway(tuftMat, 0.075, 0.05, 0.6);
  const tuftCount = 1500;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
  let ti = 0, tAtt = 0;
  while (ti < tuftCount && tAtt++ < 9000) {
    const x = (rng() * 2 - 1) * 190, z = (rng() * 2 - 1) * 190;
    const h = terrainHeight(x, z);
    if (h < 1.5 || h > 40 || slopeAt(x, z) > 0.5) continue;
    dummy.position.set(x, h, z);
    dummy.scale.set(0.8 + rng() * 1.6, 0.7 + rng() * 1.5, 0.8 + rng() * 1.6);
    dummy.rotation.set((rng() - 0.5) * 0.35, rng() * Math.PI * 2, (rng() - 0.5) * 0.35);
    dummy.updateMatrix();
    tufts.setMatrixAt(ti, dummy.matrix);
    ti++;
  }
  tufts.count = ti;
  tufts.instanceMatrix.needsUpdate = true;
  scene.add(tufts);

  /* ---- Wildflowers ---- */
  const flowerGeo = new THREE.IcosahedronGeometry(0.055, 0);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x222211 });
  const petalColors = [0xffd75e, 0xffffff, 0xc79bff, 0xff9ecb, 0xffa94e];
  const flowerCount = 340;
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  const fc = new THREE.Color();
  let fi = 0, fAtt = 0;
  while (fi < flowerCount && fAtt++ < 5000) {
    const x = (rng() * 2 - 1) * 180, z = (rng() * 2 - 1) * 180;
    const h = terrainHeight(x, z);
    if (h < 1.6 || h > 26 || slopeAt(x, z) > 0.4) continue;
    dummy.position.set(x, h + 0.16, z);
    dummy.scale.setScalar(0.8 + rng() * 1.5);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    flowers.setMatrixAt(fi, dummy.matrix);
    fc.setHex(petalColors[(rng() * petalColors.length) | 0]);
    flowers.setColorAt(fi, fc);
    fi++;
  }
  flowers.count = fi;
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  scene.add(flowers);

  return { treeCount: treePos.length };
}

/* ============================================================
   LANDMARKS — the six discoveries
   ============================================================ */
function makeBeam(glowTex) {
  const geo = new THREE.CylinderGeometry(0.55, 0.85, 34, 10, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffd77e,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 17;
  return mesh;
}

function makeCairn(scale = 1) {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7b766c, roughness: 0.95, flatShading: true });
  let y = 0;
  const sizes = [1.5, 1.15, 0.85, 0.58, 0.33];
  for (let i = 0; i < sizes.length; i++) {
    const r = sizes[i] * scale;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    s.scale.y = 0.62;
    s.position.y = y + r * 0.5;
    s.rotation.y = i * 1.3;
    s.castShadow = true;
    group.add(s);
    y += r * 0.82;
  }
  // Sunstone glint
  const sun = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.34 * scale, 0),
    new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xff9d2e, emissiveIntensity: 2.2, roughness: 0.3 })
  );
  sun.position.y = y + 0.42 * scale;
  group.add(sun);
  group.userData.sunstone = sun;
  return group;
}

export function buildLandmarks(scene) {
  const glowTex = makeGlowTexture();
  const softDisc = makeSoftDiscTexture();
  const landmarks = [];
  const group = new THREE.Group();
  scene.add(group);

  const addBeam = (x, y, z) => {
    const beam = makeBeam(glowTex);
    beam.position.set(x, y + 15, z);
    group.add(beam);
    return beam;
  };

  /* 1 — Crystal Lake (dock on the south shore) */
  const dockX = -2, lakeCZ = 34, lakeR = 40;
  // find waterline walking north from z = 120
  let dockZ = 78;
  for (let z = 120; z > lakeCZ; z -= 0.5) {
    if (terrainHeight(dockX, z) < WATER_LEVEL + 0.25) { dockZ = z; break; }
  }
  const shoreH = terrainHeight(dockX, dockZ);
  const dock = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x6b4c2e, roughness: 0.9 });
  const dirZ = lakeCZ - dockZ > 0 ? 1 : -1;
  for (let i = 0; i < 9; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.14, 0.42), plankMat);
    plank.position.set(dockX, WATER_LEVEL + 0.55, dockZ + dirZ * (i * 0.48));
    plank.castShadow = true; plank.receiveShadow = true;
    dock.add(plank);
  }
  for (const sx of [-1.1, 1.1]) {
    for (const off of [0.4, 3.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.5, 6), plankMat);
      post.position.set(dockX + sx, WATER_LEVEL + 0.1, dockZ + dirZ * off);
      dock.add(post);
    }
  }
  group.add(dock);
  const lakePos = new THREE.Vector3(dockX, WATER_LEVEL + 1, dockZ + dirZ * 2);
  landmarks.push({ id: 'lake', name: 'Crystal Lake', desc: 'The heart of the Everwild — cold, clear and impossibly blue.', pos: lakePos, radius: 12, beam: addBeam(lakePos.x, WATER_LEVEL, lakePos.z) });

  /* 2 — The Great Falls (sheer cliff above the north shore) */
  const fallsX = 10, fallsZ = -5.3;
  const fallsHeight = 22.0;
  const fallsUniforms = {
    uTime: { value: 0 },
  };
  const fallsMat = new THREE.ShaderMaterial({
    uniforms: fallsUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform float uTime;
      float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; } return v; }
      void main() {
        vec2 uv = vUv;
        float streaks = fbm(vec2(uv.x * 9.0, uv.y * 3.0 - uTime * 1.35));
        float fine = fbm(vec2(uv.x * 26.0 + 7.0, uv.y * 8.0 - uTime * 2.6));
        float body = smoothstep(0.28, 0.72, streaks * 0.62 + fine * 0.5);
        float edge = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
        float head = smoothstep(1.0, 0.86, uv.y);   // crest fade at top? keep bright
        float foamBottom = smoothstep(0.22, 0.0, uv.y) * (0.6 + 0.4 * sin(uTime * 3.0 + uv.x * 20.0));
        vec3 col = mix(vec3(0.75, 0.86, 0.9), vec3(0.99, 1.0, 1.0), body);
        col += vec3(0.15) * fine;
        float alpha = (0.55 + 0.4 * body) * edge;
        alpha = clamp(alpha + foamBottom * 0.5, 0.0, 0.97);
        alpha *= 0.45 + 0.55 * smoothstep(1.0, 0.88, uv.y); // crest dissolves into mist at the lip
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const falls = new THREE.Mesh(new THREE.PlaneGeometry(5.6, fallsHeight, 1, 1), fallsMat);
  falls.position.set(fallsX, WATER_LEVEL + fallsHeight / 2 - 0.5, fallsZ);
  group.add(falls);
  // Rock horns flanking the falls
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x5a5750, roughness: 1, flatShading: true });
  for (const sx of [-3.6, 3.6]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(1.7, fallsHeight * 0.82, 6), hornMat);
    horn.position.set(fallsX + sx, WATER_LEVEL + fallsHeight * 0.36, fallsZ - 0.9);
    horn.castShadow = true;
    group.add(horn);
  }
  // Mist sprites at the base
  const mistMat = new THREE.SpriteMaterial({ map: softDisc, color: 0xdfeef2, transparent: true, opacity: 0.55, depthWrite: false });
  const mists = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(mistMat.clone());
    sp.position.set(fallsX + (Math.random() - 0.5) * 4.2, WATER_LEVEL + 0.6 + Math.random() * 2.0, fallsZ + 1.0 + Math.random() * 1.4);
    sp.scale.setScalar(1.8 + Math.random() * 2.4);
    mists.push(sp);
    group.add(sp);
  }
  const fallsPos = new THREE.Vector3(fallsX, WATER_LEVEL + 2, 2.0);
  landmarks.push({ id: 'falls', name: 'The Great Falls', desc: 'A silver ribbon falling from the granite shelf.', pos: fallsPos, radius: 12, beam: addBeam(fallsX, WATER_LEVEL, fallsZ + 4) });

  /* 3 — Eagle's Overlook (highest reachable northern peak) */
  let overlook = { h: -Infinity, x: 0, z: -90 };
  for (let z = -150; z < -55; z += 2) {
    for (let x = -95; x < 95; x += 2) {
      const h = terrainHeight(x, z);
      if (h > overlook.h) overlook = { h, x, z };
    }
  }
  const overlookCairn = makeCairn(0.9);
  overlookCairn.position.set(overlook.x, overlook.h - 0.1, overlook.z);
  group.add(overlookCairn);
  const overlookPos = new THREE.Vector3(overlook.x, overlook.h + 1.5, overlook.z);
  landmarks.push({ id: 'overlook', name: "Eagle's Overlook", desc: 'From here the whole Everwild glitters below.', pos: overlookPos, radius: 9, beam: addBeam(overlook.x, overlook.h, overlook.z) });

  /* 4 — Ember Camp (south meadow clearing) */
  const campX = -54, campZ = 55;
  const campH = terrainHeight(campX, campZ);
  const camp = new THREE.Group();
  camp.position.set(campX, campH, campZ);
  // Log benches
  const logMat = new THREE.MeshStandardMaterial({ color: 0x54371f, roughness: 0.95 });
  for (const [lx, lz, rot] of [[-2.6, 0.4, 0.3], [2.4, -0.8, -0.5]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.4, 8), logMat);
    log.rotation.z = Math.PI / 2; log.rotation.y = rot;
    log.position.set(lx, 0.27, lz);
    log.castShadow = true;
    camp.add(log);
  }
  // Stone fire ring
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6f6b63, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.07, 0), stoneMat);
    st.position.set(Math.cos(a) * 1.05, 0.18, Math.sin(a) * 1.05);
    st.scale.y = 0.75;
    camp.add(st);
  }
  // Charred logs crossed
  for (const rot of [0.6, 2.2]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x261812, roughness: 1 }));
    log.rotation.z = Math.PI / 2.35; log.rotation.y = rot;
    log.position.y = 0.32;
    camp.add(log);
  }
  // Tent — a weathered canvas prism
  const tent = new THREE.Mesh(new THREE.ConeGeometry(1.55, 2.15, 4, 1), new THREE.MeshStandardMaterial({ color: 0xb3502e, roughness: 0.85, flatShading: true }));
  tent.rotation.y = Math.PI / 4;
  tent.scale.z = 1.35;
  tent.position.set(-2.2, 1.06, -2.4);
  tent.castShadow = true;
  camp.add(tent);
  group.add(camp);
  // Fire light + particles
  const fireLight = new THREE.PointLight(0xff8f3a, 30, 22, 2.0);
  fireLight.position.set(campX, campH + 1.1, campZ);
  scene.add(fireLight);
  // Particle flames
  const P_COUNT = 90;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_COUNT * 3);
  const pSeed = new Float32Array(P_COUNT);
  for (let i = 0; i < P_COUNT; i++) { pSeed[i] = Math.random(); pPos[i * 3 + 1] = 0; }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const fireUniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };
  const fireMat = new THREE.ShaderMaterial({
    uniforms: fireUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime, uPixelRatio;
      varying float vLife;
      void main() {
        float life = fract(uTime * (0.55 + aSeed * 0.5) + aSeed * 7.31);
        vLife = life;
        float ang = aSeed * 6.28318 * 3.7;
        float rad = (1.0 - life) * 0.34 * (0.4 + aSeed * 0.6);
        vec3 p = vec3(cos(ang) * rad, life * 1.6 + 0.25, sin(ang) * rad);
        p.x += sin(uTime * 2.1 + aSeed * 40.0) * 0.09 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 - life) * 26.0 * uPixelRatio * (1.0 / max(0.6, -mv.z * 0.16));
      }`,
    fragmentShader: /* glsl */`
      varying float vLife;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.05, d);
        vec3 col = mix(vec3(1.0, 0.28, 0.02), vec3(1.0, 0.85, 0.35), pow(1.0 - vLife, 1.6));
        gl_FragColor = vec4(col, core * (1.0 - vLife * 0.85));
      }`,
  });
  const fire = new THREE.Points(pGeo, fireMat);
  fire.position.set(campX, campH, campZ);
  scene.add(fire);
  const campPos = new THREE.Vector3(campX, campH + 1.2, campZ);
  landmarks.push({ id: 'camp', name: 'Ember Camp', desc: 'A fire still warm. Someone passed through, and left the spark alive.', pos: campPos, radius: 10, beam: addBeam(campX, campH, campZ) });

  /* 5 — The Ancient Elder (colossal pine) */
  const elderX = 52, elderZ = -2;
  const elderH = terrainHeight(elderX, elderZ);
  const elder = new THREE.Group();
  elder.position.set(elderX, elderH - 0.2, elderZ);
  const elderTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.92 });
  const elderTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.65, 9.5, 9), elderTrunkMat);
  elderTrunk.position.y = 4.75;
  elderTrunk.castShadow = true;
  elder.add(elderTrunk);
  const elderCanopyMat = new THREE.MeshStandardMaterial({ color: 0x1e3d26, roughness: 0.85 });
  const tiers = [[4.6, 4.4, 8.2], [3.4, 3.6, 11.3], [2.2, 2.8, 13.9]];
  for (const [r, hgt, y] of tiers) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, hgt, 9), elderCanopyMat);
    cone.position.y = y;
    cone.castShadow = true;
    elder.add(cone);
  }
  // Mushroom ring at the roots
  const mushMat = new THREE.MeshStandardMaterial({ color: 0xd8513f, roughness: 0.6, emissive: 0x4a0d05 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const mush = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 6), mushMat);
    mush.position.set(Math.cos(a) * 2.6, 0.16, Math.sin(a) * 2.6);
    elder.add(mush);
  }
  group.add(elder);
  const elderPos = new THREE.Vector3(elderX, elderH + 3, elderZ);
  landmarks.push({ id: 'elder', name: 'The Ancient Elder', desc: 'A pine older than the oldest map, still reaching for the sky.', pos: elderPos, radius: 10, beam: addBeam(elderX, elderH, elderZ) });

  /* 6 — Sunstone Cairn (eastern rise) */
  const cairnX = 74, cairnZ = 46;
  const cairnH = terrainHeight(cairnX, cairnZ);
  const cairn = makeCairn(1.35);
  cairn.position.set(cairnX, cairnH - 0.1, cairnZ);
  group.add(cairn);
  const cairnPos = new THREE.Vector3(cairnX, cairnH + 1.5, cairnZ);
  landmarks.push({ id: 'cairn', name: 'Sunstone Cairn', desc: 'A beacon of golden stone — a waymark left by the first wanderers.', pos: cairnPos, radius: 10, beam: addBeam(cairnX, cairnH, cairnZ) });

  /* Clearings for forest placement */
  const clearings = [
    { x: campX, z: campZ, r: 9 },
    { x: elderX, z: elderZ, r: 5.5 },
    { x: dockX, z: dockZ, r: 6 },
    { x: fallsX, z: 2, r: 8 },
    { x: cairnX, z: cairnZ, r: 5 },
    { x: overlook.x, z: overlook.z, r: 5 },
  ];

  return {
    landmarks, clearings,
    campfire: { x: campX, y: campH, z: campZ, light: fireLight, uniforms: fireUniforms },
    fallsUniforms,
    mists,
    glowTex,
  };
}
