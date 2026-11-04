import * as THREE from '../vendor/three.module.min.js';

/* ============================================================
   WORLD GENERATION
   All geometry and texture work is procedural — no external assets.
   ============================================================ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFacadeTextures(seed, base = '#2b3030', litChance = 0.28) {
  const rand = mulberry32(seed);
  const windows = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      windows.push({
        x: 12 + col * 48,
        y: 20 + row * 33,
        w: 27 + Math.floor(rand() * 8),
        h: 16 + Math.floor(rand() * 4),
        lit: rand() < litChance,
        warm: rand() > 0.32,
        bright: 0.35 + rand() * 0.65,
      });
    }
  }

  const color = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    // concrete grime bands
    for (let i = 0; i < 38; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '8,10,10' : '110,105,90'},${0.02 + rand() * 0.06})`;
      ctx.fillRect(rand() * s, rand() * s, 20 + rand() * 90, 1 + rand() * 10);
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(5,6,6,0.18)';
      ctx.fillRect(0, 25 + i * 32, s, 2);
    }
    windows.forEach((w) => {
      const grd = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
      if (w.lit) {
        grd.addColorStop(0, w.warm ? `rgba(255,187,99,${w.bright})` : `rgba(138,193,188,${w.bright * 0.8})`);
        grd.addColorStop(1, w.warm ? 'rgba(129,67,27,0.5)' : 'rgba(45,69,70,0.5)');
      } else {
        grd.addColorStop(0, 'rgba(10,14,16,0.96)');
        grd.addColorStop(1, 'rgba(5,8,9,0.96)');
      }
      ctx.fillStyle = grd;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(8,9,8,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      if (rand() > 0.7) {
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.fillRect(w.x, w.y, w.w, w.h * 0.48);
      }
    });
    // rust / water streaks
    for (let i = 0; i < 9; i++) {
      const x = rand() * s;
      ctx.fillStyle = `rgba(64,39,24,${0.08 + rand() * 0.1})`;
      ctx.fillRect(x, rand() * 30, 2 + rand() * 4, 60 + rand() * 150);
    }
  });

  const emissive = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, s, s);
    windows.forEach((w) => {
      if (!w.lit) return;
      ctx.fillStyle = w.warm ? `rgba(255,164,78,${w.bright})` : `rgba(110,190,184,${w.bright * 0.7})`;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      if (w.warm) ctx.fillRect(w.x, w.y, w.w * 0.4, w.h);
    });
  });

  return { color, emissive };
}

function makeAsphaltTexture() {
  const rand = mulberry32(9921);
  return canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#202425';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 15000; i++) {
      const v = 20 + Math.floor(rand() * 35);
      ctx.fillStyle = `rgba(${v},${v + 1},${v},${0.2 + rand() * 0.35})`;
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 2, 1 + rand() * 2);
    }
    for (let i = 0; i < 55; i++) {
      ctx.strokeStyle = `rgba(7,9,9,${0.18 + rand() * 0.32})`;
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      let x = rand() * s;
      let y = rand() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (rand() - 0.5) * 35;
        y += (rand() - 0.5) * 35;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // faded road paint
    ctx.fillStyle = 'rgba(165,155,110,0.22)';
    for (let y = 0; y < s; y += 82) ctx.fillRect(s * 0.49, y, 5, 41);
    // drains / patches
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = 'rgba(6,8,8,0.22)';
      ctx.fillRect(rand() * s, rand() * s, 50 + rand() * 100, 20 + rand() * 50);
    }
  });
}

function makeConcreteTexture() {
  const rand = mulberry32(443);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#4b4d46';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 3800; i++) {
      const v = 48 + Math.floor(rand() * 50);
      ctx.fillStyle = `rgba(${v},${v},${v - 4},${0.12 + rand() * 0.25})`;
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 3, 1 + rand() * 3);
    }
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(20,21,19,${0.2 + rand() * 0.25})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let x = rand() * s;
      let y = rand() * s;
      ctx.moveTo(x, y);
      for (let j = 0; j < 3; j++) {
        x += (rand() - 0.5) * 30;
        y += (rand() - 0.5) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function makeCorrugatedTexture(base, seed) {
  const rand = mulberry32(seed);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 9) {
      const grad = ctx.createLinearGradient(x, 0, x + 9, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0.08)');
      grad.addColorStop(0.42, 'rgba(0,0,0,0.32)');
      grad.addColorStop(0.68, 'rgba(255,255,255,0.04)');
      grad.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 9, s);
    }
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(102,52,20,${0.03 + rand() * 0.16})`;
      ctx.fillRect(rand() * s, rand() * s, 2 + rand() * 20, 2 + rand() * 30);
    }
    ctx.fillStyle = 'rgba(15,18,17,0.55)';
    ctx.fillRect(s * 0.47, 0, 4, s);
    ctx.strokeStyle = 'rgba(10,12,11,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, s - 2, s - 2);
  });
}

function softCircleTexture(size = 128, inner = 'rgba(255,255,255,1)') {
  return canvasTexture(size, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function makeSmokeTexture() {
  const rand = mulberry32(71);
  return canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 35; i++) {
      const r = 4 + rand() * 20;
      ctx.fillStyle = `rgba(255,255,255,${0.008 + rand() * 0.018})`;
      ctx.beginPath();
      ctx.arc(rand() * s, rand() * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * Collapse the static parts of the city into a handful of draw calls.
 *
 * The map is assembled from hundreds of small primitives. That is convenient
 * to author, but it is brutal on low-power GPUs, so after construction we bake
 * each material's tint into vertex colours, group compatible materials, and
 * merge their geometry. Meshes that animate keep their own draw calls.
 */
function mergeStaticWorld(scene) {
  const buckets = new Map();
  const removals = [];
  const toMerge = [];

  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.userData.noMerge) return;
    if (!obj.geometry || !obj.geometry.attributes.position) return;
    if (obj.material && obj.material.isShaderMaterial) return;
    toMerge.push(obj);
  });

  const round = (v) => Math.round(v * 1000) / 1000;
  const colorKey = (c) => `${round(c.r)},${round(c.g)},${round(c.b)}`;

  function materialKey(material) {
    const map = material.map ? material.map.uuid : '-';
    const emissiveMap = material.emissiveMap ? material.emissiveMap.uuid : '-';
    const alphaMap = material.alphaMap ? material.alphaMap.uuid : '-';
    const alphaTest = material.alphaTest || 0;
    const base = [
      material.type,
      map,
      emissiveMap,
      alphaMap,
      material.transparent ? 1 : 0,
      round(material.opacity ?? 1),
      material.side,
      material.blending,
      material.depthWrite ? 1 : 0,
      material.depthTest ? 1 : 0,
      round(alphaTest),
      material.polygonOffset ? 1 : 0,
      material.vertexColors ? 1 : 0,
    ];
    if (material.isMeshStandardMaterial) {
      base.push(
        Math.round(material.roughness * 12),
        Math.round(material.metalness * 12),
        material.flatShading ? 1 : 0,
        colorKey(material.emissive),
        round(material.emissiveIntensity ?? 1),
        material.normalMap ? material.normalMap.uuid : '-',
        round(material.envMapIntensity ?? 1)
      );
    }
    if (material.isMeshBasicMaterial) base.push(material.wireframe ? 1 : 0);
    return base.join('|');
  }

  function addGeometry(obj, material, geometry, group) {
    const key = materialKey(material);
    let bucket = buckets.get(key);
    if (!bucket) {
      const base = material.clone();
      base.color.setRGB(1, 1, 1);
      base.vertexColors = true;
      bucket = {
        material: base,
        positions: [],
        normals: [],
        uvs: [],
        colors: [],
        castShadow: false,
        receiveShadow: false,
        count: 0,
      };
      buckets.set(key, bucket);
    }

    const pos = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const index = geometry.getIndex();
    const start = group ? group.start : 0;
    const count = group ? group.count : index ? index.count : pos.count;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const col = material.color;

    for (let i = 0; i < count; i++) {
      const vi = index ? index.getX(start + i) : start + i;
      v.fromBufferAttribute(pos, vi).applyMatrix4(obj.matrixWorld);
      bucket.positions.push(v.x, v.y, v.z);
      if (normal) {
        n.fromBufferAttribute(normal, vi).applyMatrix3(normalMatrix).normalize();
        bucket.normals.push(n.x, n.y, n.z);
      } else {
        bucket.normals.push(0, 1, 0);
      }
      if (uv) bucket.uvs.push(uv.getX(vi), uv.getY(vi));
      else bucket.uvs.push(0, 0);
      bucket.colors.push(col.r, col.g, col.b);
    }
    bucket.castShadow ||= obj.castShadow;
    bucket.receiveShadow ||= obj.receiveShadow;
    bucket.count += count;
  }

  for (const obj of toMerge) {
    const geometry = obj.geometry;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    if (materials.length > 1 && geometry.groups.length) {
      for (const group of geometry.groups) {
        const material = materials[group.materialIndex] || materials[0];
        if (!material || material.isShaderMaterial) continue;
        addGeometry(obj, material, geometry, group);
      }
    } else {
      const material = materials[0];
      if (!material || material.isShaderMaterial) continue;
      addGeometry(obj, material, geometry, null);
    }
    removals.push(obj);
  }

  for (const obj of removals) {
    if (obj.parent) obj.parent.remove(obj);
  }

  let mergedCount = 0;
  for (const bucket of buckets.values()) {
    if (!bucket.count) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
    mergedCount++;
  }

  return { sourceMeshes: removals.length, mergedMeshes: mergedCount };
}

export function createWorld(scene, renderer, options = {}) {
  const lowPower = !!options.lowPower;
  const colliders = [];
  const occluders = [];
  const dynamicLights = [];
  const animated = [];
  const smokePuffs = [];
  const fireLights = [];

  const asphalt = makeAsphaltTexture();
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  asphalt.repeat.set(10, 10);
  const concrete = makeConcreteTexture();
  concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
  const smokeTexture = makeSmokeTexture();
  const glowTexture = softCircleTexture();
  const rand = mulberry32(4771);

  const mat = {
    asphalt: new THREE.MeshStandardMaterial({ map: asphalt, color: 0x8a8e8c, roughness: 0.93, metalness: 0.04 }),
    sidewalk: new THREE.MeshStandardMaterial({ map: concrete, color: 0x6d7068, roughness: 0.95 }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, color: 0x777b6d, roughness: 0.9 }),
    concreteDark: new THREE.MeshStandardMaterial({ map: concrete, color: 0x3e423b, roughness: 0.92 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x333a38, roughness: 0.5, metalness: 0.65 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x141918, roughness: 0.55, metalness: 0.72 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x5b3522, roughness: 0.85, metalness: 0.25 }),
    sandbag: new THREE.MeshStandardMaterial({ color: 0x6c6549, roughness: 0.96 }),
    sandbagDark: new THREE.MeshStandardMaterial({ color: 0x56503b, roughness: 0.98 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x55402c, roughness: 0.9 }),
    tarp: new THREE.MeshStandardMaterial({ color: 0x313a30, roughness: 0.98, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x102124, roughness: 0.22, metalness: 0.65, emissive: 0x071214, emissiveIntensity: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: 0x080a0a, roughness: 0.7 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0e0d, roughness: 0.95 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0xd6a33a, roughness: 0.7, emissive: 0x3a2104, emissiveIntensity: 0.35 }),
    greenGlow: new THREE.MeshStandardMaterial({ color: 0x10231a, emissive: 0x58ff9a, emissiveIntensity: 2.2 }),
    redGlow: new THREE.MeshStandardMaterial({ color: 0x260807, emissive: 0xff3a20, emissiveIntensity: 2.5 }),
    ladder: new THREE.MeshStandardMaterial({ color: 0x2c3332, roughness: 0.6, metalness: 0.5 }),
  };

  // ---------------------------------------------------------------- SKY
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x03060a) },
        midColor: { value: new THREE.Color(0x18252b) },
        horizonColor: { value: new THREE.Color(0x503529) },
        glowColor: { value: new THREE.Color(0xa65a26) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 glowColor;
        void main() {
          vec3 n = normalize(vPos);
          float h = n.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(-0.06, 0.22, h));
          col = mix(col, topColor, smoothstep(0.16, 0.8, h));
          float band = pow(clamp(1.0 - abs(h + 0.025) * 3.3, 0.0, 1.0), 4.0);
          float side = smoothstep(-0.9, 0.7, n.x) * (0.55 + 0.45 * smoothstep(-0.5, 0.5, n.z));
          col += glowColor * band * side * 0.42;
          float haze = smoothstep(0.16, 0.36, h) * (1.0 - smoothstep(0.36, 0.62, h));
          col += horizonColor * haze * 0.22;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.frustumCulled = false;
  scene.add(sky);

  // Stars
  const starCount = lowPower ? 380 : 720;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(0.02 + rand() * 0.97);
    const r = 170;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPos[i * 3 + 1] = Math.cos(phi) * r * 0.85 + 4;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xb7ccd5, size: 1.15, sizeAttenuation: false, transparent: true, opacity: 0.62, depthWrite: false })
  );
  scene.add(stars);

  // Moon + glow
  const moonTexture = softCircleTexture(128, 'rgba(235,244,238,1)');
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture, color: 0x9fb9c4, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonGlow.position.set(-80, 64, -135);
  moonGlow.scale.set(70, 70, 1);
  scene.add(moonGlow);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture, color: 0xe1e9de, transparent: true, opacity: 0.95, depthWrite: false }));
  moon.position.copy(moonGlow.position);
  moon.scale.set(21, 21, 1);
  scene.add(moon);

  // Distant skyline
  const skylineMat = new THREE.MeshBasicMaterial({ color: 0x090d10, fog: true });
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2 + rand() * 0.1;
    const radius = 72 + rand() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const w = 4 + rand() * 10;
    const h = 9 + rand() * 30;
    const d = 4 + rand() * 10;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skylineMat);
    b.position.set(x, h / 2 - 2, z);
    scene.add(b);
    if (rand() > 0.7) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4 + rand() * 6, 4), skylineMat);
      antenna.position.set(x, h + 2, z);
      scene.add(antenna);
    }
  }

  // ---------------------------------------------------------------- LIGHTS
  scene.add(new THREE.HemisphereLight(0x708799, 0x271a10, 1.2));
  const moonLight = new THREE.DirectionalLight(0xadc4d6, 1.9);
  moonLight.position.set(-32, 42, 18);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  moonLight.shadow.camera.left = -43;
  moonLight.shadow.camera.right = 43;
  moonLight.shadow.camera.top = 43;
  moonLight.shadow.camera.bottom = -43;
  moonLight.shadow.camera.near = 1;
  moonLight.shadow.camera.far = 110;
  moonLight.shadow.bias = -0.0007;
  moonLight.shadow.normalBias = 0.025;
  scene.add(moonLight);

  const warmFill = new THREE.DirectionalLight(0xd77a3e, 0.78);
  warmFill.position.set(22, 8, -20);
  scene.add(warmFill);

  // ---------------------------------------------------------------- GROUND
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(108, 108), mat.asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  occluders.push(ground);

  // Street strips and sidewalks
  function addBox(w, h, d, x, y, z, material, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    scene.add(mesh);
    if (opts.collider) {
      if (opts.rotY) {
        const cos = Math.abs(Math.cos(opts.rotY));
        const sin = Math.abs(Math.sin(opts.rotY));
        const cw = w * cos + d * sin;
        const cd = w * sin + d * cos;
        colliders.push({ minX: x - cw / 2, maxX: x + cw / 2, minZ: z - cd / 2, maxZ: z + cd / 2, h });
      } else {
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
      }
    }
    if (opts.occluder !== false && w > 0.5 && h > 0.3 && d > 0.5) occluders.push(mesh);
    if (opts.name) mesh.name = opts.name;
    return mesh;
  }

  function addSidewalk(w, d, x, z) {
    const slab = addBox(w, 0.16, d, x, 0.08, z, mat.sidewalk, { castShadow: false, occluder: false });
    slab.receiveShadow = true;
    return slab;
  }

  // Cross streets / shoulders
  addBox(82, 0.025, 10.5, 0, 0.015, 13, new THREE.MeshStandardMaterial({ color: 0x1d2222, roughness: 0.98 }), { castShadow: false, occluder: false });
  addBox(9.5, 0.028, 72, 0, 0.016, -6, new THREE.MeshStandardMaterial({ color: 0x1b2020, roughness: 0.98 }), { castShadow: false, occluder: false });
  // Lane paint
  const paintMat = new THREE.MeshStandardMaterial({ color: 0x8e845b, roughness: 0.85, emissive: 0x151106, emissiveIntensity: 0.3 });
  for (let i = 0; i < 8; i++) {
    addBox(0.13, 0.012, 4.4, 0, 0.033, 4 - i * 7.5, paintMat, { castShadow: false, occluder: false });
  }
  for (let i = 0; i < 9; i++) {
    addBox(3.5, 0.012, 0.13, -26 + i * 6.5, 0.033, 13, paintMat, { castShadow: false, occluder: false });
  }

  // ---------------------------------------------------------------- BUILDINGS
  const facadeSets = [
    makeFacadeTextures(117, '#2d3332', 0.27),
    makeFacadeTextures(882, '#3a352d', 0.24),
    makeFacadeTextures(1290, '#29302f', 0.32),
  ];

  function addBuilding(cx, cz, w, d, h, seedIndex, opts = {}) {
    const facade = facadeSets[seedIndex % facadeSets.length];
    const sideMat = new THREE.MeshStandardMaterial({
      map: facade.color,
      emissiveMap: facade.emissive,
      emissive: 0xffffff,
      emissiveIntensity: 0.62,
      color: 0x9ba09a,
      roughness: 0.84,
      metalness: 0.08,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x161b1b, roughness: 0.9 });
    const materials = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
    building.position.set(cx, h / 2, cz);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    occluders.push(building);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });

    // Roof lip and utility clutter
    addBox(w + 0.4, 0.38, d + 0.4, cx, h + 0.12, cz, mat.concreteDark, { castShadow: true });
    for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
      const cw = 1 + rand() * 2.2;
      addBox(cw, 0.55 + rand() * 0.6, cw * 0.8, cx + (rand() - 0.5) * (w - 3), h + 0.5, cz + (rand() - 0.5) * (d - 3), mat.metal, { castShadow: true, occluder: false });
    }
    // Ground-floor doorway
    if (opts.door !== false) {
      const door = addBox(1.5, 2.4, 0.12, cx + (rand() - 0.5) * (w - 3), 1.2, cz + d / 2 + 0.07, mat.black, { castShadow: false, occluder: false });
      door.receiveShadow = false;
      addBox(1.85, 0.18, 0.28, door.position.x, 2.5, door.position.z, mat.concreteDark, { castShadow: true, occluder: false });
    }
    // Wall vents / pipes
    if (rand() > 0.35) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h * 0.7, 6), mat.ladder);
      pipe.position.set(cx + (rand() > 0.5 ? -1 : 1) * (w / 2 + 0.15), h * 0.42, cz + (rand() - 0.5) * d * 0.7);
      pipe.castShadow = true;
      scene.add(pipe);
    }
    return building;
  }

  addBuilding(-21, -22, 15, 14, 11, 0);
  addBuilding(20, -23, 13, 12, 15, 2);
  addBuilding(-31, 4, 10, 16, 10, 1);
  addBuilding(31, 5, 9, 15, 8, 0);
  addBuilding(-24, 27, 13, 9, 7, 1, { door: false });
  addBuilding(25, 27, 12, 9, 10, 2);
  // Elevated rail / overpass silhouette in the far back
  addBox(56, 1.1, 3.4, 0, 9.8, -38, mat.concreteDark, { castShadow: true, occluder: false });
  for (let i = -2; i <= 2; i++) {
    addBox(1.1, 9.8, 1.1, i * 20, 4.9, -38, mat.concreteDark, { castShadow: true, occluder: false });
  }

  // ---------------------------------------------------------------- PERIMETER
  const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x1a201e, roughness: 0.95 });
  // Low ruined wall segments (visual boundary)
  addBox(16, 2.1, 0.7, -29, 1.05, 34.5, boundaryMat, { collider: true });
  addBox(22, 1.7, 0.7, 19, 0.85, 34.5, boundaryMat, { collider: true });
  addBox(0.7, 2.4, 18, -37, 1.2, 22, boundaryMat, { collider: true });
  addBox(0.7, 1.8, 16, 37, 0.9, 23, boundaryMat, { collider: true });
  // Invisible playfield edges
  colliders.push({ minX: -38.5, maxX: -37.6, minZ: -42, maxZ: 42, h: 6 });
  colliders.push({ minX: 37.6, maxX: 38.5, minZ: -42, maxZ: 42, h: 6 });
  colliders.push({ minX: -42, maxX: 42, minZ: -39.5, maxZ: -38.6, h: 6 });
  colliders.push({ minX: -42, maxX: 42, minZ: 38.6, maxZ: 39.5, h: 6 });

  // ---------------------------------------------------------------- UPLINK LANDMARK
  const uplink = new THREE.Group();
  uplink.position.set(0, 0, -2.5);
  scene.add(uplink);

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.35, 0.24, 12), mat.concreteDark);
  platform.position.y = 0.12;
  platform.receiveShadow = true;
  platform.castShadow = true;
  uplink.add(platform);

  const uplinkBox = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 1.05), mat.metal);
  uplinkBox.position.y = 0.72;
  uplinkBox.castShadow = true;
  uplink.add(uplinkBox);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ color: 0x6aff9b, transparent: true, opacity: 0.9 }));
  screen.position.set(0, 0.8, 0.531);
  uplink.add(screen);
  const screenLine = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.012), new THREE.MeshBasicMaterial({ color: 0xd6ffe3 }));
  screenLine.position.set(0, 0.8, 0.537);
  uplink.add(screenLine);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.1, 6), mat.darkMetal);
  mast.position.y = 2.65;
  uplink.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat.redGlow);
  beacon.position.y = 4.2;
  uplink.add(beacon);
  // These pieces are animated or have their opacity changed every frame.
  screen.userData.noMerge = true;
  screenLine.userData.noMerge = true;
  beacon.userData.noMerge = true;
  const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff472e, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  beaconGlow.position.y = 4.2;
  beaconGlow.scale.set(1.5, 1.5, 1);
  uplink.add(beaconGlow);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.025, 6, 48), mat.greenGlow);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 0.3;
  ring1.userData.noMerge = true;
  uplink.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.018, 6, 48), mat.greenGlow);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.32;
  ring2.userData.noMerge = true;
  uplink.add(ring2);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x65ffa0, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.7, 12, 12, 1, true), beamMat);
  beam.position.y = 6;
  beam.userData.noMerge = true;
  uplink.add(beam);

  const uplinkLight = new THREE.PointLight(0x5aff95, 13, 8, 2);
  uplinkLight.position.y = 1.2;
  uplink.add(uplinkLight);
  colliders.push({ minX: -1.35, maxX: 1.35, minZ: -3.9, maxZ: -1.1, h: 1.4 });
  occluders.push(uplinkBox);

  animated.push({
    update(t) {
      ring1.rotation.z = t * 0.55;
      ring2.rotation.z = -t * 0.32;
      const pulse = 0.72 + Math.sin(t * 3.4) * 0.28;
      uplinkLight.intensity = 9 + pulse * 5;
      screen.material.opacity = 0.55 + pulse * 0.35;
      beaconGlow.material.opacity = 0.2 + Math.max(0, Math.sin(t * 2.1)) * 0.5;
      beam.material.opacity = 0.04 + pulse * 0.025;
    },
  });

  // ---------------------------------------------------------------- CONTAINERS / COVER
  const containerMats = [
    new THREE.MeshStandardMaterial({ map: makeCorrugatedTexture('#31443b', 31), roughness: 0.8, metalness: 0.32 }),
    new THREE.MeshStandardMaterial({ map: makeCorrugatedTexture('#67412a', 71), roughness: 0.86, metalness: 0.26 }),
    new THREE.MeshStandardMaterial({ map: makeCorrugatedTexture('#2f3b46', 19), roughness: 0.8, metalness: 0.35 }),
  ];

  function addContainer(x, z, w, d, h, colorIndex, rotY = 0) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), containerMats[colorIndex % 3]);
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);
    // corner rails
    const rail = new THREE.MeshStandardMaterial({ color: 0x1a211f, roughness: 0.55, metalness: 0.65 });
    const railGeo = new THREE.BoxGeometry(0.12, h + 0.08, 0.12);
    [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]].forEach(([rx, rz]) => {
      const r = new THREE.Mesh(railGeo, rail);
      r.position.set(rx, 0, rz);
      r.castShadow = true;
      g.add(r);
    });
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.11, d + 0.05), rail);
    topRail.position.y = h / 2 + 0.04;
    g.add(topRail);
    g.position.set(x, h / 2 + 0.08, z);
    g.rotation.y = rotY;
    scene.add(g);
    occluders.push(box);
    if (rotY) {
      const cos = Math.abs(Math.cos(rotY));
      const sin = Math.abs(Math.sin(rotY));
      const cw = w * cos + d * sin;
      const cd = w * sin + d * cos;
      colliders.push({ minX: x - cw / 2, maxX: x + cw / 2, minZ: z - cd / 2, maxZ: z + cd / 2, h });
    } else {
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, h });
    }
    return g;
  }

  addContainer(-16.5, 12.5, 6.2, 2.7, 2.7, 0, 0);
  addContainer(17.5, 14.5, 6.2, 2.7, 2.7, 2, Math.PI / 2);
  addContainer(13.8, -9.5, 5.8, 2.6, 2.6, 1, 0);

  function addConcreteBarrier(x, z, w, rotY = 0) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.36, 0.82), mat.concreteDark);
    base.position.y = 0.18;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.72, 0.5), mat.concrete);
    top.position.y = 0.62;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.65, 0.13, 0.51), mat.hazard);
    stripe.position.y = 0.7;
    g.add(stripe);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    if (rotY) {
      const cw = Math.abs(Math.cos(rotY)) * w + Math.abs(Math.sin(rotY)) * 0.8;
      const cd = Math.abs(Math.sin(rotY)) * w + Math.abs(Math.cos(rotY)) * 0.8;
      colliders.push({ minX: x - cw / 2, maxX: x + cw / 2, minZ: z - cd / 2, maxZ: z + cd / 2, h: 1 });
    } else {
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - 0.41, maxZ: z + 0.41, h: 1 });
    }
    occluders.push(base, top);
    return g;
  }

  addConcreteBarrier(-6.2, -8.5, 4.2, 0);
  addConcreteBarrier(7.1, -7.6, 4.2, 0);
  addConcreteBarrier(-9.2, 4.8, 5.0, 0);
  addConcreteBarrier(10.7, 5.4, 4.6, 0);
  addConcreteBarrier(-25.5, 18.4, 4.8, Math.PI / 2);
  addConcreteBarrier(26.2, -15.8, 5.2, Math.PI / 2);

  function addSandbags(x, z, w, rotY = 0) {
    const g = new THREE.Group();
    const rows = 3;
    const bagW = 0.88;
    const count = Math.max(2, Math.round(w / bagW));
    const geo = new THREE.SphereGeometry(0.5, 8, 5);
    geo.scale(0.94, 0.35, 0.58);
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < count; i++) {
        const bag = new THREE.Mesh(geo, (row + i) % 3 === 0 ? mat.sandbagDark : mat.sandbag);
        bag.position.set((i - (count - 1) / 2) * bagW + (row % 2 ? 0.32 : 0), 0.2 + row * 0.3, (rand() - 0.5) * 0.08);
        bag.rotation.y = (rand() - 0.5) * 0.18;
        bag.scale.set(1 + (rand() - 0.5) * 0.1, 1, 1);
        bag.castShadow = true;
        bag.receiveShadow = true;
        g.add(bag);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    const cos = Math.abs(Math.cos(rotY));
    const sin = Math.abs(Math.sin(rotY));
    const cw = cos * w + sin * 0.95;
    const cd = sin * w + cos * 0.95;
    colliders.push({ minX: x - cw / 2, maxX: x + cw / 2, minZ: z - cd / 2, maxZ: z + cd / 2, h: 1.05 });
    occluders.push(g.children[0]);
    return g;
  }

  addSandbags(-8.6, 7.2, 4.4, 0);
  addSandbags(8.4, 8.4, 4.4, 0);
  addSandbags(-19.5, -6.4, 3.8, Math.PI / 2);
  addSandbags(19.8, -2.6, 3.8, Math.PI / 2);

  // crates
  function addCrate(x, z, size, rotY = 0) {
    const group = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.78, size), mat.wood);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2e2a20, roughness: 0.9 });
    const frameGeo = new THREE.BoxGeometry(size * 1.03, 0.06, 0.06);
    for (const y of [-size * 0.32, size * 0.32]) {
      for (const zz of [-size / 2, size / 2]) {
        const f = new THREE.Mesh(frameGeo, frameMat);
        f.position.set(0, y, zz);
        group.add(f);
      }
    }
    group.position.set(x, size * 0.39, z);
    group.rotation.y = rotY;
    scene.add(group);
    colliders.push({ minX: x - size * 0.55, maxX: x + size * 0.55, minZ: z - size * 0.55, maxZ: z + size * 0.55, h: size });
    occluders.push(box);
    return group;
  }

  addCrate(-11.7, -12.8, 1.4, 0.1);
  addCrate(-10.5, -12.3, 1.05, -0.2);
  addCrate(12.7, 10.5, 1.25, 0.5);
  addCrate(-15.5, 28, 1.5, 0.15);
  addCrate(6.2, -15.8, 1.2, -0.3);
  addCrate(5.4, -14.8, 0.9, 0.2);

  // barrels
  function addBarrel(x, z, burning = false) {
    const group = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.95, 12), mat.rust);
    barrel.position.y = 0.475;
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);
    const bandGeo = new THREE.TorusGeometry(0.39, 0.025, 5, 12);
    for (const y of [0.22, 0.72]) {
      const band = new THREE.Mesh(bandGeo, mat.darkMetal);
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      group.add(band);
    }
    if (burning) {
      const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xff6b23, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      fire.position.y = 1.25;
      fire.scale.set(1.3, 2.0, 1);
      group.add(fire);
      const light = new THREE.PointLight(0xff6b28, 34, 14, 2);
      light.position.y = 1.4;
      group.add(light);
      fireLights.push({ light, fire, seed: rand() * 10 });
    }
    group.position.set(x, 0, z);
    scene.add(group);
    colliders.push({ minX: x - 0.44, maxX: x + 0.44, minZ: z - 0.44, maxZ: z + 0.44, h: 1 });
    occluders.push(barrel);
    return group;
  }

  addBarrel(4.1, -12.8, true);
  addBarrel(4.8, -13.7);
  addBarrel(-25.2, 13.1, false);
  addBarrel(20.1, 18.8, true);
  addBarrel(-4.2, 17.6);

  // ---------------------------------------------------------------- WRECKED HUMVEE
  function addHumvee(x, z, rotY = 0) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3e4337, roughness: 0.85, metalness: 0.2 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 4.2), bodyMat);
    chassis.position.y = 0.72;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    g.add(chassis);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.9, 1.85), bodyMat);
    cabin.position.set(0, 1.45, -0.1);
    cabin.castShadow = true;
    g.add(cabin);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.34, 1.1), bodyMat);
    hood.position.set(0, 1.05, 1.45);
    g.add(hood);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.55, 0.08), mat.glass);
    windshield.position.set(0, 1.62, 0.82);
    g.add(windshield);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    [[-1.12, 1.28], [1.12, 1.28], [-1.12, -1.35], [1.12, -1.35]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, mat.rubber);
      wheel.position.set(wx, 0.42, wz);
      wheel.castShadow = true;
      g.add(wheel);
    });
    // mounted gun / broken turret
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.2, 8), mat.darkMetal);
    turret.position.set(0, 1.98, -0.2);
    g.add(turret);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), mat.darkMetal);
    gun.position.set(0.1, 2.1, 0.3);
    g.add(gun);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.rotation.z = 0.035;
    scene.add(g);
    const cos = Math.abs(Math.cos(rotY));
    const sin = Math.abs(Math.sin(rotY));
    const cw = cos * 2.6 + sin * 4.5;
    const cd = sin * 2.6 + cos * 4.5;
    colliders.push({ minX: x - cw / 2, maxX: x + cw / 2, minZ: z - cd / 2, maxZ: z + cd / 2, h: 1.8 });
    occluders.push(chassis, cabin);
    return g;
  }

  addHumvee(11.2, 2.8, -0.32);
  addHumvee(-16.8, 21.6, Math.PI * 0.52);

  // ---------------------------------------------------------------- LAMPS / DETAILS
  function addLamp(x, z, rotY = 0, active = true) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 5.6, 6), mat.metal);
    pole.position.y = 2.8;
    pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), mat.metal);
    arm.position.set(0, 5.55, 0.5);
    g.add(arm);
    const lampHousing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.55), mat.darkMetal);
    lampHousing.position.set(0, 5.48, 1.02);
    g.add(lampHousing);
    if (active) {
      const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      bulb.rotation.x = Math.PI / 2;
      bulb.position.set(0, 5.41, 1.02);
      g.add(bulb);
      const light = new THREE.PointLight(0xffa156, 24, 18, 2);
      light.position.set(0, 5.3, 1.4);
      g.add(light);
      dynamicLights.push({ light, base: 24, seed: rand() * 20 });
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    colliders.push({ minX: x - 0.14, maxX: x + 0.14, minZ: z - 0.14, maxZ: z + 0.14, h: 6 });
    return g;
  }

  addLamp(-12.5, -2, -Math.PI / 2, true);
  addLamp(13.8, -16.5, Math.PI / 2, true);
  addLamp(-20, 19, Math.PI * 0.18, true);
  addLamp(24, 20, Math.PI * 0.82, false);

  // Jersey barriers (extra cover)
  addConcreteBarrier(-3.2, 16.2, 3.8, Math.PI / 2);
  addConcreteBarrier(17.8, -26.5, 4.2, 0);

  // Rebar / broken beams
  for (let i = 0; i < 10; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 2.1 + rand() * 2.8), mat.rust);
    beam.position.set(-30 + rand() * 60, 0.1 + rand() * 0.3, -20 + rand() * 45);
    beam.rotation.set(rand() * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.2);
    beam.castShadow = true;
    scene.add(beam);
  }

  // Tarp / fence panels
  function addTarp(x, z, w, h, rotY) {
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 4, 3), mat.tarp);
    tarp.position.set(x, h / 2 + 0.1, z);
    tarp.rotation.y = rotY;
    tarp.receiveShadow = true;
    scene.add(tarp);
  }
  addTarp(-15.5, 6.8, 4.6, 2.2, 0.1);
  addTarp(21.5, -18.2, 4.2, 2.6, -0.2);

  // Debris rocks
  const rubbleGeo = new THREE.DodecahedronGeometry(0.25, 0);
  for (let i = 0; i < 70; i++) {
    const r = new THREE.Mesh(rubbleGeo, i % 3 === 0 ? mat.concreteDark : mat.concrete);
    r.position.set(-33 + rand() * 66, 0.15, -33 + rand() * 66);
    r.scale.set(0.4 + rand() * 1.3, 0.35 + rand() * 0.8, 0.4 + rand() * 1.2);
    r.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    r.castShadow = true;
    r.receiveShadow = true;
    scene.add(r);
  }

  // Smoke columns
  const smokeMat = new THREE.SpriteMaterial({ map: smokeTexture, color: 0x1b1d1b, transparent: true, opacity: 0.22, depthWrite: false });
  const smokeSources = [
    [-24, -18, 9], [16, -20, 12], [-25, 11, 6], [18, 10, 8], [7, -13, 5],
  ];
  smokeSources.forEach(([x, z, height], si) => {
    for (let i = 0; i < (lowPower ? 3 : 5); i++) {
      const sprite = new THREE.Sprite(smokeMat.clone());
      sprite.material.opacity = 0.12 + rand() * 0.13;
      sprite.position.set(x + (rand() - 0.5) * 2.5, 2 + rand() * height, z + (rand() - 0.5) * 2.5);
      const baseScale = 2.5 + rand() * 3;
      sprite.scale.set(baseScale, baseScale, 1);
      scene.add(sprite);
      smokePuffs.push({ sprite, baseY: sprite.position.y, phase: rand() * 6.28, speed: 0.12 + rand() * 0.16, baseScale, si });
    }
  });

  // ---------------------------------------------------------------- ASH PARTICLES
  const ashCount = lowPower ? 380 : 750;
  const ashGeo = new THREE.BufferGeometry();
  const ashPos = new Float32Array(ashCount * 3);
  const ashSpeed = new Float32Array(ashCount);
  for (let i = 0; i < ashCount; i++) {
    ashPos[i * 3] = (rand() - 0.5) * 78;
    ashPos[i * 3 + 1] = rand() * 24;
    ashPos[i * 3 + 2] = (rand() - 0.5) * 78;
    ashSpeed[i] = 0.18 + rand() * 0.55;
  }
  ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  const ashMat = new THREE.PointsMaterial({
    color: 0xb2b8ad,
    size: 0.042,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const ash = new THREE.Points(ashGeo, ashMat);
  scene.add(ash);

  // Fire embers
  const emberCount = 90;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(emberCount * 3);
  const emberPhase = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) {
    emberPos[i * 3] = 4.1 + (rand() - 0.5) * 0.5;
    emberPos[i * 3 + 1] = 0.8 + rand() * 3;
    emberPos[i * 3 + 2] = -12.8 + (rand() - 0.5) * 0.5;
    emberPhase[i] = rand() * 10;
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(
    emberGeo,
    new THREE.PointsMaterial({ color: 0xff7a2e, size: 0.055, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  scene.add(embers);

  // Ground fog sheets (very subtle)
  const fogMat = new THREE.MeshBasicMaterial({ map: smokeTexture, color: 0x9aa6a0, transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), fogMat.clone());
    fog.rotation.x = -Math.PI / 2;
    fog.position.set(-28 + rand() * 56, 0.25, -24 + rand() * 48);
    fog.rotation.z = rand() * 3;
    scene.add(fog);
  }

  // ---------------------------------------------------------------- SPAWN POINTS
  const spawnPoints = [
    { x: 0, z: 33.5 }, { x: -33.5, z: 28.5 }, { x: 33, z: 27 },
    { x: -34.6, z: 0 }, { x: 34.5, z: -3 }, { x: -30, z: -31 },
    { x: 30, z: -31.5 }, { x: 0, z: -33 }, { x: 17, z: 33 },
    { x: -16, z: 33 }, { x: -34, z: -20 }, { x: 34, z: -23 },
  ].filter((p) => !colliders.some((c) => p.x > c.minX - 0.8 && p.x < c.maxX + 0.8 && p.z > c.minZ - 0.8 && p.z < c.maxZ + 0.8));

  // ---------------------------------------------------------------- UPDATE
  let ashCursor = 0;
  function update(dt, time, playerPos) {
    for (const item of animated) item.update(time);
    for (const item of dynamicLights) {
      item.light.intensity = item.base * (0.92 + Math.sin(time * 7 + item.seed) * 0.04 + Math.sin(time * 13.7 + item.seed) * 0.025);
    }
    for (const item of fireLights) {
      item.light.intensity = 27 + Math.sin(time * 11 + item.seed) * 6 + Math.sin(time * 19.7 + item.seed) * 3;
      const s = 1.2 + Math.sin(time * 9 + item.seed) * 0.16;
      item.fire.scale.set(1.2 * s, 1.9 * s, 1);
      item.fire.material.opacity = 0.68 + Math.sin(time * 14 + item.seed) * 0.12;
    }
    for (const puff of smokePuffs) {
      puff.sprite.position.y += puff.speed * dt;
      puff.sprite.position.x += Math.sin(time * 0.3 + puff.phase) * dt * 0.16;
      const cycle = ((puff.sprite.position.y - puff.baseY) % 10 + 10) % 10;
      puff.sprite.material.opacity = Math.max(0, Math.sin((cycle / 10) * Math.PI) * 0.2);
      const scale = puff.baseScale * (0.7 + cycle * 0.085);
      puff.sprite.scale.set(scale, scale, 1);
    }
    // ash drifts and wraps around the play area
    const pos = ashGeo.attributes.position.array;
    for (let i = 0; i < ashCount; i++) {
      pos[i * 3 + 1] -= ashSpeed[i] * dt;
      pos[i * 3] += Math.sin(time * 0.22 + i) * dt * 0.1;
      if (pos[i * 3 + 1] < 0.1) {
        pos[i * 3 + 1] = 20 + rand() * 6;
        pos[i * 3] = playerPos.x + (rand() - 0.5) * 30;
        pos[i * 3 + 2] = playerPos.z + (rand() - 0.5) * 30;
      }
    }
    ashGeo.attributes.position.needsUpdate = true;

    const ePos = emberGeo.attributes.position.array;
    for (let i = 0; i < emberCount; i++) {
      ePos[i * 3 + 1] += (0.35 + (i % 5) * 0.07) * dt;
      ePos[i * 3] += Math.sin(time * 2.2 + emberPhase[i]) * dt * 0.15;
      if (ePos[i * 3 + 1] > 4.4) {
        ePos[i * 3 + 1] = 0.7;
        ePos[i * 3] = 4.1 + (rand() - 0.5) * 0.55;
        ePos[i * 3 + 2] = -12.8 + (rand() - 0.5) * 0.55;
      }
    }
    emberGeo.attributes.position.needsUpdate = true;
    ashCursor += dt;
  }

  const mergeStats = mergeStaticWorld(scene);

  return {
    colliders,
    occluders,
    spawnPoints,
    uplink,
    materials: mat,
    mergeStats,
    update,
  };
}
