import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* ============================================================
   روستای سه‌بعدی — بازی از نمای بالا (Top-Down)
   مدل‌ها: پک‌های رایگان Quaternius (CC0) از گیت‌هاب
   منبع: https://github.com/trebeljahr/quaternius-showcase
   ============================================================ */

const WORLD = 120;                 // اندازه زمین (متر)
const HALF = WORLD / 2;
const IS_TOUCH = 'ontouchstart' in window;

// ---------- مدل‌ها (۵۶ مدل دانلودشده) ----------
const M = {
  weapons: ['Sword','Claymore','Axe','Bow_Wooden','Spear','Dagger','Hammer_Small','Sword_Golden','Katana','ShortSword','Shield_Round','AR_1','AR_2','AR_3','AR_4','AR_5','AR_6','Pistol_1','SMG_1','Sniper_1','Crossbow_1','Grenade'],
  ground:  ['CommonTree_1','CommonTree_2','PineTree_1','BirchTree_1','Rock_1','Rock_Moss_1','Bush_1','Grass','TreeStump','Flowers','Wheat','Cactus_1','Path_Straight','Path_Square'],
  props:   ['House_1','House_2','House1','House2','Building1_Small','Crate','Barrel','Fence','Well','Bonfire_Lit','Cart','Hay','MarketStand_1'],
  characters: ['KnightCharacter','Adventurer','Swat'],
  animals: ['Cow','Horse','Wolf','Fox'],
};
const pathOf = (cat, name) => `/models/${cat}/${name}.glb`;

// نام فارسی + مشخصات اسلحه‌ها
const WEAPONS = {
  Sword:        { fa:'شمشیر',        type:'melee', dmg:26, range:2.4, cd:0.45, size:0.95 },
  Claymore:     { fa:'شمشیر بزرگ',   type:'melee', dmg:48, range:2.8, cd:0.85, size:1.25 },
  Axe:          { fa:'تبر',          type:'melee', dmg:32, range:2.3, cd:0.6,  size:0.9 },
  Bow_Wooden:   { fa:'کمان چوبی',    type:'bow',   dmg:22, range:16,  cd:0.7,  size:1.0, speed:26 },
  Spear:        { fa:'نیزه',         type:'melee', dmg:24, range:3.2, cd:0.55, size:1.5 },
  Dagger:       { fa:'خنجر',         type:'melee', dmg:14, range:1.8, cd:0.25, size:0.55 },
  Hammer_Small: { fa:'چکش',          type:'melee', dmg:36, range:2.1, cd:0.7,  size:0.8 },
  Sword_Golden: { fa:'شمشیر طلایی',  type:'melee', dmg:40, range:2.5, cd:0.5,  size:1.0 },
  Katana:       { fa:'کاتانا',       type:'melee', dmg:28, range:2.5, cd:0.35, size:1.0 },
  ShortSword:   { fa:'شمشیر کوتاه', type:'melee', dmg:18, range:2.0, cd:0.3,  size:0.7 },
  Shield_Round: { fa:'سپر (ضربه)',   type:'melee', dmg:12, range:1.9, cd:0.4,  size:0.7 },
  AR_1:         { fa:'تفنگ AR-1',    type:'gun',   dmg:12, range:22,  cd:0.13, size:0.85, speed:42 },
  AR_2:         { fa:'تفنگ AR-2',    type:'gun',   dmg:13, range:22,  cd:0.12, size:0.85, speed:42 },
  AR_3:         { fa:'تفنگ AR-3',    type:'gun',   dmg:14, range:22,  cd:0.11, size:0.85, speed:44 },
  AR_4:         { fa:'تفنگ AR-4',    type:'gun',   dmg:15, range:23,  cd:0.11, size:0.9,  speed:44 },
  AR_5:         { fa:'تفنگ AR-5',    type:'gun',   dmg:12, range:22,  cd:0.1,  size:0.85, speed:46 },
  AR_6:         { fa:'تفنگ AR-6',    type:'gun',   dmg:16, range:23,  cd:0.12, size:0.9,  speed:44 },
  Pistol_1:     { fa:'تپانچه',       type:'gun',   dmg:20, range:18,  cd:0.3,  size:0.5,  speed:38 },
  SMG_1:        { fa:'مسلسل دستی',  type:'gun',   dmg:9,  range:18,  cd:0.07, size:0.7,  speed:40 },
  Sniper_1:     { fa:'تک‌تیرانداز',  type:'gun',   dmg:65, range:30,  cd:1.2,  size:1.1,  speed:70 },
  Crossbow_1:   { fa:'زنبورک',       type:'bow',   dmg:38, range:18,  cd:0.9,  size:0.95, speed:34 },
  Grenade:      { fa:'نارنجک',       type:'grenade', dmg:55, range:14, cd:1.0, size:0.45, speed:20, aoe:4.5 },
};

// ---------- صحنه ----------
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87bfe8);
scene.fog = new THREE.Fog(0x87bfe8, 70, 160);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 30, 18);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a7a3a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
sun.position.set(30, 45, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.camera.far = 140;
scene.add(sun);

// ---------- لودر مدل ----------
const loader = new GLTFLoader();
const cache = new Map();
function fitSize(obj, size, mode = 'height') {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const dim = mode === 'length' ? Math.max(s.x, s.y, s.z)
            : mode === 'ground' ? Math.max(s.x, s.z)
            : s.y;
  const k = size / (dim || 1);
  obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  // آفست عمودی تا کف مدل روی زمین بنشیند (در userData نگه می‌داریم چون position بعداً ست می‌شود)
  obj.userData.yOffset = -box2.min.y;
  obj.position.y = obj.userData.yOffset;
  return obj;
}
function loadModel(cat, name, size, mode = 'height') {
  const p = pathOf(cat, name);
  if (!cache.has(p)) {
    cache.set(p, loader.loadAsync(p).then(g => {
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return { scene: g.scene, clips: g.animations || [] };
    }));
  }
  return cache.get(p).then(src => {
    const skinned = src.clips.length > 0;
    const c = skinned ? SkeletonUtils.clone(src.scene) : src.scene.clone(true);
    fitSize(c, size, mode);
    if (skinned) {
      const mixer = new THREE.AnimationMixer(c);
      const actions = {};
      for (const clip of src.clips) actions[clip.name] = mixer.clipAction(clip);
      c.userData.mixer = mixer;
      c.userData.actions = actions;
      const idle = findClip(src.clips, ['Idle', 'idle', 'Walk']);
      if (idle) { const a = actions[idle.name]; a.play(); c.userData.current = idle.name; }
      mixers.push(mixer);
    }
    return c;
  });
}

// ---------- انیمیشن ----------
const mixers = [];
// نام کلیپ را بر اساس کلیدواژه پیدا می‌کند (مثلاً 'Run' -> 'HumanArmature|Run_swordRight')
function findClip(clips, keywords) {
  for (const kw of keywords) {
    const exact = clips.find(c => c.name.split('|').pop().toLowerCase() === kw.toLowerCase());
    if (exact) return exact;
    const partial = clips.find(c => c.name.toLowerCase().includes(kw.toLowerCase()));
    if (partial) return partial;
  }
  return null;
}
function killMixer(obj) {
  const mx = obj?.userData?.mixer;
  if (!mx) return;
  mx.stopAllAction();
  const i = mixers.indexOf(mx);
  if (i >= 0) mixers.splice(i, 1);
}

// تغییر انیمیشن با fade نرم
function playAnim(obj, keywords, fade = 0.22) {
  const actions = obj?.userData?.actions;
  if (!actions) return;
  const clips = Object.values(actions).map(a => a.getClip());
  const clip = findClip(clips, keywords);
  if (!clip) return;
  if (obj.userData.current === clip.name) return;
  const prev = actions[obj.userData.current];
  const next = actions[clip.name];
  if (!next) return;
  next.reset().setEffectiveWeight(1).fadeIn(fade).play();
  if (prev) prev.fadeOut(fade);
  obj.userData.current = clip.name;
}

// ---------- زمین ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(HALF + 30, 48),
  new THREE.MeshStandardMaterial({ color: 0x5da24a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// حلقه خاکی وسط روستا
const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(13, 32),
  new THREE.MeshStandardMaterial({ color: 0xb99a68, roughness: 1 })
);
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.02; plaza.receiveShadow = true;
scene.add(plaza);

// ---------- برخوردها ----------
const colliders = [];   // {x,z,r}
const mapProps = [];    // برای نقشه کوچک
function addCollider(x, z, r) { colliders.push({ x, z, r }); }
function resolveCollisions(e, radius) {
  for (const c of colliders) {
    const dx = e.position.x - c.x, dz = e.position.z - c.z;
    const d = Math.hypot(dx, dz), min = radius + c.r;
    if (d < min && d > 0.001) {
      e.position.x = c.x + (dx / d) * min;
      e.position.z = c.z + (dz / d) * min;
    }
  }
  e.position.x = THREE.MathUtils.clamp(e.position.x, -HALF + 2, HALF - 2);
  e.position.z = THREE.MathUtils.clamp(e.position.z, -HALF + 2, HALF - 2);
}

// ---------- ساخت جهان ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z); // فاصله افقی (بدون ارتفاع)
async function place(cat, name, x, z, size, rotY = 0, collide = 0, mode = 'height') {
  try {
    const m = await loadModel(cat, name, size, mode);
    m.position.set(x, (m.userData.yOffset || 0) + (mode === 'ground' ? 0.03 : 0), z); m.rotation.y = rotY;
    scene.add(m);
    if (collide > 0) addCollider(x, z, collide);
    mapProps.push({ x, z });
    return m;
  } catch (e) { console.warn('load fail', name, e); return null; }
}

async function buildWorld() {
  // مسیرهای خاکی (کف‌پوش زمین)
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) > 1) {
      await place('ground', 'Path_Straight', i * 4, 0, 4, Math.PI / 2, 0, 'ground');
      await place('ground', 'Path_Straight', 0, i * 4, 4, 0, 0, 'ground');
    }
  }
  await place('ground', 'Path_Square', 0, 0, 4, 0, 0, 'ground');

  // روستا — خانه‌ها و وسایل
  const village = [
    ['props','House_1', -14, -12, 5.5], ['props','House_2', 14, -13, 5.5],
    ['props','House1', -15, 11, 5],    ['props','House2', 15, 12, 5],
    ['props','Building1_Small', -24, 0, 5], ['props','Building1_Small', 24, -2, 5],
    ['props','Well', 4, -6, 1.6], ['props','Bonfire_Lit', -4, 5, 1.4],
    ['props','MarketStand_1', 7, 7, 2.6], ['props','Cart', -8, -4, 2.2],
    ['props','Hay', 10, -8, 1.4], ['props','Crate', -10, 6, 1.2],
    ['props','Barrel', -11, 7, 1.0], ['props','Barrel', 11, 6, 1.0],
    ['props','Fence', -6, -14, 2.2], ['props','Fence', 6, -14, 2.2],
    ['props','Fence', -18, 4, 2.2], ['props','Fence', 18, 5, 2.2],
  ];
  for (const [c, n, x, z, s] of village) await place(c, n, x, z, s, rnd(0, Math.PI * 2), s * 0.42);

  // جنگل دور تا دور
  const trees = ['CommonTree_1','CommonTree_2','PineTree_1','BirchTree_1'];
  for (let i = 0; i < 46; i++) {
    const a = rnd(0, Math.PI * 2), r = rnd(30, 56);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
    await place('ground', trees[i % 4], x, z, rnd(3.5, 6), rnd(0, 6.28), 0.8);
  }
  // سنگ، بوته، علف، گل، گندم، کاکتوس
  for (let i = 0; i < 14; i++) await place('ground', i % 2 ? 'Rock_1' : 'Rock_Moss_1', rnd(-52, 52), rnd(-52, 52), rnd(0.8, 1.8), rnd(0, 6.28), 0.7);
  for (let i = 0; i < 18; i++) await place('ground', 'Bush_1', rnd(-50, 50), rnd(-50, 50), rnd(0.8, 1.4), rnd(0, 6.28), 0.5);
  for (let i = 0; i < 40; i++) await place('ground', 'Grass', rnd(-55, 55), rnd(-55, 55), rnd(0.5, 0.9), rnd(0, 6.28), 0);
  for (let i = 0; i < 16; i++) await place('ground', 'Flowers', rnd(-45, 45), rnd(-45, 45), rnd(0.5, 0.8), rnd(0, 6.28), 0);
  for (let i = 0; i < 10; i++) await place('ground', 'Wheat', rnd(-40, -28), rnd(-20, 20), rnd(1, 1.5), rnd(0, 6.28), 0);
  for (let i = 0; i < 6; i++) await place('ground', 'Cactus_1', rnd(30, 48), rnd(28, 48), rnd(1.2, 2), rnd(0, 6.28), 0.5);
  for (let i = 0; i < 5; i++) await place('ground', 'TreeStump', rnd(-45, 45), rnd(-45, 45), 1.1, rnd(0, 6.28), 0.5);
}

// ---------- صدای ساده ----------
let AC = null;
function beep(freq, dur = 0.08, type = 'square', vol = 0.05) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch {}
}

// ---------- بازیکن ----------
let atkAnimT = 0;
const player = { hp: 100, maxHp: 100, speed: 8.5, weapon: 'Sword', cd: 0, alive: true };
const playerG = new THREE.Group();
scene.add(playerG);
let weaponMesh = null;
let playerModel = null;

async function equipWeapon(name) {
  player.weapon = name;
  if (weaponMesh) { playerG.remove(weaponMesh); weaponMesh = null; }
  const w = WEAPONS[name];
  try {
    weaponMesh = await loadModel('weapons', name, w.size, 'length');
    weaponMesh.position.set(0.55, 1.05, 0.25);
    weaponMesh.rotation.set(0.4, -0.5, 0.3);
    playerG.add(weaponMesh);
  } catch {}
  document.getElementById('weaponname').textContent = w.fa;
  document.getElementById('weaponhint').textContent = w.type === 'melee' ? 'کلیک = ضربه' : 'کلیک = شلیک';
  toast(`⚔️ ${w.fa} برداشته شد`);
}

// ---------- دشمن‌ها ----------
const enemies = [];
function makeHpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x300000, depthTest: false }));
  bg.scale.set(1.4, 0.18, 1);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x53e05a, depthTest: false }));
  fg.scale.set(1.4, 0.12, 1); fg.position.z = 0.01;
  g.add(bg, fg); g.userData = { fg };
  return g;
}
const ENEMY_TYPES = [
  { model: 'Swat',       hp: 70,  speed: 3.6, dmg: 10, size: 1.8, score: 30 },
  { model: 'Adventurer', hp: 45,  speed: 4.6, dmg: 8,  size: 1.8, score: 20 },
  { model: 'Wolf',       hp: 30,  speed: 6.2, dmg: 7,  size: 1.1, score: 15 },
];
async function spawnEnemy(typeIdx) {
  const t = ENEMY_TYPES[typeIdx % ENEMY_TYPES.length];
  const a = rnd(0, Math.PI * 2);
  const g = new THREE.Group();
  let eModel = null;
  g.position.set(Math.cos(a) * (HALF - 6), 0, Math.sin(a) * (HALF - 6));
  try {
    const cat = t.model === 'Wolf' ? 'animals' : 'characters';
    const mdl = await loadModel(cat, t.model, t.size);
    g.add(mdl); eModel = mdl;
  } catch {}
  const bar = makeHpBar(); bar.position.y = t.size + 0.5; g.add(bar);
  scene.add(g);
  enemies.push({ g, bar, model: eModel, hp: t.hp, maxHp: t.hp, speed: t.speed, dmg: t.dmg, score: t.score, atkCd: 0, wob: rnd(0, 9) });
}

// ---------- حیوانات ----------
const animals = [];
async function spawnAnimals() {
  const list = [['Cow', 2.2], ['Horse', 2.4], ['Fox', 1.0]];
  for (const [n, s] of list) {
    const g = new THREE.Group();
    g.position.set(rnd(-30, 30), 0, rnd(-30, 30));
    let mdl = null;
    try { mdl = await loadModel('animals', n, s); g.add(mdl); } catch {}
    scene.add(g);
    animals.push({ g, mdl, dir: rnd(0, 6.28), t: rnd(1, 4), speed: rnd(0.8, 1.6) });
  }
}

// ---------- پیکاپ اسلحه ----------
const pickups = [];
async function spawnPickup(name, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  try { g.add(await loadModel('weapons', name, 1.15, 'length')); } catch {}
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  scene.add(g);
  pickups.push({ g, name, ring });
}
async function scatterPickups() {
  const names = ['AR_1','Sword_Golden','Bow_Wooden','SMG_1','Claymore','Sniper_1','Katana','Pistol_1','Grenade','Axe','Crossbow_1','Spear'];
  for (let i = 0; i < names.length; i++) {
    const a = (i / names.length) * Math.PI * 2 + rnd(-0.2, 0.2);
    await spawnPickup(names[i], Math.cos(a) * rnd(16, 34), Math.sin(a) * rnd(16, 34));
  }
}

// ---------- پرتابه‌ها و افکت‌ها ----------
const bullets = [];
const effects = [];
const bulletGeo = new THREE.BoxGeometry(0.12, 0.12, 0.7);
function shoot(from, dir, w) {
  const mat = new THREE.MeshBasicMaterial({ color: w.type === 'grenade' ? 0x7ddb4a : 0xffe27a });
  const m = new THREE.Mesh(bulletGeo, mat);
  m.position.copy(from); m.position.y = 1.2;
  m.lookAt(from.clone().add(dir));
  scene.add(m);
  bullets.push({ m, vel: dir.clone().multiplyScalar(w.speed), dmg: w.dmg, life: w.range / w.speed, aoe: w.aoe || 0 });
  beep(w.type === 'gun' ? 700 : 420, 0.06, 'square', 0.04);
}
function slashEffect(pos, angle) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 2.2, 20, 1, 0, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2; m.rotation.z = -angle + Math.PI * 0.45;
  m.position.set(pos.x, 0.15, pos.z);
  scene.add(m); effects.push({ m, t: 0 });
}
function boomEffect(pos, r) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.55, depthWrite: false })
  );
  m.position.set(pos.x, 0.8, pos.z);
  scene.add(m); effects.push({ m, t: 0, boom: true });
  beep(90, 0.35, 'sawtooth', 0.09);
}
function damageEnemies(pos, radius, dmg, aoe = 0) {
  let hit = false;
  for (const e of [...enemies]) {
    const d = flatDist(e.g.position, pos);
    if (d < radius + (aoe || 0)) {
      e.hp -= dmg; hit = true;
      e.bar.userData.fg.scale.x = 1.4 * Math.max(0, e.hp / e.maxHp);
      e.bar.userData.fg.position.x = 0.7 * (1 - Math.max(0, e.hp / e.maxHp));
      if (e.hp <= 0) {
        scene.remove(e.g); killMixer(e.model); enemies.splice(enemies.indexOf(e), 1);
        score += e.score; kills++;
        updateHUD();
        if (Math.random() < 0.22) {
          const names = Object.keys(WEAPONS);
          spawnPickup(names[Math.floor(Math.random() * names.length)], e.g.position.x, e.g.position.z);
        }
      }
    }
  }
  return hit;
}

// ---------- ورودی ----------
const keys = {};
let mouseDown = false, mouseX = 0, mouseY = 0, camDist = 30;
let joyVec = { x: 0, y: 0 }, joyAtk = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE') tryPickup();
  if (e.code === 'Escape' && galleryOpen) closeGallery();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
addEventListener('mousedown', e => { if (e.target === renderer.domElement) mouseDown = true; });
addEventListener('mouseup', () => mouseDown = false);
addEventListener('wheel', e => { if (!galleryOpen) camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.02, 16, 48); }, { passive: true });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// جوی‌استیک موبایل
const joy = document.getElementById('joy'), knob = document.getElementById('joyknob');
let joyId = null;
joy.addEventListener('touchstart', e => { joyId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === joyId) {
    const r = joy.getBoundingClientRect();
    let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy), max = 40;
    if (len > max) { dx *= max / len; dy *= max / len; }
    knob.style.transform = `translate(${-dx}px, ${-dy}px)`;
    joyVec = { x: dx / max, y: dy / max };
  }
}, { passive: true });
addEventListener('touchend', e => {
  for (const t of e.changedTouches) if (t.identifier === joyId) {
    joyId = null; joyVec = { x: 0, y: 0 }; knob.style.transform = '';
  }
});
const atkBtn = document.getElementById('atkbtn');
atkBtn.addEventListener('touchstart', e => { joyAtk = true; e.preventDefault(); }, { passive: false });
atkBtn.addEventListener('touchend', () => joyAtk = false);

// ---------- HUD ----------
let score = 0, kills = 0, wave = 1, waveTimer = 0, spawnQueue = 0;
const faNum = n => Math.round(n).toLocaleString('fa-IR');
function updateHUD() {
  document.getElementById('score').textContent = faNum(score);
  document.getElementById('kills').textContent = faNum(kills);
  document.getElementById('wave').textContent = faNum(wave);
  document.getElementById('hpfill').style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
}
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.display = 'none', 2200);
}
let nearPickup = null;
function tryPickup() {
  if (nearPickup) {
    const i = pickups.indexOf(nearPickup);
    if (i >= 0) { scene.remove(nearPickup.g); pickups.splice(i, 1); }
    equipWeapon(nearPickup.name);
    nearPickup = null;
    beep(880, 0.12, 'sine', 0.06);
  }
}

// ---------- گالری مدل‌ها ----------
let galleryOpen = false, gAz = 0.6, gPol = 0.9, gDist = 9, gModel = null;
const GALLERY_POS = new THREE.Vector3(170, 0, 0);
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(2.4, 2.8, 0.5, 24),
  new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.6 })
);
pedestal.position.set(GALLERY_POS.x, 0.25, GALLERY_POS.z);
pedestal.receiveShadow = true; pedestal.visible = false;
scene.add(pedestal);
const gLight = new THREE.SpotLight(0xffffff, 60, 40, 0.5, 0.4);
gLight.position.set(GALLERY_POS.x + 6, 10, GALLERY_POS.z + 6);
gLight.visible = false; scene.add(gLight);

function buildGalleryList() {
  const list = document.getElementById('glist');
  const groups = [
    ['weapons', '⚔️ اسلحه‌ها', M.weapons],
    ['ground', '🌳 زمین و طبیعت', M.ground],
    ['props', '🏠 وسایل و ساختمان‌ها', M.props],
    ['characters', '🧍 کاراکترها', M.characters],
    ['animals', '🐄 حیوانات', M.animals],
  ];
  for (const [cat, title, names] of groups) {
    const h = document.createElement('div'); h.className = 'ggroup'; h.textContent = title; list.appendChild(h);
    for (const n of names) {
      const b = document.createElement('button');
      b.className = 'gitem'; b.textContent = WEAPONS[n]?.fa || n;
      b.onclick = () => { document.querySelectorAll('.gitem').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); showInGallery(cat, n); };
      list.appendChild(b);
    }
  }
}
async function showInGallery(cat, name) {
  document.getElementById('gname').textContent = WEAPONS[name]?.fa || name;
  if (gModel) { scene.remove(gModel); gModel = null; }
  try {
    gModel = await loadModel(cat, name, cat === 'ground' || cat === 'props' ? 3.2 : 3.4, cat === 'weapons' ? 'length' : cat === 'ground' ? 'ground' : 'height');
    gModel.position.set(GALLERY_POS.x, 0.5, GALLERY_POS.z);
    scene.add(gModel);
  } catch {}
}
function openGallery() {
  galleryOpen = true;
  document.getElementById('gallery').classList.add('open');
  pedestal.visible = true; gLight.visible = true;
  showInGallery('weapons', 'Sword_Golden');
}
function closeGallery() {
  galleryOpen = false;
  document.getElementById('gallery').classList.remove('open');
  pedestal.visible = false; gLight.visible = false;
  if (gModel) { scene.remove(gModel); gModel = null; }
}
document.getElementById('galleryBtn').onclick = openGallery;
document.getElementById('gclose').onclick = closeGallery;

// چرخش گالری با درگ
let gDrag = false, gLast = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => { if (galleryOpen) { gDrag = true; gLast = { x: e.clientX, y: e.clientY }; } });
addEventListener('pointermove', e => {
  if (gDrag && galleryOpen) {
    gAz += (e.clientX - gLast.x) * 0.01;
    gPol = THREE.MathUtils.clamp(gPol - (e.clientY - gLast.y) * 0.01, 0.15, 1.5);
    gLast = { x: e.clientX, y: e.clientY };
  }
});
addEventListener('pointerup', () => gDrag = false);
addEventListener('wheel', e => { if (galleryOpen) gDist = THREE.MathUtils.clamp(gDist + e.deltaY * 0.01, 4, 20); }, { passive: true });

// ---------- نقشه کوچک ----------
const mm = document.getElementById('minimap').getContext('2d');
function drawMinimap() {
  const S = 150, k = S / WORLD;
  mm.fillStyle = '#2c5a34'; mm.fillRect(0, 0, S, S);
  mm.fillStyle = '#b99a68'; mm.fillRect(S/2 - 13*k, S/2 - 13*k, 26*k, 26*k);
  mm.fillStyle = '#8a6a42';
  for (const p of mapProps) mm.fillRect((p.x + HALF) * k - 1.5, (p.z + HALF) * k - 1.5, 3, 3);
  const dot = (x, z, c, r = 3) => { mm.fillStyle = c; mm.beginPath(); mm.arc((x + HALF) * k, (z + HALF) * k, r, 0, 7); mm.fill(); };
  for (const p of pickups) dot(p.g.position.x, p.g.position.z, '#ffd76a', 2.5);
  for (const a of animals) dot(a.g.position.x, a.g.position.z, '#ccc', 2);
  for (const e of enemies) dot(e.g.position.x, e.g.position.z, '#ff4d4d', 3);
  dot(playerG.position.x, playerG.position.z, '#fff', 4);
}

// ---------- حمله ----------
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function aimPoint() {
  const v = new THREE.Vector3((mouseX / innerWidth) * 2 - 1, -(mouseY / innerHeight) * 2 + 1, 0);
  raycaster.setFromCamera(v, camera);
  const p = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, p);
  return p;
}
function attack() {
  const w = WEAPONS[player.weapon];
  if (player.cd > 0) return;
  player.cd = w.cd;
  const dir = new THREE.Vector3(Math.sin(playerG.rotation.y), 0, Math.cos(playerG.rotation.y));
  const from = playerG.position.clone().add(dir.clone().multiplyScalar(0.8));
  if (w.type === 'melee') {
    slashEffect(playerG.position, playerG.rotation.y);
      if (playerModel) { playAnim(playerModel, ['swordAttack', 'Run_swordAttack', 'Attack'], 0.08); atkAnimT = 0.35; }
    damageEnemies(from, w.range, w.dmg);
    beep(300, 0.07, 'triangle', 0.05);
  } else {
    shoot(from, dir, w);
  }
}

// ---------- حلقه اصلی ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (galleryOpen) {
    const target = GALLERY_POS.clone().add(new THREE.Vector3(0, 1.5, 0));
    camera.position.set(
      target.x + Math.sin(gAz) * Math.sin(gPol) * gDist,
      target.y + Math.cos(gPol) * gDist,
      target.z + Math.cos(gAz) * Math.sin(gPol) * gDist
    );
    camera.lookAt(target);
    if (gModel) gModel.rotation.y += dt * 0.8;
    renderer.render(scene, camera);
    return;
  }

  // --- حرکت بازیکن ---
  let mx = 0, mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  if (joyVec.x || joyVec.y) { mx = joyVec.x; mz = joyVec.y; }
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) {
    playerG.position.x += (mx / Math.max(ml, 1)) * player.speed * dt;
    playerG.position.z += (mz / Math.max(ml, 1)) * player.speed * dt;
    playerG.rotation.y = Math.atan2(mx, mz);
  }
  // نشانه‌گیری با ماوس
  if (!IS_TOUCH) {
    const p = aimPoint();
    if (p) playerG.rotation.y = Math.atan2(p.x - playerG.position.x, p.z - playerG.position.z);
  }
  resolveCollisions(playerG, 0.7);
  // انیمیشن بازیکن: ایستاده / راه‌رفتن (مدل واقعی دویدن دارد)
  atkAnimT = Math.max(0, atkAnimT - dt);
  if (playerModel && atkAnimT === 0) playAnim(playerModel, ml > 0.01 ? ['Run', 'Walking', 'Walk'] : ['Idle']);
  if (playerModel?.userData.mixer && ml > 0.01) playerModel.userData.mixer.timeScale = 1.1;

  // --- حمله ---
  player.cd -= dt;
  if (mouseDown || joyAtk) attack();

  // --- موج دشمن‌ها ---
  if (enemies.length === 0 && spawnQueue === 0) {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      spawnQueue = 3 + wave * 2;
      toast(`🌊 موج ${faNum(wave)} — ${faNum(spawnQueue)} دشمن!`);
      waveTimer = 3;
    }
  } else if (spawnQueue > 0) {
    spawnQueue--;
    spawnEnemy(Math.floor(rnd(0, 3)));
    if (spawnQueue === 0) wave++;
  }

  // --- دشمن‌ها ---
  for (const e of enemies) {
    const to = playerG.position.clone().sub(e.g.position); to.y = 0;
    const d = to.length();
    if (d > 1.6) {
      to.normalize();
      e.g.position.add(to.multiplyScalar(e.speed * dt));
      e.g.rotation.y = Math.atan2(to.x, to.z);
    } else {
      e.atkCd -= dt;
      if (e.atkCd <= 0) {
        e.atkCd = 0.9;
        player.hp -= e.dmg;
        updateHUD(); beep(140, 0.15, 'sawtooth', 0.07);
        if (player.hp <= 0) {
          player.hp = player.maxHp;
          playerG.position.set(0, 0, 0);
          wave = 1; spawnQueue = 0; waveTimer = 2;
          for (const en of [...enemies]) { scene.remove(en.g); killMixer(en.model); }
          enemies.length = 0;
          toast('💀 باختی! از اول شروع شد');
          updateHUD();
        }
      }
    }
    if (e.model) playAnim(e.model, d > 1.6 ? ['Run', 'Gallop', 'Walk'] : ['Attack', 'Idle']);
    resolveCollisions(e.g, 0.6);
  }

  // --- حیوانات ---
  for (const a of animals) {
    a.t -= dt;
    const dp = a.g.position.distanceTo(playerG.position);
    let moving = true;
    if (dp < 6) { // فرار از بازیکن
      const away = a.g.position.clone().sub(playerG.position).setY(0).normalize();
      a.g.position.add(away.multiplyScalar(3.5 * dt));
      a.g.rotation.y = Math.atan2(away.x, away.z);
      if (a.mdl) playAnim(a.mdl, ['Gallop', 'Run', 'Walk']);
    } else if (a.t <= 0) {
      a.t = rnd(2, 5); a.dir = rnd(0, 6.28);
      moving = false;
      if (a.mdl) playAnim(a.mdl, ['Eating', 'Idle']);
    } else {
      a.g.position.x += Math.sin(a.dir) * a.speed * dt;
      a.g.position.z += Math.cos(a.dir) * a.speed * dt;
      a.g.rotation.y = a.dir;
      if (a.mdl) playAnim(a.mdl, ['Walk']);
    }
    resolveCollisions(a.g, 0.8);
  }

  // --- پیکاپ‌ها ---
  nearPickup = null;
  for (const p of pickups) {
    p.g.rotation.y += dt * 1.5;
    p.g.position.y = 0.4 + Math.sin(t * 2 + p.g.position.x) * 0.15;
    p.ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.3;
    if (p.g.position.distanceTo(playerG.position) < 2.0) nearPickup = p;
  }
  const prompt = document.getElementById('prompt');
  if (nearPickup) {
    prompt.innerHTML = `⚔️ <b>${WEAPONS[nearPickup.name].fa}</b> — ${IS_TOUCH ? 'لمس کن تا برداری' : 'کلید E برای برداشتن'}`;
    prompt.style.display = 'block';
    if (IS_TOUCH) tryPickup();
  } else prompt.style.display = 'none';

  // --- پرتابه‌ها ---
  for (const b of [...bullets]) {
    b.m.position.add(b.vel.clone().multiplyScalar(dt));
    b.life -= dt;
    let dead = b.life <= 0;
    if (b.aoe) {
      if (dead || enemies.some(e => flatDist(e.g.position, b.m.position) < 1.4)) {
        boomEffect(b.m.position, b.aoe);
        damageEnemies(b.m.position, 0.5, b.dmg, b.aoe);
        dead = true;
      }
    } else if (damageEnemies(b.m.position, 0.9, b.dmg)) dead = true;
    if (dead) { scene.remove(b.m); bullets.splice(bullets.indexOf(b), 1); }
  }

  // --- افکت‌ها ---
  for (const f of [...effects]) {
    f.t += dt * 4;
    f.m.material.opacity = Math.max(0, (f.boom ? 0.55 : 0.8) * (1 - f.t));
    f.m.scale.setScalar(1 + f.t * (f.boom ? 1.5 : 0.6));
    if (f.t >= 1) { scene.remove(f.m); effects.splice(effects.indexOf(f), 1); }
  }

  // --- آپدیت انیمیشن‌ها ---
  for (const mx2 of mixers) mx2.update(dt);

  // --- دوربین از بالا ---
  const camTarget = playerG.position.clone().add(new THREE.Vector3(0, camDist, camDist * 0.55));
  camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  camera.lookAt(playerG.position.x, 0, playerG.position.z);

  drawMinimap();
  renderer.render(scene, camera);
}

// ---------- شروع ----------
(async function init() {
  const msg = document.getElementById('loadmsg');
  msg.textContent = 'ساخت روستا و جنگل…';
  await buildWorld();
  msg.textContent = 'بارگذاری کاراکتر و اسلحه…';
  try {
    playerModel = await loadModel('characters', 'KnightCharacter', 1.8);
    playerModel.position.y = 0;
    playerG.add(playerModel);
  } catch {}
  await equipWeapon('Sword');
  await spawnAnimals();
  await scatterPickups();
  buildGalleryList();
  updateHUD();
  document.getElementById('loading').style.display = 'none';
  toast('🎮 به روستا خوش آمدی! با WASD حرکت کن و با کلیک حمله کن');
  animate();
})();
