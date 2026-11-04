import * as THREE from 'three';

export function mergeGeometries(geometries) {
  const list = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = list.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);
  let offset = 0;
  for (const geometry of list) {
    const p = geometry.attributes.position;
    const n = geometry.attributes.normal;
    const u = geometry.attributes.uv;
    positions.set(p.array, offset * 3);
    if (n) normals.set(n.array, offset * 3);
    if (u) uvs.set(u.array, offset * 2);
    offset += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}

export function planeCross(width, height, planes = 3, base = 0) {
  const parts = [];
  for (let i = 0; i < planes; i++) {
    const plane = new THREE.PlaneGeometry(width, height, 1, 1);
    plane.translate(0, height * 0.5 + base, 0);
    plane.rotateY((i / planes) * Math.PI);
    parts.push(plane);
  }
  return mergeGeometries(parts);
}

export function grassTuftGeometry(planes = 3) {
  return planeCross(1, 1, planes, 0);
}

export function fernGeometry() {
  const parts = [];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.13;
    const plane = new THREE.PlaneGeometry(0.52, 1);
    plane.translate(0, 0.5, 0);
    plane.rotateX(-0.34);
    plane.rotateY(angle);
    // Outer fronds lean farther out and slightly down.
    plane.scale(0.8 + (i % 3) * 0.12, 0.82 + (i % 4) * 0.075, 1);
    parts.push(plane);
  }
  return mergeGeometries(parts);
}

export function makeContactShadowGeometry() {
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.rotateX(-Math.PI / 2);
  return plane;
}

export function makeQuaternionY(angle) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
}

export function applyWind(material, { strength = 0.06, speed = 1.1, power = 2, key = 'wind' } = {}) {
  const uniform = { value: 0 };
  material.userData.windUniform = uniform;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = uniform;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uWindTime;'
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = vec3( position );
      vec3 windOrigin = vec3(0.0);
      #ifdef USE_INSTANCING
        windOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #endif
      float windPhase = windOrigin.x * 0.41 + windOrigin.z * 0.27;
      float windHeight = clamp(position.y / 1.0, 0.0, 1.0);
      float windWave = sin(uWindTime * ${speed.toFixed(2)} + windPhase) * ${strength.toFixed(4)}
        + sin(uWindTime * ${(speed * 2.27).toFixed(2)} + windPhase * 1.7) * ${(strength * 0.34).toFixed(4)};
      transformed.x += windWave * pow(windHeight, ${power.toFixed(2)});
      transformed.z += cos(uWindTime * ${(speed * 0.83).toFixed(2)} + windPhase) * ${(strength * 0.46).toFixed(4)} * pow(windHeight, ${power.toFixed(2)});
      `
    );
  };
  material.customProgramCacheKey = () =>
    `${key}-${strength.toFixed(4)}-${speed.toFixed(3)}-${power.toFixed(2)}`;
  return uniform;
}

export function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
  });
}

export function seededShuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export class CollisionGrid {
  constructor(cellSize = 8) {
    this.cellSize = cellSize;
    this.buckets = new Map();
    this.counts = {};
  }

  add(item) {
    const cx = Math.floor(item.x / this.cellSize);
    const cz = Math.floor(item.z / this.cellSize);
    for (let ix = -1; ix <= 1; ix++) {
      for (let iz = -1; iz <= 1; iz++) {
        const key = `${cx + ix},${cz + iz}`;
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(item);
      }
    }
  }

  resolve(position, radius, activeCounts = null) {
    const cx = Math.floor(position.x / this.cellSize);
    const cz = Math.floor(position.z / this.cellSize);
    const bucket = this.buckets.get(`${cx},${cz}`);
    if (!bucket) return;
    for (const item of bucket) {
      if (activeCounts && item.spec !== undefined && item.index >= (activeCounts[item.spec] ?? Infinity)) continue;
      const dx = position.x - item.x;
      const dz = position.z - item.z;
      const min = radius + item.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 0.000001) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        position.x += dx * push;
        position.z += dz * push;
      }
    }
  }
}
