// Transient visual effects: tracers, muzzle flashes, explosions, smoke, craters, order markers.
import * as THREE from 'three';
import { G } from './state.js';
import { terrainHeight } from './world.js';
import { audio } from './audio.js';

let flashTex = null, smokeTex = null, softTex = null;
function getFlashTex() {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.35, 'rgba(255,214,120,0.9)');
  g.addColorStop(0.75, 'rgba(255,140,40,0.45)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  flashTex = new THREE.CanvasTexture(c);
  return flashTex;
}
function getSmokeTex() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(70,66,58,0.85)');
  g.addColorStop(0.6, 'rgba(52,49,44,0.55)');
  g.addColorStop(1, 'rgba(40,38,34,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(c);
  return smokeTex;
}
function getSoftTex() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}

function addEffect(eff) { G.effects.push(eff); return eff; }
function disposeSpriteArray(scene, sprites) {
  for (const s of sprites) { scene.remove(s); s.material.dispose(); }
}

// Thin glowing tracer from a to b.
export function spawnTracer(a, b, color = 0xffd98a, life = 0.09, thickness = 0.075) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 0.5) return;
  const geo = new THREE.BoxGeometry(thickness, thickness, len);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.lookAt(b);
  G.scene.add(mesh);
  addEffect({
    t: 0, life,
    update(dt) {
      this.t += dt;
      mat.opacity = Math.max(0, 1 - this.t / life);
      if (this.t >= life) { G.scene.remove(mesh); geo.dispose(); mat.dispose(); return false; }
      return true;
    }
  });
}

// Short-lived muzzle flash sprite.
export function spawnMuzzleFlash(pos, scale = 1) {
  const mat = new THREE.SpriteMaterial({ map: getFlashTex(), color: 0xffe9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(pos);
  sp.scale.set(1.1 * scale, 1.1 * scale, 1);
  G.scene.add(sp);
  addEffect({
    t: 0, life: 0.085,
    update(dt) {
      this.t += dt;
      const k = this.t / this.life;
      mat.opacity = Math.max(0, 1 - k);
      const s = scale * (0.9 + k * 1.1);
      sp.scale.set(s, s, 1);
      if (k >= 1) { G.scene.remove(sp); mat.dispose(); return false; }
      return true;
    }
  });
}

// Explosion with size factor (1 = small shell, 2.2 = tank kill / arty hit, 3.5 = HQ)
export function spawnExplosion(pos, size = 1, { crater = true } = {}) {
  const scene = G.scene;
  const group = new THREE.Group();
  group.position.copy(pos);
  scene.add(group);
  // Central fireball
  const fireMat = new THREE.SpriteMaterial({ map: getFlashTex(), color: 0xffc766, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const fire = new THREE.Sprite(fireMat);
  group.add(fire);
  // Smoke puffs
  const smokes = [];
  const smokeCount = Math.floor(4 + size * 3);
  for (let i = 0; i < smokeCount; i++) {
    const sm = new THREE.SpriteMaterial({ map: getSmokeTex(), transparent: true, depthWrite: false, opacity: 0.9 });
    const sp = new THREE.Sprite(sm);
    sp.position.set((Math.random() - 0.5) * size * 2.4, Math.random() * size * 0.8, (Math.random() - 0.5) * size * 2.4);
    const s = size * (1.1 + Math.random() * 1.4);
    sp.scale.set(s, s, 1);
    sp.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.2 + Math.random() * 2.4, (Math.random() - 0.5) * 2.2);
    group.add(sp);
    smokes.push(sp);
  }
  // Sparks
  const sparkMat = new THREE.SpriteMaterial({ map: getSoftTex(), color: 0xffd28a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = [];
  for (let i = 0; i < Math.floor(6 + size * 5); i++) {
    const sp = new THREE.Sprite(sparkMat.clone());
    sp.scale.set(0.35, 0.35, 1);
    sp.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 11 * size, Math.random() * 9 * size * 0.7 + 2, (Math.random() - 0.5) * 11 * size);
    group.add(sp);
    sparks.push(sp);
  }
  if (crater) addCrater(pos, size * 1.55);
  G.shake = Math.min(1.6, G.shake + size * 0.32);

  addEffect({
    t: 0, life: 1.6,
    update(dt) {
      this.t += dt;
      const k = this.t / this.life;
      fire.scale.setScalar(size * (2.6 + k * 3.4));
      fireMat.opacity = Math.max(0, 1 - k * 1.6);
      for (const sp of smokes) {
        sp.position.addScaledVector(sp.userData.vel, dt);
        sp.userData.vel.y += 0.8 * dt;
        sp.userData.vel.multiplyScalar(1 - 0.9 * dt);
        sp.material.opacity = Math.max(0, 0.85 * (1 - k * 1.15));
        const s = sp.scale.x + dt * size * 1.6;
        sp.scale.set(s, s, 1);
      }
      for (const sp of sparks) {
        sp.userData.vel.y -= 22 * dt;
        sp.position.addScaledVector(sp.userData.vel, dt);
        sp.material.opacity = Math.max(0, 1 - k * 1.5);
      }
      if (this.t >= this.life) {
        scene.remove(group);
        fireMat.dispose();
        disposeSpriteArray(scene, []);
        smokes.forEach(s => s.material.dispose());
        sparks.forEach(s => s.material.dispose());
        return false;
      }
      return true;
    }
  });
}

export function addCrater(pos, radius) {
  const geo = new THREE.CircleGeometry(radius, 12);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x241f16, transparent: true, opacity: 0.72, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, terrainHeight(pos.x, pos.z) + 0.07, pos.z);
  G.scene.add(mesh);
  G.craters.push(mesh);
  if (G.craters.length > 42) {
    const old = G.craters.shift();
    G.scene.remove(old);
    old.geometry.dispose(); old.material.dispose();
  }
}

// Factory smoke — one puff per call; main loop throttles.
export function spawnSmokePuff(pos) {
  const mat = new THREE.SpriteMaterial({ map: getSmokeTex(), transparent: true, opacity: 0.75, depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.position.copy(pos);
  sp.scale.set(1.4, 1.4, 1);
  G.scene.add(sp);
  addEffect({
    t: 0, life: 2.6,
    update(dt) {
      this.t += dt;
      sp.position.y += dt * 2.4;
      sp.position.x += dt * 0.7;
      const k = this.t / this.life;
      const s = 1.4 + k * 3.4;
      sp.scale.set(s, s, 1);
      mat.opacity = Math.max(0, 0.75 * (1 - k));
      if (k >= 1) { G.scene.remove(sp); mat.dispose(); return false; }
      return true;
    }
  });
}

// Shrinking order marker at a destination.
export function spawnMoveMarker(pos, color = 0x9fe08a) {
  const geo = new THREE.RingGeometry(0.8, 1.15, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(pos.x, terrainHeight(pos.x, pos.z) + 0.18, pos.z);
  G.scene.add(ring);
  const geo2 = new THREE.CircleGeometry(0.28, 12);
  geo2.rotateX(-Math.PI / 2);
  const mat2 = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const dot = new THREE.Mesh(geo2, mat2);
  dot.position.copy(ring.position); dot.position.y += 0.01;
  G.scene.add(dot);
  addEffect({
    t: 0, life: 0.85,
    update(dt) {
      this.t += dt;
      const k = this.t / this.life;
      const s = 1 + (1 - k) * 2.1;
      ring.scale.set(s, 1, s);
      mat.opacity = Math.max(0, 0.95 * (1 - k));
      mat2.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) {
        G.scene.remove(ring); G.scene.remove(dot);
        geo.dispose(); mat.dispose(); geo2.dispose(); mat2.dispose();
        return false;
      }
      return true;
    }
  });
}

// Enemy death: burning wreck marker that fades (kept subtle).
export function spawnWreck(pos, radius) {
  const geo = new THREE.CircleGeometry(radius * 0.9, 8);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1712, transparent: true, opacity: 0.8, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, terrainHeight(pos.x, pos.z) + 0.08, pos.z);
  G.scene.add(mesh);
  G.craters.push(mesh);
  if (G.craters.length > 42) {
    const old = G.craters.shift();
    G.scene.remove(old);
    old.geometry.dispose(); old.material.dispose();
  }
}

export function disposeAllEffects() {
  for (const eff of G.effects) { /* they clean up themselves on completion */ }
  G.effects.length = 0;
  const leftovers = [];
  G.scene.traverse((o) => { if (o.userData && o.userData.__fx) leftovers.push(o); });
}
