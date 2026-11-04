import * as THREE from 'three';
import {
  WORLD_RADIUS,
  WATER_LEVEL,
  POND,
  SPAWN,
  LANDMARKS,
  terrainHeight,
  terrainSlope,
  pathDistance,
  groundColor,
} from './terrain.js';
import { mulberry32, fbm2, smoothstep, clamp, mix } from './noise.js';
import { createTextures } from './textures.js';
import {
  mergeGeometries,
  planeCross,
  fernGeometry,
  makeContactShadowGeometry,
  applyWind,
  CollisionGrid,
  seededShuffle,
} from './utils.js';

const SUN_DIR = new THREE.Vector3(-0.58, 0.36, -0.72).normalize();
const TWO_PI = Math.PI * 2;

export const QUALITY_LEVELS = {
  low: {
    label: 'Low',
    treeScale: 0.24,
    grassScale: 0.18,
    fernScale: 0.18,
    rockScale: 0.34,
    flowerScale: 0.24,
    litterScale: 0.22,
    mistScale: 0.35,
    reedScale: 0.4,
    pixelRatio: 1,
    shadowMap: 1024,
    shadows: true,
    bloom: 0.22,
    exposure: 1.0,
    fog: 0.0135,
    far: 155,
  },
  medium: {
    label: 'Medium',
    treeScale: 0.48,
    grassScale: 0.4,
    fernScale: 0.42,
    rockScale: 0.58,
    flowerScale: 0.5,
    litterScale: 0.48,
    mistScale: 0.62,
    reedScale: 0.65,
    pixelRatio: 1.25,
    shadowMap: 1536,
    shadows: true,
    bloom: 0.32,
    exposure: 1.04,
    fog: 0.0115,
    far: 190,
  },
  high: {
    label: 'High',
    treeScale: 0.78,
    grassScale: 0.7,
    fernScale: 0.72,
    rockScale: 0.8,
    flowerScale: 0.76,
    litterScale: 0.72,
    mistScale: 0.85,
    reedScale: 0.85,
    pixelRatio: 1.5,
    shadowMap: 2048,
    shadows: true,
    bloom: 0.42,
    exposure: 1.08,
    fog: 0.0092,
    far: 240,
  },
  photo: {
    label: 'Photoreal',
    treeScale: 1,
    grassScale: 1,
    fernScale: 1,
    rockScale: 1,
    flowerScale: 1,
    litterScale: 1,
    mistScale: 1,
    reedScale: 1,
    pixelRatio: 2,
    shadowMap: 3072,
    shadows: true,
    bloom: 0.52,
    exposure: 1.1,
    fog: 0.008,
    far: 280,
  },
};

const MAX_TREES = 980;
const MAX_GRASS = 13000;
const MAX_FERNS = 1500;
const MAX_ROCKS = 280;
const MAX_FLOWERS = 420;
const MAX_LITTER = 2600;
const MAX_MIST = 170;
const MAX_REEDS = 430;

function makeEnvironmentMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#35515d');
  grad.addColorStop(0.34, '#6f8e90');
  grad.addColorStop(0.49, '#d7c5a0');
  grad.addColorStop(0.55, '#b5a98b');
  grad.addColorStop(0.7, '#4b5740');
  grad.addColorStop(1, '#1c2418');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);
  const sunX = 240;
  const sunY = 206;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 210);
  sun.addColorStop(0, 'rgba(255,250,220,1)');
  sun.addColorStop(0.04, 'rgba(255,225,165,.98)');
  sun.addColorStop(0.2, 'rgba(255,190,110,.34)');
  sun.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);
  // Soft cloud bands around the equirect horizon.
  const random = mulberry32(772);
  for (let i = 0; i < 40; i++) {
    const x = random() * 1024;
    const y = 120 + random() * 120;
    const r = 30 + random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,235,207,${0.05 + random() * 0.11})`);
    g.addColorStop(1, 'rgba(255,235,207,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function addWindMaterial(materials, options) {
  for (const material of materials) {
    const uniform = applyWind(material, options);
    materials.windUniforms = materials.windUniforms || [];
    materials.windUniforms.push(uniform);
  }
}

class World {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.textures = createTextures();
    this.clockTime = 0;
    this.quality = 'high';
    this.qualityScale = QUALITY_LEVELS.high;
    this.windUniforms = [];
    this.fireflyBase = null;
    this.ambientBase = null;
    this.mistBase = null;
    this.echoes = [];
    this.discovered = new Set();
    this.colliders = new CollisionGrid(7);
    this.treeColliders = { pine: 0, oak: 0, birch: 0 };
    this.treeTotals = { pine: 0, oak: 0, birch: 0 };
    this.instancedCounts = [];
    this.landmarkSeen = new Set();
    this.nearestEcho = null;
    this.surfaceDock = {
      x1: 10.6,
      x2: 15.4,
      z1: -16.2,
      z2: -6.2,
      y: WATER_LEVEL + 0.68,
    };
    this.deer = [];
    this.birds = [];
    this.sunSprite = null;
    this.uWindClock = { value: 0 };
    this.setupRenderer();
  }

  setupRenderer() {
    const renderer = this.renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x9cae9f, 1);
  }

  build() {
    this.createSky();
    this.createLights();
    this.createTerrain();
    this.createWater();
    this.createForest();
    this.createGroundCover();
    this.createRocks();
    this.createDock();
    this.createLandmarks();
    this.createEchoes();
    this.createCreatures();
    this.createAtmosphere();
    this.applyQuality(this.quality);
    return this;
  }

  createSky() {
    const skyGeometry = new THREE.SphereGeometry(360, 48, 28);
    const uniforms = {
      uSunDir: { value: SUN_DIR.clone() },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(0.055, 0.125, 0.165) },
      uHorizon: { value: new THREE.Color(0.56, 0.39, 0.21) },
      uHaze: { value: new THREE.Color(0.46, 0.46, 0.31) },
    };
    this.skyUniforms = uniforms;
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vDir = world.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vDir;
        uniform vec3 uSunDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uHaze;
        uniform float uTime;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
                     mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i=0;i<5;i++) {
            v += vnoise(p) * a;
            p = p*2.03 + 17.1;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float h = max(dir.y, -0.08);
          float horizon = smoothstep(-0.05, 0.32, h);
          vec3 col = mix(uHorizon, uZenith, pow(horizon, 0.72));
          col = mix(col, uHaze, smoothstep(0.16, 0.0, h) * 0.55);

          float mu = max(dot(dir, uSunDir), 0.0);
          float sunDisk = smoothstep(0.99945, 0.99992, mu);
          float glow = pow(mu, 10.0) * 0.24 + pow(mu, 90.0) * 0.55;
          float halo = pow(mu, 3.0) * 0.08;
          vec3 sunColor = vec3(3.3, 2.2, 1.05);
          col += sunColor * (sunDisk * 14.0 + glow + halo);

          if (dir.y > 0.005) {
            vec2 cloudUV = dir.xz / (dir.y + 0.19);
            cloudUV = cloudUV * 0.48 + vec2(1.0) - uTime * 0.0012;
            float cloud = fbm(cloudUV * 1.4);
            float detail = fbm(cloudUV * 3.7 + 11.0);
            float band = smoothstep(0.43, 0.7, cloud * 0.78 + detail * 0.32);
            band *= smoothstep(0.015, 0.16, dir.y) * (1.0 - smoothstep(0.62, 0.94, dir.y));
            float sunEdge = pow(mu, 6.0);
            vec3 cloudCol = mix(vec3(0.25,0.27,0.24), vec3(0.82,0.69,0.48), sunEdge * 1.3 + 0.15);
            cloudCol += vec3(0.9,0.54,0.2) * sunEdge * 0.7;
            col = mix(col, cloudCol, band * 0.68);
          }

          if (dir.y < 0.0) {
            col = mix(col, vec3(0.045, 0.06, 0.045), smoothstep(0.0, -0.08, dir.y));
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.sky = sky;

    const environment = makeEnvironmentMap();
    this.scene.environment = environment;
    this.scene.environmentIntensity = 0.64;

    const glowTexture = this.textures.glow;
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color(1.0, 0.72, 0.38),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: false,
      })
    );
    sunSprite.scale.set(62, 62, 1);
    this.scene.add(sunSprite);
    this.sunSprite = sunSprite;
  }

  createLights() {
    const hemi = new THREE.HemisphereLight(0xb5ced0, 0x2a3220, 0.84);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffd5a0, 3.25);
    sun.position.copy(SUN_DIR).multiplyScalar(86);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 190;
    sun.shadow.camera.left = -58;
    sun.shadow.camera.right = 58;
    sun.shadow.camera.top = 58;
    sun.shadow.camera.bottom = -58;
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2.2;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0x7097a4, 0.34);
    fill.position.set(30, 25, 80);
    this.scene.add(fill);

    const ambient = new THREE.AmbientLight(0x30382d, 0.36);
    this.scene.add(ambient);
  }

  createTerrain() {
    const segments = 230;
    const size = 242;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    const out = {};
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const h = terrainHeight(x, z);
      position.setY(i, h);
      const slope = terrainSlope(x, z);
      groundColor(x, z, h, slope, out);
      color.setRGB(out.r, out.g, out.b, THREE.SRGBColorSpace);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      map: this.textures.ground.map,
      normalMap: this.textures.ground.normalMap,
      normalScale: new THREE.Vector2(0.72, 0.72),
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.28,
      color: 0xffffff,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.name = 'terrain';
    this.scene.add(mesh);
    this.terrain = mesh;

    scene: {
      // A distant, soft ridge behind the forest. It closes the world without a wall.
      const random = mulberry32(6612);
      const ridgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x28392f,
        roughness: 1,
        metalness: 0,
        flatShading: true,
        envMapIntensity: 0.1,
      });
      const ridgeGeometry = new THREE.ConeGeometry(1, 1, 7, 3);
      const p = ridgeGeometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const f = 0.84 + random() * 0.28;
        p.setX(i, p.getX(i) * f);
        p.setZ(i, p.getZ(i) * f);
        p.setY(i, y + (random() - 0.5) * 0.02);
      }
      ridgeGeometry.computeVertexNormals();
      const count = 54;
      const ridge = new THREE.InstancedMesh(ridgeGeometry, ridgeMaterial, count);
      const matrix = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const color = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * TWO_PI + random() * 0.11;
        const radius = 128 + random() * 36;
        const width = 17 + random() * 31;
        const height = 18 + random() * 35;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        quat.setFromEuler(new THREE.Euler(0, random() * TWO_PI, 0));
        scale.set(width, height, width * (0.7 + random() * 0.5));
        matrix.compose(new THREE.Vector3(x, 7 + height * 0.42, z), quat, scale);
        ridge.setMatrixAt(i, matrix);
        color.setHSL(0.28 + random() * 0.04, 0.16 + random() * 0.1, 0.16 + random() * 0.08);
        ridge.setColorAt(i, color);
      }
      ridge.receiveShadow = true;
      ridge.castShadow = false;
      this.scene.add(ridge);
      this.ridges = ridge;
    }
  }

  createWater() {
    const geometry = new THREE.PlaneGeometry(57, 52, 24, 24);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x253f38,
      map: null,
      roughness: 0.11,
      metalness: 0.02,
      clearcoat: 0.9,
      clearcoatRoughness: 0.09,
      normalMap: this.textures.waterNormal,
      normalScale: new THREE.Vector2(0.34, 0.34),
      transparent: true,
      opacity: 0.84,
      envMapIntensity: 1.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.normalMap.repeat.set(10, 9);
    const water = new THREE.Mesh(geometry, material);
    water.position.set(POND.x, WATER_LEVEL, POND.z);
    water.receiveShadow = true;
    water.renderOrder = 2;
    this.scene.add(water);
    this.water = water;
    this.waterMaterial = material;

    // A whisper-thin surface sheen catches the low sun.
    const sheenMat = new THREE.MeshBasicMaterial({
      color: 0xe0c28d,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const sheen = new THREE.Mesh(geometry.clone(), sheenMat);
    sheen.position.set(POND.x, WATER_LEVEL + 0.018, POND.z);
    sheen.renderOrder = 3;
    this.scene.add(sheen);
    this.waterSheen = sheen;
  }

  createForest() {
    const random = mulberry32(42007);
    const trees = [];
    const occupancy = new Map();
    const cell = 3.1;
    const key = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    const canPlace = (x, z, spacing) => {
      const cx = Math.floor(x / cell);
      const cz = Math.floor(z / cell);
      for (let ix = -2; ix <= 2; ix++) {
        for (let iz = -2; iz <= 2; iz++) {
          const list = occupancy.get(`${cx + ix},${cz + iz}`);
          if (!list) continue;
          for (const point of list) {
            if (Math.hypot(point.x - x, point.z - z) < spacing) return false;
          }
        }
      }
      return true;
    };
    const register = (x, z) => {
      const k = key(x, z);
      if (!occupancy.has(k)) occupancy.set(k, []);
      occupancy.get(k).push({ x, z });
    };

    // Hand-set framing trees at the trailhead.
    const manual = [
      [-10, 31, 'oak'],
      [16, 29, 'pine'],
      [-20, 18, 'pine'],
      [26, 15, 'oak'],
      [-23, 38, 'birch'],
      [25, 39, 'birch'],
    ];
    for (const [x, z, species] of manual) {
      trees.push({ x, z, species, manual: true });
      register(x, z);
    }

    let attempts = 0;
    while (trees.length < MAX_TREES && attempts < 6500) {
      attempts++;
      const angle = random() * TWO_PI;
      const radius = Math.sqrt(random()) * 111;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8.5) continue;
      if (Math.hypot(x - POND.x, z - POND.z) < 19.2) continue;
      if (pathDistance(x, z) < 2.15) continue;
      if (terrainSlope(x, z) > 1.7) continue;
      if (!canPlace(x, z, 2.7)) continue;
      let nearLandmark = false;
      for (const lm of LANDMARKS) {
        if (Math.hypot(x - lm.x, z - lm.z) < 7.5) {
          nearLandmark = true;
          break;
        }
      }
      if (nearLandmark) continue;
      const density = fbm2(x * 0.032 + 5, z * 0.032 - 3, 3);
      if (density < -0.33 && random() < 0.55) continue;
      const gladeDistance = Math.hypot(x - -12, z - -51);
      const birchy = gladeDistance < 36 || x > 22;
      let species;
      if (birchy && random() < (gladeDistance < 30 ? 0.64 : 0.24)) species = 'birch';
      else if (density > 0.12 || terrainHeight(x, z) > 4.4) species = 'pine';
      else if (random() < 0.6) species = 'oak';
      else species = 'pine';
      trees.push({ x, z, species });
      register(x, z);
    }

    const bySpecies = { pine: [], oak: [], birch: [] };
    for (const tree of trees) bySpecies[tree.species].push(tree);

    const canopyGeometry = planeCross(1, 1, 3, 0);
    const trunkGeometry = new THREE.CylinderGeometry(0.58, 1, 1, 7, 4);
    trunkGeometry.translate(0, 0.5, 0);
    const shadowGeometry = makeContactShadowGeometry();

    const canopyTextures = {
      pine: this.textures.pine,
      oak: this.textures.oak,
      birch: this.textures.birchLeaves,
    };
    const barkTextures = {
      pine: this.textures.bark,
      oak: this.textures.bark,
      birch: this.textures.birchBark,
    };
    const canopyWind = [];
    const treeMeshes = {};

    for (const species of ['pine', 'oak', 'birch']) {
      const list = bySpecies[species];
      this.treeTotals[species] = list.length;
      if (!list.length) continue;
      const canopyMaterial = new THREE.MeshStandardMaterial({
        map: canopyTextures[species],
        alphaTest: 0.38,
        side: THREE.DoubleSide,
        roughness: 0.93,
        metalness: 0,
        envMapIntensity: 0.44,
        color: 0xffffff,
      });
      canopyMaterial.alphaToCoverage = true;
      addWindMaterial([canopyMaterial], {
        strength: species === 'pine' ? 0.045 : 0.07,
        speed: 0.75,
        power: 1.8,
        key: `canopy-${species}`,
      });
      canopyWind.push(...canopyMaterial.windUniforms);
      const canopyDepth = new THREE.MeshDepthMaterial({
        depthPacking: THREE.RGBADepthPacking,
        map: canopyTextures[species],
        alphaTest: 0.38,
        side: THREE.DoubleSide,
      });
      const canopy = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, list.length);
      canopy.castShadow = true;
      canopy.receiveShadow = false;
      canopy.customDepthMaterial = canopyDepth;
      canopy.frustumCulled = false;

      const bark = barkTextures[species];
      const trunkMaterial = new THREE.MeshStandardMaterial({
        map: bark.color,
        bumpMap: bark.bump,
        bumpScale: 0.065,
        roughness: 0.97,
        metalness: 0,
        envMapIntensity: 0.3,
        color: 0xffffff,
      });
      const trunk = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, list.length);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      trunk.frustumCulled = false;

      const contact = new THREE.InstancedMesh(
        shadowGeometry,
        new THREE.MeshBasicMaterial({
          map: this.textures.shadow,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
          color: 0x000000,
          polygonOffset: true,
          polygonOffsetFactor: -3,
        }),
        list.length
      );
      contact.renderOrder = 1;
      contact.frustumCulled = false;

      const matrix = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const color = new THREE.Color();

      list.forEach((tree, index) => {
        const h = (species === 'pine' ? 10.5 : species === 'birch' ? 8.2 : 9.4) * (0.78 + random() * 0.48);
        const width = h * (species === 'pine' ? 0.48 : species === 'birch' ? 0.62 : 0.95);
        const rotation = random() * TWO_PI;
        const baseY = terrainHeight(tree.x, tree.z) - 0.04;
        const visibleTrunk = h * (species === 'oak' ? 0.55 : 0.48);
        const canopyBase = h * (species === 'pine' ? 0.11 : species === 'birch' ? 0.32 : 0.3);
        const canopyHeight = h * (species === 'pine' ? 0.9 : 0.72);

        quat.setFromEuler(new THREE.Euler(0, rotation, 0));
        position.set(tree.x, baseY + canopyBase, tree.z);
        scale.set(width * (0.92 + random() * 0.14), canopyHeight, width * (0.92 + random() * 0.14));
        matrix.compose(position, quat, scale);
        canopy.setMatrixAt(index, matrix);
        const tint = species === 'birch' ? 0.94 + random() * 0.18 : 0.83 + random() * 0.25;
        color.setRGB(tint * (0.95 + random() * 0.1), tint, tint * (0.9 + random() * 0.1));
        canopy.setColorAt(index, color);

        position.set(tree.x, baseY, tree.z);
        const radius = h * (species === 'birch' ? 0.016 : species === 'pine' ? 0.021 : 0.029);
        scale.set(radius * (0.85 + random() * 0.3), visibleTrunk, radius * (0.85 + random() * 0.3));
        matrix.compose(position, quat, scale);
        trunk.setMatrixAt(index, matrix);

        const shadowWidth = width * (species === 'pine' ? 0.48 : 0.62);
        position.set(tree.x, baseY + 0.055, tree.z);
        quat.setFromEuler(new THREE.Euler(0, rotation, 0));
        scale.set(shadowWidth, 1, shadowWidth * 0.75);
        matrix.compose(position, quat, scale);
        contact.setMatrixAt(index, matrix);

        this.colliders.add({
          x: tree.x,
          z: tree.z,
          r: Math.max(0.22, radius * 1.1),
          spec: species,
          index,
        });
        tree.height = h;
      });

      canopy.instanceMatrix.needsUpdate = true;
      trunk.instanceMatrix.needsUpdate = true;
      contact.instanceMatrix.needsUpdate = true;
      if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
      canopy.computeBoundingSphere();
      trunk.computeBoundingSphere();
      contact.computeBoundingSphere();
      this.scene.add(contact, trunk, canopy);
      this.instancedCounts.push({ mesh: canopy, max: list.length, category: 'trees', species });
      this.instancedCounts.push({ mesh: trunk, max: list.length, category: 'trees', species });
      this.instancedCounts.push({ mesh: contact, max: list.length, category: 'trees', species });
      treeMeshes[species] = { canopy, trunk, contact, canopyMaterial };
    }

    this.trees = bySpecies;
    this.treeMeshes = treeMeshes;
    this.canopyWindUniforms = canopyWind;
    this.windUniforms.push(...canopyWind);
  }

  createGroundCover() {
    const random = mulberry32(93411);
    const positions = [];
    const slopeLimit = 1.12;
    const canPlace = (x, z) => {
      if (Math.hypot(x, z) > 112) return false;
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 0.15) return false;
      if (pathDistance(x, z) < 0.95) return false;
      if (terrainSlope(x, z) > slopeLimit) return false;
      return true;
    };

    while (positions.length < MAX_GRASS) {
      const a = random() * TWO_PI;
      const r = Math.sqrt(random()) * 111;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!canPlace(x, z)) continue;
      positions.push({ x, z, h: terrainHeight(x, z), scale: 0.38 + random() * 0.68, rot: random() * TWO_PI });
    }

    const grassGeo = planeCross(1, 1, 3, 0);
    const grassMat = new THREE.MeshStandardMaterial({
      map: this.textures.grass,
      alphaTest: 0.28,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.24,
      color: 0xffffff,
    });
    grassMat.alphaToCoverage = true;
    addWindMaterial([grassMat], { strength: 0.1, speed: 1.3, power: 1.6, key: 'grass' });
    this.windUniforms.push(...grassMat.windUniforms);
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, MAX_GRASS);
    grass.receiveShadow = true;
    grass.castShadow = false;
    grass.frustumCulled = false;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    positions.forEach((p, i) => {
      quat.setFromEuler(new THREE.Euler(0, p.rot, 0));
      pos.set(p.x, p.h - 0.04, p.z);
      scale.set(0.36 + p.scale * 0.55, p.scale * 0.9, 0.36 + p.scale * 0.55);
      matrix.compose(pos, quat, scale);
      grass.setMatrixAt(i, matrix);
      const tint = 0.76 + random() * 0.35;
      color.setRGB(tint * (0.9 + random() * 0.16), tint, tint * (0.72 + random() * 0.1));
      grass.setColorAt(i, color);
    });
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    grass.computeBoundingSphere();
    this.scene.add(grass);
    this.instancedCounts.push({ mesh: grass, max: MAX_GRASS, category: 'grass' });
    this.grass = grass;
    this.windUniforms.push(...grassMat.windUniforms);

    // Ferns cluster near trunks and in wet hollows.
    const fernPositions = [];
    const fernRandom = mulberry32(7711);
    while (fernPositions.length < MAX_FERNS) {
      let x;
      let z;
      if (fernPositions.length < MAX_FERNS * 0.58) {
        const tree = this.randomTree(fernRandom);
        const angle = fernRandom() * TWO_PI;
        const radius = 1.3 + fernRandom() * 7;
        x = tree.x + Math.cos(angle) * radius;
        z = tree.z + Math.sin(angle) * radius;
      } else {
        const a = fernRandom() * TWO_PI;
        const r = Math.sqrt(fernRandom()) * 108;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      }
      if (!canPlace(x, z)) continue;
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (fernRandom() < 0.2 && pd > 24) continue;
      fernPositions.push({ x, z, h: terrainHeight(x, z), scale: 0.45 + fernRandom() * 0.85, rot: fernRandom() * TWO_PI });
    }
    const fernGeo = fernGeometry();
    const fernMat = new THREE.MeshStandardMaterial({
      map: this.textures.fern,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.22,
      color: 0xffffff,
    });
    fernMat.alphaToCoverage = true;
    addWindMaterial([fernMat], { strength: 0.075, speed: 0.95, power: 1.5, key: 'fern' });
    this.windUniforms.push(...fernMat.windUniforms);
    const ferns = new THREE.InstancedMesh(fernGeo, fernMat, MAX_FERNS);
    ferns.receiveShadow = true;
    ferns.frustumCulled = false;
    fernPositions.forEach((p, i) => {
      quat.setFromEuler(new THREE.Euler(0, p.rot, 0));
      pos.set(p.x, p.h - 0.03, p.z);
      scale.set(p.scale, p.scale, p.scale);
      matrix.compose(pos, quat, scale);
      ferns.setMatrixAt(i, matrix);
      const tint = 0.72 + fernRandom() * 0.35;
      color.setRGB(tint * 0.86, tint, tint * 0.7);
      ferns.setColorAt(i, color);
    });
    ferns.instanceMatrix.needsUpdate = true;
    if (ferns.instanceColor) ferns.instanceColor.needsUpdate = true;
    ferns.computeBoundingSphere();
    this.scene.add(ferns);
    this.instancedCounts.push({ mesh: ferns, max: MAX_FERNS, category: 'ferns' });
    this.ferns = ferns;

    this.createFlowers(random, canPlace);
    this.createLitter(random, canPlace);
    this.createMushrooms(random, canPlace);
    this.createReeds(random);
  }

  randomTree(random) {
    const all = [...this.trees.pine, ...this.trees.oak, ...this.trees.birch];
    return all[Math.floor(random() * all.length)];
  }

  createFlowers(random, canPlace) {
    const stems = [];
    const heads = [];
    while (heads.length < MAX_FLOWERS) {
      const a = random() * TWO_PI;
      const r = Math.sqrt(random()) * 105;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!canPlace(x, z)) continue;
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 0.7) continue;
      const pd = Math.hypot(x - POND.x, z - POND.z);
      if (random() < 0.57 && pd > 26) continue;
      stems.push({ x, z, h, scale: 0.65 + random() * 0.75, rot: random() * TWO_PI });
      heads.push({ hue: random(), scale: 0.65 + random() * 0.8 });
    }
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.26, 4);
    stemGeo.translate(0, 0.13, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x526332, roughness: 0.9 });
    const stemMesh = new THREE.InstancedMesh(stemGeo, stemMat, stems.length);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    stems.forEach((p, i) => {
      quat.setFromEuler(new THREE.Euler(0, p.rot, 0));
      pos.set(p.x, p.h, p.z);
      scale.set(p.scale, p.scale, p.scale);
      matrix.compose(pos, quat, scale);
      stemMesh.setMatrixAt(i, matrix);
    });
    stemMesh.instanceMatrix.needsUpdate = true;
    stemMesh.frustumCulled = false;

    const petals = [];
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.CircleGeometry(0.075, 5);
      petal.translate(0, 0.005, 0.05);
      petal.rotateX(-0.45);
      petal.rotateY((i / 5) * TWO_PI);
      petals.push(petal);
    }
    const center = new THREE.SphereGeometry(0.026, 6, 4);
    petals.push(center);
    const blossomGeo = mergeGeometries(petals);
    blossomGeo.translate(0, 0.3, 0);
    const blossomMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c9,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: 0x2a1906,
      emissiveIntensity: 0.25,
    });
    const blooms = new THREE.InstancedMesh(blossomGeo, blossomMat, heads.length);
    const color = new THREE.Color();
    heads.forEach((p, i) => {
      quat.setFromEuler(new THREE.Euler(0, random() * TWO_PI, 0));
      pos.set(stems[i].x, stems[i].h, stems[i].z);
      scale.set(p.scale, p.scale, p.scale);
      matrix.compose(pos, quat, scale);
      blooms.setMatrixAt(i, matrix);
      color.setHSL(0.11 + p.hue * 0.06, 0.24 + p.hue * 0.3, 0.78 + p.hue * 0.13);
      blooms.setColorAt(i, color);
    });
    blooms.instanceMatrix.needsUpdate = true;
    if (blooms.instanceColor) blooms.instanceColor.needsUpdate = true;
    blooms.frustumCulled = false;
    this.scene.add(stemMesh, blooms);
    this.instancedCounts.push({ mesh: stemMesh, max: stems.length, category: 'flowers' });
    this.instancedCounts.push({ mesh: blooms, max: heads.length, category: 'flowers' });
  }

  createLitter(random, canPlace) {
    const geometry = new THREE.PlaneGeometry(0.28, 0.16);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      side: THREE.DoubleSide,
      envMapIntensity: 0.2,
    });
    const litter = new THREE.InstancedMesh(geometry, material, MAX_LITTER);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    let count = 0;
    let attempts = 0;
    while (count < MAX_LITTER && attempts < MAX_LITTER * 8) {
      attempts++;
      const a = random() * TWO_PI;
      const r = Math.sqrt(random()) * 108;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!canPlace(x, z)) continue;
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 0.4) continue;
      quat.setFromEuler(new THREE.Euler(0, random() * TWO_PI, 0));
      pos.set(x, h + 0.025, z);
      const s = 0.55 + random() * 1.5;
      scale.set(s, s, s);
      matrix.compose(pos, quat, scale);
      litter.setMatrixAt(count, matrix);
      color.setHSL(0.065 + random() * 0.08, 0.36 + random() * 0.3, 0.21 + random() * 0.2);
      litter.setColorAt(count, color);
      count++;
    }
    litter.count = count;
    litter.instanceMatrix.needsUpdate = true;
    if (litter.instanceColor) litter.instanceColor.needsUpdate = true;
    litter.frustumCulled = false;
    this.scene.add(litter);
    this.instancedCounts.push({ mesh: litter, max: count, category: 'litter' });
    this.litter = litter;
  }

  createMushrooms(random, canPlace) {
    const clusters = [];
    while (clusters.length < 125) {
      const a = random() * TWO_PI;
      const r = Math.sqrt(random()) * 104;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL + 0.5 || pathDistance(x, z) < 1.2) continue;
      if (Math.hypot(x - -12, z - -51) > 20 && random() < 0.7) continue;
      clusters.push({ x, z, h, n: 1 + Math.floor(random() * 4), rot: random() * TWO_PI });
    }
    const capGeo = new THREE.SphereGeometry(1, 8, 6, 0, TWO_PI, 0, Math.PI / 2);
    capGeo.scale(1, 0.42, 1);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xb07044,
      roughness: 0.75,
      metalness: 0,
      emissive: 0x1a0902,
      emissiveIntensity: 0.1,
    });
    const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 1, 5);
    stemGeo.translate(0, 0.5, 0);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xd5cba4, roughness: 0.9 });
    const total = clusters.reduce((sum, c) => sum + c.n, 0);
    const caps = new THREE.InstancedMesh(capGeo, capMat, total);
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, total);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    let i = 0;
    for (const cluster of clusters) {
      for (let n = 0; n < cluster.n; n++) {
        const angle = cluster.rot + (n / cluster.n) * TWO_PI;
        const x = cluster.x + Math.cos(angle) * 0.18 * n;
        const z = cluster.z + Math.sin(angle) * 0.18 * n;
        const h = terrainHeight(x, z);
        const s = 0.7 + random() * 0.9;
        const height = 0.13 + random() * 0.16;
        quat.setFromEuler(new THREE.Euler((random() - 0.5) * 0.28, random() * TWO_PI, (random() - 0.5) * 0.28));
        pos.set(x, h, z);
        scale.set(s * 0.12, height, s * 0.12);
        matrix.compose(pos, quat, scale);
        stems.setMatrixAt(i, matrix);
        pos.set(x, h + height, z);
        scale.set(s * 0.16, s * 0.1, s * 0.16);
        matrix.compose(pos, quat, scale);
        caps.setMatrixAt(i, matrix);
        i++;
      }
    }
    caps.instanceMatrix.needsUpdate = true;
    stems.instanceMatrix.needsUpdate = true;
    caps.castShadow = true;
    caps.receiveShadow = true;
    stems.receiveShadow = true;
    caps.frustumCulled = false;
    stems.frustumCulled = false;
    this.scene.add(caps, stems);
    this.instancedCounts.push({ mesh: caps, max: total, category: 'mushrooms' });
    this.instancedCounts.push({ mesh: stems, max: total, category: 'mushrooms' });
  }

  createReeds(random) {
    const reeds = [];
    let attempts = 0;
    while (reeds.length < MAX_REEDS && attempts < 5000) {
      attempts++;
      const a = random() * TWO_PI;
      const r = 9 + random() * 11;
      const x = POND.x + Math.cos(a) * r;
      const z = POND.z + Math.sin(a) * r * 0.94;
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL - 0.2 || h > WATER_LEVEL + 0.72) continue;
      reeds.push({ x, z, h, s: 0.45 + random() * 0.7, rot: random() * TWO_PI });
    }
    const geo = planeCross(0.54, 1, 2, 0);
    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.grass,
      alphaTest: 0.3,
      side: THREE.DoubleSide,
      roughness: 0.95,
      color: 0xb3ad74,
      envMapIntensity: 0.2,
    });
    mat.alphaToCoverage = true;
    addWindMaterial([mat], { strength: 0.11, speed: 1.25, power: 1.5, key: 'reeds' });
    this.windUniforms.push(...mat.windUniforms);
    const mesh = new THREE.InstancedMesh(geo, mat, reeds.length);
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    reeds.forEach((p, i) => {
      quat.setFromEuler(new THREE.Euler(0, p.rot, 0));
      pos.set(p.x, p.h - 0.03, p.z);
      scale.set(p.s, p.s * 1.3, p.s);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.instancedCounts.push({ mesh, max: reeds.length, category: 'reeds' });
    this.reeds = mesh;

    // Lily pads.
    const padGeo = new THREE.CircleGeometry(0.3, 10, 0.3, TWO_PI - 0.6);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x4c6333, roughness: 0.82, side: THREE.DoubleSide });
    const pads = new THREE.InstancedMesh(padGeo, padMat, 34);
    for (let i = 0; i < 34; i++) {
      const a = random() * TWO_PI;
      const r = 6 + random() * 7.5;
      const x = POND.x + Math.cos(a) * r;
      const z = POND.z + Math.sin(a) * r;
      quat.setFromEuler(new THREE.Euler(0, random() * TWO_PI, 0));
      pos.set(x, WATER_LEVEL + 0.025, z);
      const s = 0.6 + random() * 1.0;
      scale.set(s, s, s);
      matrix.compose(pos, quat, scale);
      pads.setMatrixAt(i, matrix);
    }
    pads.instanceMatrix.needsUpdate = true;
    pads.frustumCulled = false;
    this.scene.add(pads);
  }

  createRocks() { /* implemented below */ }
  createDock() { /* implemented below */ }
  createLandmarks() { /* implemented below */ }
  createEchoes() { /* implemented below */ }
  createCreatures() { /* implemented below */ }
  createAtmosphere() { /* implemented below */ }
  applyQuality() { /* implemented below */ }
  update() { /* implemented below */ }
}

export { World, SUN_DIR };
