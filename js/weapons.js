import * as THREE from '../vendor/three.module.min.js';

/* First-person weapon models, built from primitives. Origin of every model is
   the optical centerline so ADS lines up naturally with the camera. */

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.16, 'rgba(255,238,170,0.98)');
  g.addColorStop(0.38, 'rgba(255,150,54,0.7)');
  g.addColorStop(0.7, 'rgba(255,90,20,0.18)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  // Star flare
  ctx.save();
  ctx.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.fillStyle = 'rgba(255,224,160,0.34)';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, -61);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMaterials() {
  return {
    metal: new THREE.MeshStandardMaterial({ color: 0x262b2b, roughness: 0.36, metalness: 0.78 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x101414, roughness: 0.4, metalness: 0.72 }),
    polymer: new THREE.MeshStandardMaterial({ color: 0x2c302b, roughness: 0.72, metalness: 0.14 }),
    tan: new THREE.MeshStandardMaterial({ color: 0x6b624b, roughness: 0.8, metalness: 0.08 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 0.92 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x3b4035, roughness: 0.92 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x9a7b3c, roughness: 0.65, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1c3330, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    dot: new THREE.MeshBasicMaterial({ color: 0xff3d24 }),
  };
}

function box(group, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

function cylinder(group, mat, radius, length, x, y, z, axis = 'z') {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 10);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function buildFlash(size = 0.34) {
  const texture = flashTexture();
  const group = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: texture, color: 0xffd9a1, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  group.add(sprite);
  const sprite2 = new THREE.Sprite(mat.clone());
  sprite2.material.opacity = 0;
  sprite2.scale.set(size * 0.6, size * 1.1, 1);
  sprite2.material.rotation = 0.6;
  group.add(sprite2);
  const light = new THREE.PointLight(0xffb463, 0, 6, 2);
  group.add(light);
  group.visible = false;
  return { group, sprite, sprite2, mat: sprite.material, mat2: sprite2.material, light, life: 0 };
}

function buildRifle(M) {
  const g = new THREE.Group();
  g.name = 'M4_CARBINE';

  // Receiver
  box(g, M.metal, 0.12, 0.135, 0.56, 0, -0.092, -0.08);
  box(g, M.polymer, 0.134, 0.075, 0.34, 0, -0.12, -0.18);
  // Top rail
  box(g, M.metalDark, 0.066, 0.026, 0.56, 0, -0.012, -0.1);
  for (let i = 0; i < 10; i++) {
    box(g, M.metalDark, 0.078, 0.018, 0.018, 0, 0.003, -0.32 + i * 0.052);
  }
  // Handguard
  box(g, M.polymer, 0.108, 0.12, 0.35, 0, -0.115, -0.45);
  for (let i = 0; i < 7; i++) {
    box(g, M.metalDark, 0.116, 0.017, 0.022, 0, -0.09, -0.3 - i * 0.045);
  }
  // Side rails & flashlight
  box(g, M.metalDark, 0.024, 0.06, 0.22, 0.066, -0.14, -0.42);
  cylinder(g, M.metalDark, 0.023, 0.09, -0.07, -0.13, -0.54);
  box(g, M.metalDark, 0.028, 0.045, 0.08, -0.07, -0.13, -0.49);
  // Barrel + brake
  cylinder(g, M.metalDark, 0.017, 0.38, 0, -0.092, -0.77);
  cylinder(g, M.metalDark, 0.028, 0.11, 0, -0.092, -0.975);
  box(g, M.metalDark, 0.047, 0.047, 0.06, 0, -0.092, -1.005);
  // Gas block / front sight
  box(g, M.metal, 0.052, 0.064, 0.06, 0, -0.065, -0.64);
  box(g, M.metal, 0.014, 0.055, 0.02, 0, 0.01, -0.66);
  // Stock
  box(g, M.polymer, 0.09, 0.15, 0.3, 0, -0.105, 0.36);
  box(g, M.polymer, 0.075, 0.2, 0.12, 0, -0.13, 0.52);
  box(g, M.metalDark, 0.095, 0.045, 0.12, 0, -0.025, 0.42);
  // Grip
  box(g, M.polymer, 0.077, 0.18, 0.1, 0, -0.225, 0.1, -0.26);
  box(g, M.metalDark, 0.08, 0.03, 0.14, 0, -0.165, 0.02, 0.14);
  // Magazine
  box(g, M.metalDark, 0.072, 0.2, 0.13, 0, -0.255, -0.17, 0.17);
  box(g, M.metal, 0.074, 0.025, 0.14, 0, -0.34, -0.16, 0.17);
  // Trigger guard
  box(g, M.metalDark, 0.018, 0.012, 0.13, 0, -0.19, 0.0);
  box(g, M.metalDark, 0.018, 0.055, 0.012, 0, -0.165, 0.06);
  // Charging handle / bolt
  box(g, M.metal, 0.026, 0.022, 0.09, 0.062, -0.035, 0.14);
  // Sling loop
  cylinder(g, M.metalDark, 0.013, 0.05, 0, -0.18, 0.35, 'x');

  // Red dot optic: origin at 0,0 roughly sight line
  box(g, M.metalDark, 0.065, 0.028, 0.13, 0, -0.028, -0.06);
  box(g, M.metalDark, 0.022, 0.07, 0.022, -0.034, 0.008, -0.07);
  box(g, M.metalDark, 0.022, 0.07, 0.022, 0.034, 0.008, -0.07);
  box(g, M.metalDark, 0.09, 0.022, 0.024, 0, 0.048, -0.07);
  box(g, M.metalDark, 0.09, 0.022, 0.024, 0, -0.02, -0.07);
  // Glass and reticle
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.06), M.glass);
  glass.position.set(0, 0.012, -0.058);
  g.add(glass);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 6, 4), M.dot);
  dot.position.set(0, 0.012, -0.064);
  g.add(dot);
  const dotGlow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff2d18, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  dotGlow.position.copy(dot.position);
  dotGlow.scale.set(0.022, 0.022, 1);
  g.add(dotGlow);

  // PEQ box
  box(g, M.tan, 0.055, 0.045, 0.12, 0.066, -0.06, -0.42);
  box(g, M.metalDark, 0.018, 0.018, 0.018, 0.066, -0.06, -0.49);

  // Arms / gloves (both support the weapon)
  const rightForearm = box(g, M.sleeve, 0.105, 0.11, 0.42, 0.1, -0.36, 0.25, 0.5, -0.15, 0.05);
  rightForearm.castShadow = false;
  box(g, M.glove, 0.11, 0.11, 0.18, 0.055, -0.235, 0.1, -0.1, -0.12, 0.05);
  // Thumb / knuckles
  box(g, M.glove, 0.04, 0.045, 0.11, 0.108, -0.2, 0.07, -0.1);
  const leftForearm = box(g, M.sleeve, 0.1, 0.1, 0.47, -0.13, -0.37, -0.24, 0.62, 0.45, -0.1);
  leftForearm.castShadow = false;
  box(g, M.glove, 0.11, 0.1, 0.2, -0.06, -0.18, -0.35, 0.08, 0.12, 0.05);
  box(g, M.glove, 0.035, 0.05, 0.12, -0.01, -0.145, -0.38, 0.08);
  // Shoulder cuffs
  box(g, M.sleeve, 0.14, 0.14, 0.08, 0.12, -0.43, 0.44, 0.5);
  box(g, M.sleeve, 0.13, 0.13, 0.07, -0.16, -0.44, -0.44, 0.62, 0.45);

  const flash = buildFlash(0.33);
  flash.group.position.set(0, -0.092, -1.03);
  g.add(flash.group);

  return {
    group: g,
    muzzle: flash.group,
    flash,
    hipPos: new THREE.Vector3(0.25, -0.235, -0.46),
    adsPos: new THREE.Vector3(0, -0.012, -0.32),
    hipRot: new THREE.Euler(0.012, -0.03, 0),
    adsRot: new THREE.Euler(0, 0, 0),
    sprintPos: new THREE.Vector3(0.3, -0.29, -0.38),
    sprintRot: new THREE.Euler(0.12, 0.55, 0.15),
  };
}

function buildPistol(M) {
  const g = new THREE.Group();
  g.name = 'P226';
  box(g, M.metal, 0.052, 0.075, 0.34, 0, -0.055, -0.15);
  box(g, M.metalDark, 0.058, 0.05, 0.3, 0, -0.098, -0.12);
  box(g, M.polymer, 0.056, 0.075, 0.15, 0, -0.145, -0.02);
  // grip
  box(g, M.polymer, 0.062, 0.19, 0.1, 0, -0.225, 0.09, 0.22);
  // barrel / suppressor
  cylinder(g, M.metalDark, 0.018, 0.08, 0, -0.06, -0.35);
  cylinder(g, M.metalDark, 0.028, 0.17, 0, -0.06, -0.47);
  // sights
  box(g, M.metalDark, 0.01, 0.014, 0.014, 0, -0.012, -0.3);
  box(g, M.metalDark, 0.014, 0.018, 0.014, 0, -0.006, 0.01);
  box(g, M.metalDark, 0.05, 0.012, 0.18, 0, -0.014, -0.12);
  // trigger guard
  box(g, M.metalDark, 0.016, 0.01, 0.08, 0, -0.16, 0.0);
  // hammer
  box(g, M.metalDark, 0.025, 0.035, 0.018, 0, -0.02, 0.045);
  // glove + arms
  box(g, M.glove, 0.1, 0.105, 0.17, 0.01, -0.235, 0.08, 0.15);
  box(g, M.sleeve, 0.1, 0.1, 0.4, 0.07, -0.38, 0.23, 0.5, -0.12, 0);
  box(g, M.glove, 0.09, 0.09, 0.16, -0.035, -0.215, 0.04, 0.15);
  box(g, M.sleeve, 0.09, 0.09, 0.36, -0.11, -0.36, 0.22, 0.58, 0.32, -0.05);

  const flash = buildFlash(0.25);
  flash.group.position.set(0, -0.06, -0.58);
  g.add(flash.group);

  return {
    group: g,
    muzzle: flash.group,
    flash,
    hipPos: new THREE.Vector3(0.23, -0.2, -0.42),
    adsPos: new THREE.Vector3(0, -0.01, -0.33),
    hipRot: new THREE.Euler(0.02, -0.04, 0),
    adsRot: new THREE.Euler(0, 0, 0),
    sprintPos: new THREE.Vector3(0.27, -0.27, -0.36),
    sprintRot: new THREE.Euler(0.1, 0.65, 0.2),
  };
}

export function createWeapons(camera) {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.name = 'viewmodel';
  root.renderOrder = 999;
  camera.add(root);

  const camLight = new THREE.PointLight(0xffd9b0, 0.9, 2.4, 2);
  camLight.position.set(0.15, 0.1, 0.1);
  camera.add(camLight);

  const rifle = buildRifle(M);
  const pistol = buildPistol(M);
  root.add(rifle.group, pistol.group);
  pistol.group.visible = false;

  const weapons = {
    rifle: {
      ...rifle,
      id: 'rifle',
      name: 'M4 CARBINE',
      className: 'ASSAULT RIFLE',
      fireMode: 'AUTO',
      magSize: 30,
      maxReserve: 300,
      reserve: 210,
      ammo: 30,
      damage: 34,
      headMult: 2.35,
      rpm: 720,
      auto: true,
      reloadTime: 2.05,
      hipSpread: 0.014,
      adsSpread: 0.0022,
      recoil: 0.0046,
      recoilYaw: 0.0018,
      sound: 'rifle',
      tracerColor: 0xffd8a4,
      adsFov: 50,
    },
    pistol: {
      ...pistol,
      id: 'pistol',
      name: 'P226 SIDEARM',
      className: 'SIDEARM',
      fireMode: 'SEMI',
      magSize: 12,
      maxReserve: 84,
      reserve: 48,
      ammo: 12,
      damage: 54,
      headMult: 2.4,
      rpm: 320,
      auto: false,
      reloadTime: 1.45,
      hipSpread: 0.01,
      adsSpread: 0.0016,
      recoil: 0.0065,
      recoilYaw: 0.0025,
      sound: 'pistol',
      tracerColor: 0xffedba,
      adsFov: 56,
    },
  };

  root.position.copy(weapons.rifle.hipPos);

  return {
    root,
    weapons,
    materials: M,
    show(id) {
      Object.values(weapons).forEach((w) => {
        w.group.visible = w.id === id;
      });
    },
    updateFlash(weapon, dt) {
      const f = weapon.flash;
      if (!f) return;
      if (f.life > 0) {
        f.life -= dt;
        const p = Math.max(0, f.life / 0.055);
        f.group.visible = p > 0;
        f.mat.opacity = p * 0.95;
        f.mat2.opacity = p * 0.65;
        f.light.intensity = p * 14;
        f.sprite.material.rotation = Math.random() * Math.PI;
        f.sprite2.material.rotation = Math.random() * Math.PI;
      } else {
        f.group.visible = false;
        f.light.intensity = 0;
        f.mat.opacity = 0;
        f.mat2.opacity = 0;
      }
    },
    triggerFlash(weapon) {
      weapon.flash.life = 0.055;
      weapon.flash.group.visible = true;
    },
  };
}
