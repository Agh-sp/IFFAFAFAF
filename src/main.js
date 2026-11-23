import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/* =====================================================================
   نبرد شرکت  |  تیم سوات  vs  تیم تروریست
   مپ: ساختمان مرکزی یک شرکت بزرگ — برق قطع است، فقط چراغ‌قوه و
   نور اضطراری. همه مدل‌ها GLB از پک‌های Quaternius (CC0).
   ===================================================================== */

const TILE = 2;                 // هر خانه نقشه = ۲ متر
const COLS = 30, ROWS = 22;
const HW = COLS * TILE / 2, HH = ROWS * TILE / 2;
const IS_TOUCH = 'ontouchstart' in window;
const FLOOR_Y = 0.09;   // ارتفاع سطح کاشی کف

const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* ------------------------- تجهیزات و تیم‌ها ------------------------- */
const WEAPONS = {
  // --- سلاح‌های اصلی بازیکن ---
  Shotgun: {
    fa: 'اسلحه سنگین — شاتگان', short: 'شاتگان سنگین', model: 'Shotgun_2', cat: 'weapons2',
    kind: 'shotgun', dmg: 20, pellets: 8, cd: 0.85, mag: 6, range: 13, spread: 0.16, reloadTime: 2.2,
  },
  Colt: {
    fa: 'کلت — هفت‌تیر', short: 'کلت', model: 'Revolver_2', cat: 'weapons2',
    kind: 'pistol', dmg: 46, cd: 0.42, mag: 6, range: 20, spread: 0.028, reloadTime: 1.6,
  },
  Knife: {
    fa: 'چاقو', short: 'چاقو', model: 'Knife', cat: 'weapons2',
    kind: 'melee', dmg: 85, cd: 0.55, mag: Infinity, range: 2.1, spread: 0, silent: true, reloadTime: 0.7,
  },
  // --- سلاح‌های تیم‌ها ---
  AR_1:     { fa: 'تفنگ AR-1',  model: 'AR_1',  cat: 'guns', kind: 'rifle', dmg: 13, cd: 0.13, mag: 30, range: 26, spread: 0.05 },
  AR_3:     { fa: 'تفنگ AR-3',  model: 'AR_3',  cat: 'guns', kind: 'rifle', dmg: 14, cd: 0.12, mag: 30, range: 26, spread: 0.05 },
  AR_5:     { fa: 'تفنگ AR-5',  model: 'AR_5',  cat: 'guns', kind: 'rifle', dmg: 11, cd: 0.10, mag: 30, range: 24, spread: 0.06 },
  SMG_1:    { fa: 'مسلسل SMG-1', model: 'SMG_1', cat: 'guns', kind: 'rifle', dmg: 9,  cd: 0.07, mag: 35, range: 18, spread: 0.08 },
  SMG_2:    { fa: 'مسلسل SMG-2', model: 'SMG_2', cat: 'guns', kind: 'rifle', dmg: 10, cd: 0.08, mag: 35, range: 18, spread: 0.07 },
  Pistol_1: { fa: 'تپانچه P-1', model: 'Pistol_1', cat: 'guns', kind: 'pistol', dmg: 19, cd: 0.28, mag: 12, range: 16, spread: 0.05 },
  Pistol_2: { fa: 'تپانچه P-2', model: 'Pistol_2', cat: 'guns', kind: 'pistol', dmg: 21, cd: 0.30, mag: 12, range: 16, spread: 0.05 },
  Sniper_1: { fa: 'تک‌تیرانداز SR-1', model: 'Sniper_1', cat: 'guns', kind: 'sniper', dmg: 72, cd: 1.15, mag: 5, range: 42, spread: 0.008, scope: true },
  Sniper_2: { fa: 'تک‌تیرانداز SR-2', model: 'Sniper_2', cat: 'guns', kind: 'sniper', dmg: 66, cd: 1.05, mag: 5, range: 42, spread: 0.010, scope: true },
};
// ترتیب چرخش سلاح برای بازیکن
const PLAYER_LOADOUT = ['Shotgun', 'Colt', 'Knife'];

// هر تیم ترکیب و توانایی خودش را دارد
const SWAT_TEAM = [
  { id: 'swat1', name: 'سوات ۱',    model: 'Swat',   gun: 'AR_1',     role: 'مهاجم',      hp: 100 },
  { id: 'swat2', name: 'سوات ۲',    model: 'Worker', gun: 'SMG_1',    role: 'پشتیبان',    hp: 110 },
  { id: 'swat3', name: 'سوات ۳',    model: 'Suit',   gun: 'Sniper_2', role: 'تک‌تیرانداز', hp: 90 },
  { id: 'swat4', name: 'سوات ۴',    model: 'Casual', gun: 'Pistol_1', role: 'پزشک',       hp: 95 },
];
const TERROR_TEAM = [
  { id: 'ter1', name: 'تروریست ۱', model: 'Punk',           gun: 'AR_3',     role: 'مهاجم',      hp: 105 },
  { id: 'ter2', name: 'تروریست ۲', model: 'CyberCharacter', gun: 'SMG_2',    role: 'خرابکار',    hp: 95 },
  { id: 'ter3', name: 'تروریست ۳', model: 'Spacesuit',      gun: 'Sniper_1', role: 'تک‌تیرانداز', hp: 100 },
  { id: 'ter4', name: 'تروریست ۴', model: 'Casual2',        gun: 'Pistol_2', role: 'نفربر',      hp: 100 },
  { id: 'ter5', name: 'تروریست ۵', model: 'Beach',          gun: 'AR_5',     role: 'مهاجم',      hp: 95 },
];

const ABILITY_CD = { grenade: 6, smoke: 12 };

/* ------------------------------ رندرر ------------------------------ */
const container = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010204);
// مه خیلی رقیق: دوربین ۳۳ متر از بازیکن فاصله دارد؛ با چگالی بالا
// همه‌چیز حتی کف زیر پای بازیکن با رنگ مه (تقریباً سیاه) جایگزین می‌شد.
scene.fog = new THREE.FogExp2(0x04070e, 0.0045);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 260);
camera.position.set(0, 26, 16);

// برق قطع است: نور محیط بسیار کم
// تاریکی مطلق: هیچ نور محیطی‌ای وجود ندارد. فقط چراغ‌قوه‌ها و
// چراغ‌های اضطراری باقی‌مانده چیزی را روشن می‌کنند.
// نور محیطی «خیلی کم ولی کافی»: بدون این، کل صفحه سیاه مطلق می‌شود
// و بازیکن حتی زمین زیر پایش را نمی‌بیند. تاریکی از کم بودنش می‌آید، نه از صفر بودنش.
const ambientLight = new THREE.AmbientLight(0x55697f, 1.35);
scene.add(ambientLight);
// نور عمودی کم‌سو از بالا: بدون این، دیوارها و کف کاملاً تخت و سیاه می‌شوند
const overhead = new THREE.DirectionalLight(0x93acca, 0.7);
overhead.position.set(8, 40, 12);
scene.add(overhead);

/* ------------------------------ لودر ------------------------------ */
const loader = new GLTFLoader();
const cache = new Map();
const pathOf = (cat, name) => `/models/${cat}/${name}.glb`;

function bboxOf(o) { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); }

function prep(src, target, mode = 'height') {
  const rigged = src.clips.length > 0;
  const root = rigged ? SkeletonUtils.clone(src.scene) : src.scene.clone(true);
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; }
  });
  const b = bboxOf(root), s = b.getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(s.x, s.z) : mode === 'length' ? Math.max(s.x, s.y, s.z) : s.y;
  root.scale.multiplyScalar(target / (dim || 1));
  bboxOf(root);
  root.userData.baseY = -bboxOf(root).min.y;
  return root;
}

// مدل ثابت (بدون انیمیشن)
function loadProp(cat, name, target, mode = 'height') {
  const p = pathOf(cat, name);
  if (!cache.has(p)) {
    cache.set(p, loader.loadAsync(p).then(g => {
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
      return { scene: g.scene, clips: [] };
    }));
  }
  return cache.get(p).then(src => prep(src, target, mode));
}

// مدل کاراکتر: انیمیشن از شوالیه (ریگ یکسان) روی مدل تیم ریتارگت می‌شود
let ANIM_SRC = null;
function loadAnimSource() {
  if (!ANIM_SRC) {
    ANIM_SRC = loader.loadAsync('/models/anim/KnightCharacter.glb').then(g => g);
  }
  return ANIM_SRC;
}

// نگاشت استخوان‌های ریگ شوالیه → ریگ مدل‌های تیم
const BONE_ALIAS = {
  PalmL: 'HandL', PalmR: 'HandR', MiddleHandL: 'HandL', MiddleHandR: 'HandR',
  FingersL: 'HandL', FingersR: 'HandR',
  ThumbL: 'Thumb2L', Thumb2L: 'Thumb3L', ThumbR: 'Thumb2R', Thumb2R: 'Thumb3R',
};
// انیمیشن را از ریگ شوالیه به ریگ کاراکتر تیم منتقل می‌کند (فقط چرخش‌ها)
function remapClip(clip, root) {
  const bones = new Set();
  root.traverse(o => { if (o.isBone) bones.add(o.name); });
  const tracks = [];
  for (const t of clip.tracks) {
    const dot = t.name.indexOf('.');
    const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    if (!prop.includes('quaternion')) continue;
    const target = bones.has(node) ? node : BONE_ALIAS[node];
    if (!target || !bones.has(target)) continue;
    const nt = t.clone();
    nt.name = `${target}.quaternion`;
    tracks.push(nt);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function loadCharacter(modelName, target = 1.8) {
  return Promise.all([loadAnimSource(), loader.loadAsync(`/models/team/${modelName}.glb`)]).then(([animGltf, gltf]) => {
    const root = gltf.scene;
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    const b = bboxOf(root), s = b.getSize(new THREE.Vector3());
    root.scale.multiplyScalar(target / s.y);
    bboxOf(root);
    root.userData.baseY = -bboxOf(root).min.y;

    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clip of animGltf.animations) {
      const mapped = remapClip(clip, root);
      if (mapped.tracks.length < 6) continue;
      actions[clip.name] = mixer.clipAction(mapped);
    }
    root.userData.mixer = mixer;
    root.userData.actions = actions;
    root.userData.current = null;
    mixers.push(mixer);
    return root;
  });
}

const mixers = [];
const findClip = (clips, keys) => {
  for (const k of keys) {
    const ex = clips.find(c => c.name.split('|').pop().toLowerCase() === k.toLowerCase());
    if (ex) return ex;
    const pa = clips.find(c => c.name.toLowerCase().includes(k.toLowerCase()));
    if (pa) return pa;
  }
  return null;
};
// اگر هیچ انیمیشنی پخش نمی‌شود (مثلاً کلیپ Idle پیدا نشد) اولین کلیپ را پخش کن
function ensureIdle(obj) {
  const acts = obj?.userData?.actions;
  if (!acts) return;
  const list = Object.values(acts);
  if (!list.length) return;
  if (!list.some(a => a.isRunning())) {
    const first = list.find(a => /idle/i.test(a.getClip().name)) || list[0];
    first.reset().play();
    obj.userData.current = first.getClip().name;
  }
}

function playAnim(obj, keys, fade = 0.18, once = false) {
  const acts = obj?.userData?.actions;
  if (!acts) return;
  const clips = Object.values(acts).map(a => a.getClip());
  const clip = findClip(clips, keys);
  if (!clip || obj.userData.current === clip.name) return;
  const prev = acts[obj.userData.current], next = acts[clip.name];
  if (!next) return;
  next.reset().setEffectiveWeight(1).fadeIn(fade).play();
  if (once) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
  if (prev) prev.fadeOut(fade);
  obj.userData.current = clip.name;
}

/* --------------------------- نقشه شرکت --------------------------- */
const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
const F = 0, W = 1;
const world = (c, r) => ({ x: -HW + TILE * (c + 0.5), z: -HH + TILE * (r + 0.5) });

(function design() {
  for (let c = 0; c < COLS; c++) { grid[0][c] = W; grid[ROWS - 1][c] = W; }
  for (let r = 0; r < ROWS; r++) { grid[r][0] = W; grid[r][COLS - 1] = W; }

  const row = (r, c0, c1, gaps = []) => { for (let c = c0; c <= c1; c++) if (!gaps.includes(c)) grid[r][c] = W; };
  const col = (c, r0, r1, gaps = []) => { for (let r = r0; r <= r1; r++) if (!gaps.includes(r)) grid[r][c] = W; };

  // راهروی افقی (ردیف ۱۰) و راهروی عمودی (ستون ۱۴) — همیشه باز
  grid[10].fill(F);
  for (let r = 1; r < ROWS - 1; r++) grid[r][14] = F;

  // ---- طبقه بالا: اتاق مدیریت / اتاق جلسات / اتاق سرور ----
  col(8, 1, 9, [5]);
  col(21, 1, 9, [5]);
  row(9, 1, COLS - 2, [4, 14, 25]);
  // رک سرور به‌عنوان مانع داخل اتاق راست
  for (let r = 4; r <= 6; r++) for (let c = 25; c <= 27; c++) grid[r][c] = W;

  // ---- طبقه پایین: آزمایشگاه / امنیت / بایگانی ----
  col(7, 11, ROWS - 2, [16]);
  col(17, 11, ROWS - 2, [13]);
  col(23, 11, ROWS - 2, [18]);
  row(11, 1, COLS - 2, [3, 11, 20, 26]);
})();

const WALL_SEGS = [];
const PROP_COLLIDERS = [];

// اگر کاراکتری داخل مانع گیر کرده باشد (مثلاً هنگام اسپاون)، آزادش می‌کند
function unstick(pos, radius) {
  for (let attempt = 0; attempt < 12; attempt++) {
    let pushed = false;
    for (const c of PROP_COLLIDERS) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min) {
        const ang = d > 0.001 ? Math.atan2(dz, dx) : Math.random() * 6.28;
        const nx = c.x + Math.cos(ang) * (min + 0.08);
        const nz = c.z + Math.sin(ang) * (min + 0.08);
        if (gridAt(nx, nz) !== W) { pos.x = nx; pos.z = nz; pushed = true; }
      }
    }
    if (!pushed) return true;
  }
  return false;
}

function resolveCollision(pos, radius) {
  for (const c of PROP_COLLIDERS) {
    const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = radius + c.r;
    if (d < min && d > 0.001) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
  }
  // دیوارها بر اساس شبکه (مستطیلی و دقیق)
  const c0 = Math.floor((pos.x + HW) / TILE), r0 = Math.floor((pos.z + HH) / TILE);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS || grid[r][c] !== W) continue;
      const cx = -HW + TILE * (c + 0.5), cz = -HH + TILE * (r + 0.5);
      const dx = pos.x - cx, dz = pos.z - cz;
      const ox = TILE / 2 + radius - Math.abs(dx), oz = TILE / 2 + radius - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) pos.x = cx + Math.sign(dx || 1) * (TILE / 2 + radius);
        else pos.z = cz + Math.sign(dz || 1) * (TILE / 2 + radius);
      }
    }
  }
  pos.x = clamp(pos.x, -HW + TILE * 1.2, HW - TILE * 1.2);
  pos.z = clamp(pos.z, -HH + TILE * 1.2, HH - TILE * 1.2);
}

const gridAt = (x, z) => {
  const c = Math.floor((x + HW) / TILE), r = Math.floor((z + HH) / TILE);
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return W;
  return grid[r][c];
};
function hasLineOfSight(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / 0.7);
  for (let i = 1; i < steps; i++) {
    if (gridAt(from.x + dx * i / steps, from.z + dz * i / steps) === W) return false;
  }
  return true;
}

/* ------------------ ساخت مپ با InstancedMesh (سبک) ------------------ */
// یک مدل GLB را به یک هندسه‌ی نرمال‌شده (مرکز XZ، کف y=0) تبدیل می‌کند
function normalizedGeometry(gltf, target, mode = 'footprint') {
  let mesh = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const size = bb.getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(size.x, size.z) : Math.max(size.x, size.y, size.z);
  const k = target / (dim || 1);
  const cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2, by = bb.min.y;
  // مقیاس + مرکز کردن + کف روی صفر
  geo.translate(-cx, -by, -cz);
  geo.scale(k, k, k);
  geo.computeBoundingBox();
  return { geo, mat: mesh.material, height: geo.boundingBox.max.y };
}

function instancedFrom(gltf, placements, target, mode = 'footprint') {
  const { geo, mat } = normalizedGeometry(gltf, target, mode);
  const im = new THREE.InstancedMesh(geo, mat, placements.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  placements.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot || 0);
    m.compose(new THREE.Vector3(p.x, p.y || 0, p.z), q, s);
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = true; im.receiveShadow = true;
  scene.add(im);
  return im;
}

async function buildShell() {
  const floorA = [], floorB = [], wallA = [], wallB = [], wallTall = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, z } = world(c, r);
      if (grid[r][c] === F) {
        (Math.random() < 0.22 ? floorB : floorA).push({ x, z, rot: 0 });
      } else {
        if (Math.random() < 0.18) wallTall.push({ x, z, rot: 0 });
        else (Math.random() < 0.3 ? wallB : wallA).push({ x, z, rot: 0 });
        WALL_SEGS.push({ x, z });
      }
    }
  }
  const load = n => loader.loadAsync(`/models/office/${n}.glb`);
  const [fA, fB, wA, wB, wT] = await Promise.all([
    load('FloorTile_Basic'), load('FloorTile_Basic2'), load('Wall_1'), load('Wall_2'), load('Wall_4'),
  ]);
  instancedFrom(fA, floorA, TILE);
  instancedFrom(fB, floorB, TILE);
  instancedFrom(wA, wallA, TILE);
  instancedFrom(wB, wallB, TILE);
  instancedFrom(wT, wallTall, TILE);
}

/* -------------------------- مبلمان شرکت -------------------------- */
// flat = روی زمین (فرش/کابل)، ceiling = آویزان از سقف
const FURNITURE = [
  // دفتر مدیریت (بالا-چپ)
  { n: 'Couch_Large1', x: -23, z: -16, r: 0, s: 2.6, mode: 'footprint' },
  { n: 'TV_1', x: -23, z: -19.3, r: 0, s: 2.4, mode: 'footprint', onWall: true },
  { n: 'Table_RoundLarge', x: -23, z: -12.6, r: 0, s: 2.4, mode: 'footprint' },
  { n: 'Chair_1', x: -24.4, z: -11.8, r: 0.6, s: 0.95 },
  { n: 'Chair_3', x: -21.6, z: -11.8, r: -0.6, s: 0.95 },
  { n: 'Bookshelf', x: -27.4, z: -14, r: Math.PI / 2, s: 2.3 },
  { n: 'Houseplant_1', x: -26.6, z: -18, r: 0, s: 1.3 },
  { n: 'Carpet_1', x: -23, z: -14.6, r: 0, s: 3.6, mode: 'footprint', flat: true },
  { n: 'Computer', x: -23, z: -12.6, r: 0.4, s: 0.9 },
  { n: 'Drawer_1', x: -27.2, z: -10.6, r: Math.PI / 2, s: 1.0 },
  // اتاق جلسات (بالا-وسط)
  { n: 'Table_RoundLarge', x: 0, z: -16, r: Math.PI / 2, s: 3.4, mode: 'footprint' },
  { n: 'Chair_2', x: -2.4, z: -16.8, r: 1.2, s: 0.95 },
  { n: 'Chair_2', x: 2.4, z: -16.8, r: -1.2, s: 0.95 },
  { n: 'Chair_4', x: -2.4, z: -15.2, r: 1.8, s: 0.95 },
  { n: 'Chair_4', x: 2.4, z: -15.2, r: -1.8, s: 0.95 },
  { n: 'Computer_Large', x: 0, z: -19.2, r: 0, s: 2.0 },
  { n: 'Collectible_Board', x: 0, z: -19.3, r: 0, s: 2.8, mode: 'footprint', onWall: true, wallOffset: 0.6 },
  { n: 'Houseplant_3', x: -7.4, z: -15, r: 0, s: 1.3 },
  { n: 'Houseplant_5', x: 7.4, z: -15, r: 0, s: 1.3 },
  // اتاق سرور (بالا-راست)
  { n: 'Props_Shelf_Tall', x: 20.5, z: -17, r: 0, s: 2.5 },
  { n: 'Props_Shelf_Tall', x: 23.2, z: -17, r: 0, s: 2.5 },
  { n: 'Props_Vessel_Tall', x: 20.4, z: -12.4, r: 0, s: 2.4 },
  { n: 'Props_Computer', x: 24.6, z: -12.4, r: -0.5, s: 1.1 },
  { n: 'Props_Crate', x: 17.5, z: -12.4, r: 0.3, s: 1.3 },
  { n: 'Props_Pod', x: 26.4, z: -19.4, r: 0, s: 2.0 },
  { n: 'Cable_Long', x: 23, z: -9.8, r: 0, s: 3.4, mode: 'footprint', flat: true },
  { n: 'Props_ContainerFull', x: 27.6, z: -15, r: 0, s: 2.0 },
  // فضای باز کارمندان (وسط)
  { n: 'Computer_Large', x: -8, z: 2.4, r: 0, s: 1.8 },
  { n: 'Computer_Large', x: -4.4, z: 2.4, r: 0, s: 1.8 },
  { n: 'Computer_Large', x: -0.8, z: 2.4, r: 0, s: 1.8 },
  { n: 'Computer_Large', x: 2.8, z: 2.4, r: 0, s: 1.8 },
  { n: 'Chair_1', x: -8, z: 0.6, r: Math.PI, s: 0.95 },
  { n: 'Chair_1', x: -4.4, z: 0.6, r: Math.PI, s: 0.95 },
  { n: 'Chair_1', x: -0.8, z: 0.6, r: Math.PI, s: 0.95 },
  { n: 'Chair_1', x: 2.8, z: 0.6, r: Math.PI, s: 0.95 },
  { n: 'Shelf_Large', x: 9.4, z: 3.6, r: 0, s: 2.4 },
  { n: 'Couch_Medium1', x: -8, z: 7.4, r: Math.PI, s: 2.2, mode: 'footprint' },
  { n: 'Carpet_2', x: -5, z: 6, r: 0, s: 4.0, mode: 'footprint', flat: true },
  // آزمایشگاه (پایین-چپ)
  { n: 'Props_Teleporter_1', x: -22, z: 16, r: 0, s: 2.8 },
  { n: 'Props_Capsule', x: -26.4, z: 16, r: 0, s: 2.2 },
  { n: 'Props_ComputerSmall', x: -18.6, z: 18.6, r: 1.1, s: 0.95 },
  { n: 'Props_Vessel', x: -25.4, z: 20, r: 0, s: 1.2 },
  { n: 'Props_Laser', x: -19.2, z: 13.6, r: 0, s: 2.0 },
  // اتاق امنیت (پایین-وسط)
  { n: 'Computer_Large', x: 0, z: 17, r: 0, s: 2.2 },
  { n: 'Chair_2', x: 0, z: 19.4, r: Math.PI, s: 0.95 },
  { n: 'Props_Chest', x: 3.4, z: 19.6, r: 0.4, s: 0.95 },
  { n: 'TV_2', x: -3.6, z: 19.8, r: 0, s: 2.0, onWall: true },
  // بایگانی (پایین-راست)
  { n: 'Bookshelf', x: 20, z: 19, r: Math.PI, s: 2.3 },
  { n: 'Bookshelf', x: 22.8, z: 19, r: Math.PI, s: 2.3 },
  { n: 'Shelf_2', x: 26.4, z: 16, r: Math.PI / 2, s: 2.1 },
  { n: 'Props_CrateLong', x: 25.4, z: 20.4, r: 0, s: 2.2, mode: 'footprint' },
  { n: 'Trashcan_Green', x: 19, z: 14.6, r: 0, s: 1.1 },
  { n: 'Props_Shelf', x: 27.4, z: 13.6, r: -Math.PI / 2, s: 2.0 },
  // راهروها
  { n: 'Kitchen_Fridge', x: -29.4, z: 0.4, r: Math.PI / 2, s: 2.1 },
  { n: 'Kitchen_Cabinet1', x: -29.4, z: 4.4, r: Math.PI / 2, s: 2.0 },
  { n: 'Kitchen_Oven', x: 29.4, z: -3.6, r: -Math.PI / 2, s: 2.0 },
  { n: 'Props_ContainerFull', x: 29.4, z: 2.4, r: -Math.PI / 2, s: 2.1 },
  { n: 'Trashcan_Cylindric', x: -14, z: -7.4, r: 0, s: 1.1 },
  { n: 'Houseplant_1', x: 11, z: -6.4, r: 0, s: 1.3 },
  { n: 'Houseplant_3', x: -11, z: 8.4, r: 0, s: 1.3 },
  { n: 'Houseplant_5', x: 16, z: 8.4, r: 0, s: 1.3 },
  { n: 'Light_Ceiling1', x: -18, z: -14, r: 0, s: 1.0, ceiling: 4.0 },
  { n: 'Light_Ceiling1', x: 0, z: -13, r: 0, s: 1.0, ceiling: 4.0 },
  { n: 'Light_Ceiling1', x: 18, z: -13, r: 0, s: 1.0, ceiling: 4.0 },
  { n: 'Light_Ceiling1', x: -18, z: 16, r: 0, s: 1.0, ceiling: 4.0 },
  { n: 'Light_Ceiling1', x: 0, z: 16, r: 0, s: 1.0, ceiling: 4.0 },
  { n: 'Light_Ceiling1', x: 18, z: 16, r: 0, s: 1.0, ceiling: 4.0 },
  { n: 'Light_Ceiling1', x: 0, z: 0, r: 0, s: 1.0, ceiling: 4.0 },
];

async function buildFurniture() {
  await Promise.all(FURNITURE.map(async f => {
    try {
      const m = await loadProp('office', f.n, f.s, f.mode || 'height');
      m.rotation.y = f.r || 0;
      m.position.set(f.x, 0, f.z);
      if (f.flat) m.position.y = FLOOR_Y + 0.015;
      else if (f.ceiling) m.position.y = f.ceiling;
      else m.position.y += m.userData.baseY + FLOOR_Y;
      if (f.onWall) m.position.y = f.wallOffset || 0.5;
      scene.add(m);
      if (!f.flat && !f.ceiling) PROP_COLLIDERS.push({ x: f.x, z: f.z, r: f.s * 0.28 });
    } catch (e) { console.warn('furniture', f.n, e); }
  }));
}

/* ---------------------- نورها (بودجه محدود) ---------------------- */
const flashPool = [];
for (let i = 0; i < 3; i++) {
  const l = new THREE.PointLight(0xffc07a, 0, 12, 2);
  l.position.set(0, 2, 0); scene.add(l);
  flashPool.push({ l, life: 0, max: 0, peak: 0 });
}
let flashIdx = 0;
function popLight(pos, peak = 16, life = 0.09, color = 0xffc07a) {
  const f = flashPool[flashIdx++ % flashPool.length];
  f.l.position.copy(pos); f.l.color.setHex(color);
  f.peak = peak; f.life = life; f.max = life;
}
const emergency = new THREE.PointLight(0xff2b2b, 0, 34, 2);
emergency.position.set(0, 5, 0); scene.add(emergency);

// چراغ‌های اضطراری باتری‌خور: خیلی کم‌سو و کوچک، فقط برای جهت‌یابی در راهروها
const EMERGENCY_LAMPS = [
  [-22, -14], [0, -16], [22, -15], [-20, 16], [0, 17], [21, 16], [-10, 0], [12, 0],
];
for (const [x, z] of EMERGENCY_LAMPS) {
  const l = new THREE.PointLight(0xd8452f, 2.6, 7, 1.6);
  l.position.set(x, 3.2, z);
  scene.add(l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a5a }));
  bulb.position.set(x, 3.4, z);
  scene.add(bulb);
}

/* --------------------------- بازیکن --------------------------- */
const player = {
  hp: 100, maxHp: 100, armor: 100, maxArmor: 100,
  weapon: 'AR_1', mag: 30, cd: 0, reload: 0,
  ammo: { grenade: 3, smoke: 3 }, abilityCd: { grenade: 0, smoke: 0 },
  alive: true, kills: 0, speed: 5.3,
};
const playerG = new THREE.Group();
scene.add(playerG);
let playerModel = null;
let aimAngle = 0;

/* -------- چراغ‌قوه‌ی سوار بر اسلحه --------
   مخروط نور دقیقاً جلوی دهانه اسلحه را روشن می‌کند.
   با کلیک راست (یا کلید E) روشن/خاموش می‌شود. */
const lightState = { on: true, battery: 100 };

function buildWeaponLight(parent) {
  const spot = new THREE.SpotLight(0xfff0c8, 0, 32, 0.34, 0.42, 0.8);
  spot.position.set(0, 0, 0);
  spot.target.position.set(0, 0, 14);
  spot.castShadow = false;
  parent.add(spot, spot.target);
  // هاله‌ی کوچک اطراف دهانه که فقط نزدیک را نشان می‌دهد
  const halo = new THREE.PointLight(0xffe6b0, 0, 3.5, 1.9);
  halo.position.set(0, 0.1, 0.5);
  parent.add(halo);
  return { spot, halo, target: spot.target };
}

// نور روی دسته اسلحه بازیکن نصب می‌شود
const weaponLightGroup = new THREE.Group();
playerG.add(weaponLightGroup);
const wLight = buildWeaponLight(weaponLightGroup);
wLight.spot.angle = 0.30;
wLight.spot.penumbra = 0.35;
wLight.spot.distance = 26;
wLight.spot.intensity = 0;
wLight.target.position.set(0, 0, 16);

// یک نور ضعیف و خیلی نزدیک به خود بازیکن تا در تاریکی مطلق گم نشود
const selfGlow = new THREE.PointLight(0xb8d2f5, 4.5, 6.5, 1.6);
selfGlow.position.set(0, 1.1, 0);
playerG.add(selfGlow);

function setFlashlight(on) {
  lightState.on = on;
  if (on) beep(1200, 0.04, 'square', 0.02); else beep(500, 0.05, 'square', 0.02);
  updateHUD();
}
function toggleFlashlight() {
  setFlashlight(!lightState.on);
  toast(lightState.on ? '🔦 چراغ‌قوه روشن' : '🔦 چراغ‌قوه خاموش — تاریک شد');
}

// آیا نقطه‌ی p داخل مخروط نور چراغ‌قوه‌ی صاحبش است؟
function inCone(owner, p, halfAngle, range) {
  const g = owner.g;
  const dx = p.x - g.position.x, dz = p.z - g.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  const fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y));
  const cos = (dx * fwd.x + dz * fwd.z) / (dist || 1);
  return cos >= Math.cos(halfAngle);
}
// نور چراغ‌قوه‌ی بازیکن روشن است و نقطه در مخروطش قرار دارد؟
function litByPlayer(p) {
  return player.alive && lightState.on && inCone(playerActor, p, 0.30, 24);
}
// آیا کاراکتر ai (که چراغ‌قوه‌اش روشن است) نقطه‌ی p را می‌بیند؟
function litByAi(a, p) {
  return a.alive && inCone(a, p, 0.30, 16);
}

function tintCharacter(model, team) {
  const base = team === 'swat' ? new THREE.Color(0x1b4c8f) : new THREE.Color(0x8c2418);
  model.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      o.material.emissive = base.clone().multiplyScalar(0.5);
      o.material.emissiveIntensity = team === 'swat' ? 0.5 : 0.65;
    }
  });
}

function findBone(root, names) {
  let found = null;
  root.traverse(o => { if (!found && o.isBone && names.includes(o.name)) found = o; });
  return found;
}

const weaponDef = name => WEAPONS[name] || WEAPONS.AR_1;
const gunPath = name => {
  const d = weaponDef(name);
  return `/models/${d.cat}/${d.model}.glb`;
};

async function attachGun(charRoot, gunName, offset) {
  const d = weaponDef(gunName);
  const hand = findBone(charRoot, ['HandR', 'PalmR', 'Hand_R']);
  const off = offset || new THREE.Vector3(d.kind === 'pistol' ? 0.02 : 0.05, d.kind === 'melee' ? -0.02 : -0.1, 0.06);
  try {
    const gun = await loadProp(d.cat, d.model, d.kind === 'melee' ? 0.62 : d.kind === 'pistol' ? 0.55 : 1.05,
      d.kind === 'melee' ? 'length' : 'length');
    // جهت‌دهی لوله به سمت جلو (محور +Z کاراکتر) و کمی مایل به پایین
    gun.rotation.set(0, Math.PI / 2, 0);
    if (d.kind === 'melee') gun.rotation.set(Math.PI / 2, 0, Math.PI);
    gun.position.copy(off);
    const holder = new THREE.Group();
    holder.name = 'gunHolder';
    holder.add(gun);
    if (hand) hand.add(holder);
    else { holder.position.set(0.45, 1.15, 0.35); charRoot.add(holder); }
    holder.userData.gun = gun;
    return holder;
  } catch { return null; }
}

let playerGunHolder = null;
async function buildPlayer() {
  playerModel = await loadCharacter('Swat', 1.8);
  tintCharacter(playerModel, 'swat');
  playerModel.position.y = 0;
  playerG.add(playerModel);
  await equipWeapon(PLAYER_LOADOUT[0]);
  return playerModel;
}

// تعویض سلاح بازیکن + نصب چراغ‌قوه روی همان اسلحه
async function equipWeapon(name) {
  const d = weaponDef(name);
  player.weapon = name;
  player.mag = d.mag === Infinity ? Infinity : d.mag;
  player.reload = 0;
  player.cd = 0;
  // اسلحه قبلی را از دست بردار
  if (playerGunHolder) {
    playerGunHolder.parent?.remove(playerGunHolder);
    playerGunHolder = null;
  }
  playerGunHolder = await attachGun(playerModel, name);

  // مهم: چراغ‌قوه به «بدنه بازیکن» بسته می‌شود، نه به استخوان دست.
  // دست در انیمیشن می‌چرخد؛ اگر نور به آن بسته شود، پرتو به هر طرف می‌رود.
  // بدنه بازیکن همیشه با aimAngle می‌چرخد، پس نور دقیقاً جلوی اسلحه می‌ماند.
  if (weaponLightGroup.parent !== playerG) playerG.add(weaponLightGroup);
  const isPistol = d.kind === 'pistol' || d.kind === 'melee';
  // نور از شانه/دست به سمت جلو می‌تابد (ارتفاع کاراکتر ۱.۸ متر)
  weaponLightGroup.position.set(isPistol ? 0.22 : 0.34, 1.45, 0.5);
  weaponLightGroup.rotation.set(0, 0, 0);
  wLight.spot.position.set(0, 0, 0);
  wLight.spot.target.position.set(0, -1.15, 14);
  wLight.halo.position.set(0, 0, 0.55);
  toast(`🔫 ${d.fa} برداشته شد`);
  updateHUD();
  return d;
}

/* ----------------------------- AI ----------------------------- */
const actors = [];
const STAT = { swat: { total: 5, alive: 5, kills: 0 }, terror: { total: 5, alive: 5, kills: 0 } };
let playerActor = null, playerTag = null;

function makeTag(name, team) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(1.5, 0.375, 1);
  sp.userData = { ctx, tex, name, team };
  drawTag(sp, 1);
  return sp;
}
// برچسب فقط وقتی دیده می‌شود که آن کاراکتر در معرض نور باشد
let lastTagUpdate = 0;
function updateTagVisibility(t) {
  if (t - lastTagUpdate < 0.12) return;
  lastTagUpdate = t;
  for (const a of actors) {
    if (!a.alive || !a.tag) continue;
    if (a.isPlayer) { a.tag.visible = false; continue; }
    const visible = litByPlayer(a.g.position) || flatDist(a.g.position, playerG.position) < 2.4;
    a.tag.visible = visible;
    const ratio = Math.max(0, a.hp / a.maxHp);
    if (visible && (a.lastRatio === undefined || Math.abs(a.lastRatio - ratio) > 0.01)) {
      drawTag(a.tag, ratio);
      a.lastRatio = ratio;
    }
  }
}

function drawTag(sp, ratio) {
  const { ctx, tex, name, team } = sp.userData;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(3,7,12,.75)'; ctx.fillRect(0, 6, 256, 52);
  ctx.fillStyle = team === 'swat' ? '#4aa8ff' : '#ff5a3c'; ctx.fillRect(0, 6, 8, 52);
  ctx.font = 'bold 23px Tahoma'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
  ctx.fillText(name, 246, 30);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(14, 40, 224, 9);
  ctx.fillStyle = ratio > 0.5 ? '#3ddc63' : ratio > 0.25 ? '#ffb020' : '#ff3b30';
  ctx.fillRect(238 - 224 * ratio, 40, 224 * ratio, 9);
  tex.needsUpdate = true;
}

async function spawnActor(def, team, pos) {
  const g = new THREE.Group();
  g.position.set(pos.x, FLOOR_Y, pos.z);
  g.rotation.y = team === 'swat' ? 0 : Math.PI;
  scene.add(g);
  const model = await loadCharacter(def.model, 1.8);
  tintCharacter(model, team);
  model.position.y = 0;
  g.add(model);
  await attachGun(model, def.gun);

  const tag = makeTag(def.name, team);
  tag.position.y = 2.3;
  g.add(tag);

  // چراغ‌قوه‌ی هر کاراکتر — فقط مخروط جلوی اسلحه‌اش را روشن می‌کند
  const lit = team === 'swat';
  const aiSpot = new THREE.SpotLight(team === 'swat' ? 0xd6e8ff : 0xffd8c0, lit ? 4.2 : 0, 16, 0.30, 0.4, 1.2);
  aiSpot.position.set(0, 1.15, 0);
  aiSpot.target.position.set(0, 0, 10);
  g.add(aiSpot, aiSpot.target);
  // تروریست‌ها اکثر وقت‌ها در تاریکی هستند

  const a = {
    g, model, tag, team, def, name: def.name, role: def.role,
    hp: def.hp, maxHp: def.hp, alive: true,
    speed: team === 'swat' ? 4.5 : 4.0,
    range: WEAPONS[def.gun].range * 0.8,
    dmg: WEAPONS[def.gun].dmg,
    fireRate: WEAPONS[def.gun].cd * 5.5,
    fireCd: rand(0.4, 1.6), repath: rand(0, 0.3), seed: rand(0, 100),
    target: null, isPlayer: false, aiSpot, lightOn: lit,
  };
  actors.push(a);
  return a;
}

function damageActor(a, dmg, from) {
  if (!a || !a.alive) return;
  if (a.isPlayer) {
    // زره بازیکن بخشی از آسیب را جذب می‌کند
    const absorbed = Math.min(player.armor, dmg * 0.65);
    player.armor -= absorbed;
    player.hp = Math.max(0, player.hp - (dmg - absorbed));
    playerActor.hp = player.hp;
    drawTag(a.tag, player.hp / 100);
    flashDamage();
    if (player.hp <= 0) killActor(a, from);
    return;
  }
  a.hp -= dmg;
  drawTag(a.tag, Math.max(0, a.hp / a.maxHp));
  if (a.hp <= 0) killActor(a, from);
}

function killActor(a, from) {
  if (!a.alive) return;
  a.alive = false;
  playAnim(a.model, ['Death'], 0.1, true);
  a.tag.visible = false;
  a.g.userData.deadAt = performance.now();
  if (a.isPlayer) { player.alive = false; playerG.visible = false; }
  if (a.team === 'swat') STAT.swat.alive = Math.max(0, STAT.swat.alive - 1);
  else STAT.terror.alive = Math.max(0, STAT.terror.alive - 1);
  if (from?.isPlayer) {
    player.kills++;
    STAT.swat.kills++;
    addScore(a.team === 'terror' ? 150 : 0);
    toast(`💀 ${a.name} حذف شد`);
  } else if (from) {
    if (from.team === 'swat') STAT.swat.kills++; else STAT.terror.kills++;
  }
  refreshStatics();
  checkRoundEnd();
}

/* ------------------------- شلیک و گلوله ------------------------- */
const tracerGeo = new THREE.BoxGeometry(0.05, 0.05, 1);
function spawnTracer(from, to, team, width = 0.06) {
  const len = Math.max(0.4, from.distanceTo(to));
  const mesh = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
    color: team === 'swat' ? 0xa9dcff : 0xffc07a, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  mesh.position.copy(from).lerp(to, 0.5);
  mesh.lookAt(to);
  mesh.scale.set(width / 0.05, width / 0.05, len);
  scene.add(mesh);
  effects.push({ mesh, t: 0, life: 0.085, kind: 'tracer' });
  popLight(from, 14, 0.08);
}

const effects = [];
function spawnSpark(pos) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  m.position.copy(pos); scene.add(m);
  effects.push({ mesh: m, t: 0, life: 0.15, kind: 'fade' });
}

// رهگیری: نزدیک‌ترین کاراکتر دشمن یا دیوار
function raycastShot(origin, dir, range, myTeam) {
  let bestT = range, best = null;
  for (const a of actors) {
    if (!a.alive || a.team === myTeam) continue;
    const p = a.g.position.clone(); p.y = origin.y;
    const to = p.clone().sub(origin);
    const proj = to.dot(dir);
    if (proj <= 0 || proj > range) continue;
    const closest = origin.clone().addScaledVector(dir, proj);
    const off = closest.distanceTo(p);
    if (off < 0.75 && proj < bestT && hasLineOfSight(origin, p)) { bestT = proj; best = { actor: a, point: closest }; }
  }
  for (let t = 0.5; t < Math.min(bestT, range); t += 0.5) {
    const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
    if (gridAt(px, pz) === W) return { actor: null, point: new THREE.Vector3(px, origin.y, pz) };
  }
  return best || { actor: null, point: origin.clone().addScaledVector(dir, range) };
}

function playerShoot() {
  const w = WEAPONS[player.weapon];
  if (!player.alive || player.cd > 0 || player.reload > 0) return;
  if (w.kind !== 'melee' && player.mag <= 0) { startReload(); return; }
  player.cd = w.cd;
  if (w.kind !== 'melee') player.mag--;
  updateHUD();

  const origin = playerG.position.clone();
  origin.y = 1.18;
  const fwd = new THREE.Vector3(Math.sin(aimAngle), 0, Math.cos(aimAngle));
  const smokePenalty = inSmoke(playerG.position) ? 2.2 : 1;

  if (w.kind === 'melee') {
    // چاقو: ضربه در یک کمان کوتاه جلوی بازیکن
    let hitAny = false;
    for (const a of actors) {
      if (!a.alive || a.team === 'swat') continue;
      const d = flatDist(a.g.position, playerG.position);
      if (d > w.range) continue;
      const ang = Math.atan2(a.g.position.x - playerG.position.x, a.g.position.z - playerG.position.z);
      const diff = Math.abs(((ang - aimAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < 1.15) { damageActor(a, w.dmg, playerActor); hitAny = true; hitmarker(); }
    }
    slashArc(w.range, aimAngle, hitAny);
    beep(hitAny ? 900 : 420, 0.06, 'triangle', 0.03);
    recoil = 0.7;
    return;
  }

  const pellets = w.pellets || 1;
  const spread = w.spread * (joyMoving ? 1.8 : 1) * smokePenalty;
  let anyHit = false;
  for (let i = 0; i < pellets; i++) {
    const ang = aimAngle + rand(-spread, spread);
    const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
    const hit = raycastShot(origin, dir, w.range, 'swat');
    spawnTracer(origin, hit.point, 'swat', w.kind === 'shotgun' ? 0.05 : w.kind === 'pistol' ? 0.07 : 0.06);
    if (hit.actor) {
      const falloff = w.kind === 'shotgun' ? clamp(1.15 - flatDist(origin, hit.point) / w.range, 0.25, 1) : 1;
      damageActor(hit.actor, w.dmg * falloff * rand(0.85, 1.15), playerActor);
      spawnSpark(hit.point);
      anyHit = true;
    } else spawnSpark(hit.point);
  }
  if (anyHit) hitmarker();
  beep(w.kind === 'shotgun' ? 110 : w.kind === 'pistol' ? 260 : 620, w.kind === 'shotgun' ? 0.16 : 0.05, 'square', w.kind === 'shotgun' ? 0.06 : 0.03);
  popLight(origin.clone().addScaledVector(fwd, 0.7), w.kind === 'shotgun' ? 26 : 14, 0.08);
  recoil = w.kind === 'shotgun' ? 1.4 : 0.55;
  if (w.scope) startReload(true);
  if (w.kind === 'shotgun') shake = Math.max(shake, 0.12);
}

// کمان ضربه چاقو
function slashArc(range, angle, hit) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.5, range, 18, 1, 0, Math.PI * 0.85),
    new THREE.MeshBasicMaterial({ color: hit ? 0xffd0c0 : 0xbcd6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -angle + Math.PI * 0.42;
  m.position.set(playerG.position.x, 0.35, playerG.position.z);
  scene.add(m);
  effects.push({ mesh: m, t: 0, life: 0.18, kind: 'fade' });
}

function startReload(quick = false) {
  const w = WEAPONS[player.weapon];
  if (w.kind === 'melee' || player.reload > 0 || player.mag === w.mag) return;
  player.reload = quick ? Math.min(0.8, w.reloadTime) : (w.reloadTime || 1.4);
  toast('🔄 خشاب عوض می‌شود…');
  beep(260, 0.1, 'sine', 0.02);
}

function updateAI(a, dt) {
  if (!a.alive) return;
  a.fireCd -= dt;
  a.repath -= dt;

  if (a.repath <= 0) {
    a.repath = 0.35;
    let best = null, bestD = Infinity, visible = null, visD = Infinity;
    for (const e of actors) {
      if (!e.alive || e.team === a.team) continue;
      const d = flatDist(a.g.position, e.g.position);
      if (d < bestD) { bestD = d; best = e; }
      // دید در تاریکی: یا خودم با چراغ‌قوه او را روشن کرده‌ام،
      // یا او چراغ‌قوه‌اش روشن است و مرا روشن می‌کند،
      // یا در فاصله‌ی خیلی نزدیک (شنیدن صدای نفس!) هستیم.
      const spotted = hasLineOfSight(a.g.position, e.g.position) &&
        (litByAi(a, e.g.position) || (e.isPlayer && litByPlayer(a.g.position)) || d < 2.6);
      if (d < visD && spotted) { visD = d; visible = e; }
    }
    // اگر کسی دیده نشود، تنها جهت تقریبی آخرین هدف را نگه می‌داریم
    a.target = visible || null;
    a.lastKnown = best || null;
  }
  if (!a.target) {
    // در تاریکی سرگردان می‌شود (بدون دید واقعی)
    playAnim(a.model, ['Idle_Neutral', 'Idle'], 0.2);
    if (a.wanderCd === undefined) a.wanderCd = rand(0.5, 2);
    a.wanderCd -= dt;
    if (a.wanderCd <= 0) {
      a.wanderCd = rand(2.5, 5);
      a.wanderDir = rand(-Math.PI, Math.PI);
    }
    if (a.wanderDir !== undefined) {
      const step = a.speed * 0.45 * dt;
      a.g.position.x += Math.sin(a.wanderDir) * step;
      a.g.position.z += Math.cos(a.wanderDir) * step;
      a.g.rotation.y = a.wanderDir;
      const before = a.g.position.clone();
      resolveCollision(a.g.position, 0.55);
      if (a.g.position.distanceTo(before) < step * 0.3) a.wanderDir = rand(-Math.PI, Math.PI);
      playAnim(a.model, ['Walk'], 0.2);
    }
    return;
  }

  const t = a.target.g.position;
  const d = flatDist(a.g.position, t);
  a.g.rotation.y = Math.atan2(t.x - a.g.position.x, t.z - a.g.position.z);

  const seen = true;   // target فقط وقتی ست می‌شود که دیده شده باشد
  // در تاریکی مطلق اگر هدف چراغ‌قوه‌اش را خاموش کند، دیگر دیده نمی‌شود
  a.spotTimer = (a.spotTimer || 0) - dt;
  const want = a.role === 'تک‌تیرانداز' ? 15 : a.role === 'پشتیبان' ? 9 : 6;
  let moving = false;
  if (!seen || d > want) {
    const strafe = Math.sin(performance.now() * 0.0011 + a.seed) * 0.7;
    const ang = a.g.rotation.y + strafe;
    const step = Math.min(a.speed * dt, Math.max(0, d - want + 0.5));
    const before = a.g.position.clone();
    a.g.position.x += Math.sin(ang) * step;
    a.g.position.z += Math.cos(ang) * step;
    resolveCollision(a.g.position, 0.55);
    if (a.g.position.distanceTo(before) < step * 0.2) { // دور زدن مانع
      a.g.position.x += Math.cos(ang) * step * 1.5;
      a.g.position.z += -Math.sin(ang) * step * 1.5;
      resolveCollision(a.g.position, 0.55);
    }
    moving = true;
  } else if (d < want * 0.55) {
    const ang = a.g.rotation.y + Math.PI;
    a.g.position.x += Math.sin(ang) * a.speed * 0.7 * dt;
    a.g.position.z += Math.cos(ang) * a.speed * 0.7 * dt;
    resolveCollision(a.g.position, 0.55);
    moving = true;
  }
  playAnim(a.model, moving ? ['Run', 'Walk'] : ['Idle_Gun_Pointing', 'Idle_Neutral', 'Idle'], 0.16);

  if (seen && d < a.range && a.fireCd <= 0) {
    a.fireCd = a.fireRate * rand(0.8, 1.3);
    const origin = a.g.position.clone();
    origin.x += Math.sin(a.g.rotation.y) * 0.55;
    origin.z += Math.cos(a.g.rotation.y) * 0.55;
    origin.y = 1.2;
    const target = t.clone(); target.y = 1.15;
    // دقت: فاصله، دود و حرکت
    let hitChance = clamp(1.1 - d / (a.range * 1.6), 0.15, 0.8);
    if (moving) hitChance *= 0.7;
    if (inSmoke(a.g.position) || inSmoke(t)) hitChance *= 0.42;
    const miss = target.clone().add(new THREE.Vector3(rand(-2.6, 2.6), rand(-0.4, 1.6), rand(-2.6, 2.6)));
    spawnTracer(origin, Math.random() < hitChance ? target : miss, a.team, 0.05);
    if (Math.random() < hitChance) damageActor(a.target, a.dmg * rand(0.8, 1.2), a);
    playAnim(a.model, ['Run_Shoot', 'Idle_Gun_Shoot', 'Gun_Shoot', 'Attack'], 0.06);
    beep(rand(420, 680), 0.035, 'square', 0.012);
  }
}

/* --------------------------- نارنجک / دود --------------------------- */
const grenades = [], smokes = [];

async function throwGrenade(kind) {
  if (!player.alive) return;
  if (player.ammo[kind] <= 0) { toast(kind === 'smoke' ? '💨 دودزایی نداری' : '💣 نارنجکی نداری'); return; }
  if (player.abilityCd[kind] > 0) { toast('⏳ هنوز آماده نیست'); return; }
  player.ammo[kind]--;
  player.abilityCd[kind] = ABILITY_CD[kind];
  updateHUD();

  const g = new THREE.Group();
  try {
    const m = await loadProp('guns', kind === 'smoke' ? 'Grenade_2' : 'Grenade_1', 0.3, 'length');
    g.add(m);
  } catch {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0x4a5a3a })));
  }
  g.position.copy(playerG.position); g.position.y = 1.2;
  scene.add(g);

  const dir = new THREE.Vector3(Math.sin(aimAngle), 0, Math.cos(aimAngle));
  const to = playerG.position.clone().addScaledVector(dir, 10);
  to.x = clamp(to.x, -HW + 2, HW - 2);
  to.z = clamp(to.z, -HH + 2, HH - 2);
  grenades.push({ g, from: g.position.clone(), to, t: 0, dur: 0.8, kind });
  beep(220, 0.1, 'triangle', 0.03);
}

function explode(pos, radius, dmg, ownerTeam) {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb44a, transparent: true, opacity: 0.75, depthWrite: false })
  );
  sphere.position.copy(pos); sphere.position.y = 1;
  scene.add(sphere);
  effects.push({ mesh: sphere, t: 0, life: 0.55, kind: 'boom', radius });

  for (let i = 0; i < 16; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffcf6a : 0xff7a3a }));
    p.position.copy(pos); p.position.y = 1;
    scene.add(p);
    effects.push({ mesh: p, t: 0, life: 0.7, kind: 'debris', vel: new THREE.Vector3(rand(-8, 8), rand(4, 11), rand(-8, 8)) });
  }
  popLight(pos.clone().setY(1.5), 60, 0.4, 0xffa040);
  for (const a of actors) {
    if (!a.alive) continue;
    const d = flatDist(a.g.position, pos);
    if (d < radius) {
      const friendly = a.team === ownerTeam ? 0.3 : 1;   // آسیب به هم‌تیمی کم‌تر
      const dmg2 = dmg * (1 - d / radius) * friendly;
      damageActor(a, dmg2, ownerTeam === 'swat' ? playerActor : null);
    }
  }
  beep(70, 0.42, 'sawtooth', 0.1);
  shake = Math.max(shake, 0.55);
}

function spawnSmoke(pos, radius = 4.4, duration = 16) {
  const group = new THREE.Group();
  group.position.copy(pos);
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(rand(1.0, 2.0), 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xd2d9e2, transparent: true, opacity: 0, depthWrite: false })
    );
    m.position.set(rand(-radius * 0.55, radius * 0.55), rand(0.4, 2.6), rand(-radius * 0.55, radius * 0.55));
    group.add(m); puffs.push(m);
  }
  scene.add(group);
  smokes.push({ group, puffs, radius, life: duration, max: duration });
  beep(140, 0.35, 'sine', 0.05);
}
const inSmoke = pos => smokes.some(s => flatDist(s.group.position, pos) < s.radius);

/* --------------------------- افکت‌ها --------------------------- */
let shake = 0, recoil = 0;
function updateEffects(dt) {
  for (const f of [...effects]) {
    f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'tracer') {
      f.mesh.material.opacity = Math.max(0, 1 - k);
    } else if (f.kind === 'boom') {
      f.mesh.scale.setScalar(0.4 + k * f.radius * 1.05);
      f.mesh.material.opacity = 0.75 * (1 - k);
    } else if (f.kind === 'debris') {
      f.vel.y -= 20 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      if (f.mesh.position.y < 0.12) { f.mesh.position.y = 0.12; f.vel.y = Math.abs(f.vel.y) * 0.4; f.vel.x *= 0.6; f.vel.z *= 0.6; }
      f.mesh.rotation.x += dt * 10; f.mesh.rotation.y += dt * 8;
    } else {
      f.mesh.material.opacity = Math.max(0, 1 - k);
      f.mesh.scale.multiplyScalar(1 + dt * 1.2);
    }
    if (k >= 1) { scene.remove(f.mesh); effects.splice(effects.indexOf(f), 1); }
  }

  for (const s of [...smokes]) {
    s.life -= dt;
    const age = s.max - s.life;
    const rise = Math.min(1, age / 1.1);
    const fade = s.life < 2.5 ? Math.max(0, s.life / 2.5) : 1;
    for (const p of s.puffs) {
      p.material.opacity = 0.58 * rise * fade;
      p.position.y += dt * 0.22;
      p.scale.setScalar(1 + age * 0.04);
    }
    if (s.life <= 0) { scene.remove(s.group); smokes.splice(smokes.indexOf(s), 1); }
  }

  for (const gr of [...grenades]) {
    gr.t += dt / gr.dur;
    const k = Math.min(1, gr.t);
    gr.g.position.lerpVectors(gr.from, gr.to, k);
    gr.g.position.y = 1.2 + Math.sin(k * Math.PI) * 2.4;
    gr.g.rotation.x += dt * 9; gr.g.rotation.z += dt * 7;
    if (k >= 1) {
      scene.remove(gr.g);
      grenades.splice(grenades.indexOf(gr), 1);
      const p = gr.g.position.clone(); p.y = 0;
      if (gr.kind === 'smoke') spawnSmoke(p);
      else explode(p, 7, 110, 'swat');
    }
  }

  for (const f of flashPool) {
    if (f.life > 0) {
      f.life -= dt;
      f.l.intensity = Math.max(0, f.peak * (f.life / f.max));
    } else f.l.intensity = 0;
  }
}

/* ----------------------------- ورودی ----------------------------- */
const keys = {};
// اطمینان از اینکه صفحه فوکوس دارد تا کلیدها از دست نروند
renderer.domElement.tabIndex = 0;
renderer.domElement.addEventListener('pointerdown', () => renderer.domElement.focus());
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
let mouseX = innerWidth / 2, mouseY = innerHeight / 2, mouseDown = false;
let joyVec = { x: 0, y: 0 }, joyFire = false, joyMoving = false;
let camZoom = 25;
let camShakeX = 0;
const camTarget0 = new THREE.Vector3();

const CODE_FALLBACK = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', r: 'KeyR', q: 'KeyQ', f: 'KeyF', e: 'KeyE',
  '1': 'Digit1', '2': 'Digit2', '3': 'Digit3', '۱': 'Digit1', '۲': 'Digit2', '۳': 'Digit3',
  'ArrowUp': 'ArrowUp', 'ArrowDown': 'ArrowDown', 'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight',
  Tab: 'Tab', Escape: 'Escape', ' ': 'Space',
};
addEventListener('keydown', e => {
  // اگر صفحه‌کلید غیرانگلیسی باشد e.code خالی/متفاوت است؛ از e.key هم کمک بگیر
  const code = e.code || CODE_FALLBACK[e.key] || CODE_FALLBACK[e.key?.toLowerCase?.()];
  if (code) keys[code] = true;
  keys[e.code] = true;
  if (code === 'KeyR') startReload();
  if (code === 'KeyQ') throwGrenade('grenade');
  if (code === 'KeyF') throwGrenade('smoke');
  if (code === 'KeyE') toggleFlashlight();
  if (code === 'Digit1') equipWeapon('Shotgun');
  if (code === 'Digit2') equipWeapon('Colt');
  if (code === 'Digit3') equipWeapon('Knife');
  if (code === 'Tab') { e.preventDefault(); toggleBoard(); }
  if (code === 'Escape') closePanels();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
});
addEventListener('keyup', e => {
  const code = e.code || CODE_FALLBACK[e.key] || CODE_FALLBACK[e.key?.toLowerCase?.()];
  if (code) keys[code] = false;
  keys[e.code] = false;
});
addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
renderer.domElement.addEventListener('mousedown', e => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) { e.preventDefault(); toggleFlashlight(); }   // کلیک راست = چراغ‌قوه
});
addEventListener('mouseup', () => mouseDown = false);
addEventListener('contextmenu', e => { if (e.target === renderer.domElement) e.preventDefault(); });
addEventListener('wheel', e => {
  if (galleryOpen) return;
  if (e.shiftKey) {
    // Shift + چرخ = تعویض سلاح
    const i = PLAYER_LOADOUT.indexOf(player.weapon);
    const n = (i + (e.deltaY > 0 ? 1 : -1) + PLAYER_LOADOUT.length) % PLAYER_LOADOUT.length;
    equipWeapon(PLAYER_LOADOUT[n]);
  } else {
    camZoom = clamp(camZoom + e.deltaY * 0.02, 13, 40);
  }
}, { passive: true });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const joy = document.getElementById('joy'), knob = document.getElementById('joyknob');
let joyId = null;
joy.addEventListener('touchstart', e => { joyId = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === joyId) {
    const r = joy.getBoundingClientRect();
    let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy), max = 40;
    if (len > max) { dx *= max / len; dy *= max / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    joyVec = { x: dx / max, y: dy / max };
  }
}, { passive: true });
addEventListener('touchend', e => {
  for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; joyVec = { x: 0, y: 0 }; knob.style.transform = ''; }
});
const fireBtn = document.getElementById('firebtn');
fireBtn.addEventListener('touchstart', e => { joyFire = true; e.preventDefault(); }, { passive: false });
fireBtn.addEventListener('touchend', () => { joyFire = false; });
document.querySelectorAll('.slot').forEach(b => { b.onclick = () => equipWeapon(b.dataset.w); });
document.getElementById('grenbtn').onclick = () => throwGrenade('grenade');
document.getElementById('smokebtn').onclick = () => throwGrenade('smoke');

/* ------------------------------ HUD ------------------------------ */
let score = 0, roundNum = 1, galleryOpen = false;
const faNum = n => Math.round(n).toLocaleString('fa-IR');
const addScore = n => { score = Math.max(0, score + n); document.getElementById('score').textContent = faNum(score); };

function updateHUD() {
  document.getElementById('hpfill').style.width = Math.max(0, player.hp) + '%';
  document.getElementById('hptext').textContent = faNum(Math.max(0, player.hp));
  document.getElementById('armorfill').style.width = Math.max(0, player.armor) + '%';
  document.getElementById('armortext').textContent = faNum(Math.max(0, player.armor));
  const w = WEAPONS[player.weapon];
  const magTxt = w.kind === 'melee' ? '∞' : faNum(player.mag);
  const capTxt = w.mag === Infinity ? '∞' : faNum(w.mag);
  document.getElementById('magtext').textContent = `${magTxt} / ${capTxt}`;
  document.getElementById('torchstate').textContent = lightState.on ? 'روشن' : 'خاموش';
  document.getElementById('torchstate').className = lightState.on ? 'on' : 'off';
  document.querySelectorAll('.slot').forEach(b => b.classList.toggle('active', b.dataset.w === player.weapon));
  document.getElementById('wepname').textContent = WEAPONS[player.weapon].fa;
  document.getElementById('ammoG').textContent = faNum(player.ammo.grenade);
  document.getElementById('ammoS').textContent = faNum(player.ammo.smoke);
  document.getElementById('cdG').style.height = (player.abilityCd.grenade / ABILITY_CD.grenade * 100) + '%';
  document.getElementById('cdS').style.height = (player.abilityCd.smoke / ABILITY_CD.smoke * 100) + '%';
}

function refreshStatics() {
  document.getElementById('aliveS').textContent = faNum(STAT.swat.alive);
  document.getElementById('aliveT').textContent = faNum(STAT.terror.alive);
  const bS = document.getElementById('barS'), bT = document.getElementById('barT');
  if (bS) bS.style.width = (STAT.swat.alive / STAT.swat.total * 100) + '%';
  if (bT) bT.style.width = (STAT.terror.alive / STAT.terror.total * 100) + '%';
  const kS = document.getElementById('killS'), kT = document.getElementById('killT');
  if (kS) kS.textContent = faNum(STAT.swat.kills);
  if (kT) kT.textContent = faNum(STAT.terror.kills);
  const ids = {
    sbAliveS: STAT.swat.alive, sbAliveT: STAT.terror.alive,
    sbKillS: STAT.swat.kills, sbKillT: STAT.terror.kills,
  };
  for (const id in ids) { const el = document.getElementById(id); if (el) el.textContent = faNum(ids[id]); }
}

let dmgT = null;
function flashDamage() {
  const v = document.getElementById('vignette');
  v.style.opacity = '1';
  clearTimeout(dmgT); dmgT = setTimeout(() => v.style.opacity = '0', 180);
}
let hitT = null;
function hitmarker() {
  const h = document.getElementById('hitmark');
  h.style.opacity = '1';
  clearTimeout(hitT); hitT = setTimeout(() => h.style.opacity = '0', 110);
}
let toastT = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.display = 'block';
  clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', 2200);
}
const toggleBoard = () => document.getElementById('scoreboard').classList.toggle('open');

/* --------------------------- نقشه کوچک --------------------------- */
const mmCanvas = document.getElementById('minimap');
const mm = mmCanvas.getContext('2d');
mmCanvas.width = COLS * 9; mmCanvas.height = ROWS * 9;
const CW = mmCanvas.width / COLS, CH = mmCanvas.height / ROWS;

function drawMinimap() {
  mm.fillStyle = '#05090f'; mm.fillRect(0, 0, mmCanvas.width, mmCanvas.height);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      mm.fillStyle = grid[r][c] === W ? '#2a3b52' : '#101a26';
      mm.fillRect(c * CW, r * CH, CW - 0.6, CH - 0.6);
    }
  }
  const px = v => (v.x + HW) / TILE * CW;
  const pz = v => (v.z + HH) / TILE * CH;

  for (const s of smokes) {
    mm.fillStyle = 'rgba(205,214,226,.35)';
    mm.beginPath();
    mm.arc(px(s.group.position), pz(s.group.position), s.radius / TILE * CW, 0, 7);
    mm.fill();
  }
  // در تاریکی، مینی‌مپ فقط چیزهایی را نشان می‌دهد که چراغ‌قوه‌ی بازیکن روشن کرده
  for (const a of actors) {
    if (a.isPlayer || !a.alive) continue;
    const seen = litByPlayer(a.g.position) || flatDist(a.g.position, playerG.position) < 2.6;
    if (!seen) continue;
    mm.fillStyle = a.team === 'swat' ? '#4aa8ff' : '#ff5a3c';
    mm.beginPath(); mm.arc(px(a.g.position), pz(a.g.position), 3.4, 0, 7); mm.fill();
    mm.strokeStyle = 'rgba(255,255,255,.5)'; mm.lineWidth = 1; mm.stroke();
  }
  // مخروط چراغ‌قوه بازیکن
  const cx = px(playerG.position), cy = pz(playerG.position);
  mm.save();
  mm.translate(cx, cy);
  mm.rotate(-aimAngle + Math.PI / 2);
  const grad = mm.createLinearGradient(0, 0, 0, 44);
  grad.addColorStop(0, 'rgba(255,255,205,.4)');
  grad.addColorStop(1, 'rgba(255,255,205,0)');
  mm.fillStyle = grad;
  mm.beginPath(); mm.moveTo(0, 0); mm.arc(0, 0, 44, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42); mm.closePath(); mm.fill();
  mm.restore();
  mm.fillStyle = '#fff';
  mm.beginPath(); mm.arc(cx, cy, 3.6, 0, 7); mm.fill();
}

/* ------------------------- گالری مدل‌ها ------------------------- */
let gModel = null, gAz = 0.7, gPol = 0.9, gDist = 7;
const GPOS = new THREE.Vector3(0, 0, 150);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.9, 0.4, 30),
  new THREE.MeshStandardMaterial({ color: 0x22303f, roughness: 0.7 }));
pedestal.position.set(GPOS.x, 0.2, GPOS.z); pedestal.visible = false; scene.add(pedestal);
const gSpot = new THREE.SpotLight(0xffffff, 120, 30, 0.55, 0.5);
gSpot.position.set(GPOS.x + 5, 8, GPOS.z + 5);
gSpot.visible = false; scene.add(gSpot);

const GALLERY_NAMES = {
  Shotgun_1: 'شاتگان سنگین ۱', Shotgun_2: 'شاتگان سنگین ۲', Shotgun_SawedOff: 'شاتگان کوتاه',
  Shotgun_ShortStock: 'شاتگان دسته‌کوتاه', Revolver_1: 'هفت‌تیر ۱', Revolver_2: 'کلت هفت‌تیر',
  Revolver_3: 'هفت‌تیر فلزی', Knife: 'چاقو', Torch: 'مشعل', AR_1: 'تفنگ AR-1', AR_3: 'تفنگ AR-3',
  AR_5: 'تفنگ AR-5', SMG_1: 'مسلسل SMG-1', SMG_2: 'مسلسل SMG-2', Pistol_1: 'تپانچه ۱',
  Sniper_1: 'تک‌تیرانداز ۱', Sniper_2: 'تک‌تیرانداز ۲', Grenade_1: 'نارنجک', Grenade_2: 'نارنجک دود',
};
const GALLERY = [
  { cat: 'team', title: '🧍 کاراکترهای تیم‌ها', list: ['Swat', 'Worker', 'Suit', 'Casual', 'Punk', 'CyberCharacter', 'Spacesuit', 'Casual2', 'Beach', 'Adventurer'] },
  { cat: 'weapons2', title: '🔫 اسلحه‌های بازیکن (سنگین/کلت/چاقو)', list: ['Shotgun_1', 'Shotgun_2', 'Shotgun_SawedOff', 'Shotgun_ShortStock', 'Revolver_1', 'Revolver_2', 'Revolver_3', 'Pistol_1', 'Pistol_2', 'Knife', 'Torch'] },
  { cat: 'guns', title: '🔫 سلاح‌های تیم‌ها و نارنجک', list: ['AR_1', 'AR_3', 'AR_5', 'SMG_1', 'SMG_2', 'Pistol_1', 'Sniper_1', 'Sniper_2', 'Grenade_1', 'Grenade_2'] },
  { cat: 'office', title: '🏢 ساختمان شرکت', list: ['FloorTile_Basic', 'Wall_1', 'Wall_4', 'DoorSingle_Wall_SideA', 'Door_Double', 'Window_Wall_SideA', 'Column_1', 'Staircase', 'RoofTile_Plate'] },
  { cat: 'office', title: '🪑 تجهیزات و مبلمان', list: ['Couch_Large1', 'Chair_1', 'Table_RoundLarge', 'Bookshelf', 'Props_Shelf_Tall', 'Computer_Large', 'Computer', 'TV_1', 'Kitchen_Fridge', 'Props_Teleporter_1', 'Props_Capsule', 'Props_Pod', 'Props_Laser', 'Houseplant_1', 'Light_Ceiling1', 'Carpet_1'] },
];

function buildGalleryUI() {
  const list = document.getElementById('glist');
  for (const grp of GALLERY) {
    const h = document.createElement('div'); h.className = 'ggroup'; h.textContent = grp.title;
    list.appendChild(h);
    for (const n of grp.list) {
      const b = document.createElement('button');
      b.className = 'gitem';
      b.textContent = WEAPONS[n]?.fa || GALLERY_NAMES[n] || n;
      b.onclick = () => {
        document.querySelectorAll('.gitem').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        showInGallery(grp.cat, n);
      };
      list.appendChild(b);
    }
  }
}
async function showInGallery(cat, name) {
  document.getElementById('gname').textContent = WEAPONS[name]?.fa || GALLERY_NAMES[name] || name;
  if (gModel) { scene.remove(gModel); gModel = null; }
  if (cat === 'team') {
    gModel = await loadCharacter(name, 2.9);
    const idle = findClip(Object.values(gModel.userData.actions).map(a => a.getClip()), ['Idle_Neutral', 'Idle', 'Idle_Gun_Pointing']);
    if (idle) { gModel.userData.actions[idle.name].play(); gModel.userData.current = idle.name; }
    gModel.position.set(GPOS.x, 0.4, GPOS.z);
  } else if (cat === 'guns' || cat === 'weapons2') {
    const d = WEAPONS[name];
    gModel = await loadProp(d ? d.cat : cat, d ? d.model : name, d?.kind === 'melee' ? 2.4 : 3.2, 'length');
    gModel.position.set(GPOS.x, 0.4, GPOS.z);
  } else {
    gModel = await loadProp(cat, name, 2.9, 'height');
    gModel.position.set(GPOS.x, 0.4, GPOS.z);
  }
  scene.add(gModel);
}
function openGallery() {
  galleryOpen = true; closeBoard();
  document.getElementById('gallery').classList.add('open');
  pedestal.visible = true; gSpot.visible = true;
  showInGallery('team', 'Swat');
}
function closeGallery() {
  galleryOpen = false;
  document.getElementById('gallery').classList.remove('open');
  pedestal.visible = false; gSpot.visible = false;
  if (gModel) {
    const mx = gModel.userData?.mixer;
    if (mx) {
      mx.stopAllAction();
      const i = mixers.indexOf(mx);
      if (i >= 0) mixers.splice(i, 1);
    }
    scene.remove(gModel); gModel = null;
  }
}
function closeBoard() { document.getElementById('scoreboard').classList.remove('open'); }
function closePanels() { closeGallery(); closeBoard(); }
document.getElementById('galleryBtn').onclick = openGallery;
document.getElementById('gclose').onclick = closeGallery;
document.getElementById('boardBtn').onclick = () => { closeGallery(); toggleBoard(); };
document.getElementById('boardClose').onclick = toggleBoard;

let gDrag = false, gLast = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', e => {
  if (galleryOpen) { gDrag = true; gLast = { x: e.clientX, y: e.clientY }; }
});
addEventListener('pointermove', e => {
  if (gDrag && galleryOpen) {
    gAz += (e.clientX - gLast.x) * 0.01;
    gPol = clamp(gPol - (e.clientY - gLast.y) * 0.01, 0.12, 1.5);
    gLast = { x: e.clientX, y: e.clientY };
  }
});
addEventListener('pointerup', () => gDrag = false);
addEventListener('wheel', e => { if (galleryOpen) gDist = clamp(gDist + e.deltaY * 0.012, 3.5, 18); }, { passive: true });

/* ----------------------------- صدا ----------------------------- */
let AC = null;
function beep(freq, dur = 0.06, type = 'square', vol = 0.03) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0006, AC.currentTime + dur);
    o.connect(g).connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch { }
}

/* --------------------------- شروع دور --------------------------- */
// اگر نقطه‌ای داخل دیوار بود، نزدیک‌ترین خانه آزاد را برمی‌گرداند
function snapToFree(x, z, used) {
  const c0 = Math.floor((x + HW) / TILE), r0 = Math.floor((z + HH) / TILE);
  for (let rad = 0; rad < 8; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        const c = c0 + dc, r = r0 + dr;
        if (r < 1 || c < 1 || r >= ROWS - 1 || c >= COLS - 1) continue;
        if (grid[r][c] === W) continue;
        if (used && used.has(c + ',' + r)) continue;
        // خانه و همسایه‌هایش باید آزاد باشند تا کاراکتر گیر نکند
        if (grid[r][c + 1] === W || grid[r][c - 1] === W || grid[r + 1][c] === W || grid[r - 1][c] === W) continue;
        if (used) used.add(c + ',' + r);
        return world(c, r);
      }
    }
  }
  return { x: 0, z: 0 };
}

// اسپاون‌ها: با جست‌وجوی برنامه‌ای در نقاط خالیِ هر اتاق انتخاب شده‌اند
// (دور از دیوار و دور از برخورد مبلمان — با scripts/test-spawn.mjs تست می‌شود)
const SPAWN_ANCHORS = {
  swat: [{ x: -19, z: 3 }, { x: -20, z: -1 }, { x: -21, z: 5 }, { x: -18, z: 6 }, { x: -17, z: -1 }],
  terror: [{ x: 18, z: -19 }, { x: 27, z: -12 }, { x: 18, z: -16 }, { x: 25, z: -15 }, { x: 22, z: -19 }],
};
// فاصله آزاد یک نقطه از همه موانع (منفی = داخل مانع)
function clearanceAt(x, z, radius = 0.7) {
  let worst = Infinity;
  for (const c of PROP_COLLIDERS) {
    const d = Math.hypot(x - c.x, z - c.z) - (c.r + radius);
    if (d < worst) worst = d;
  }
  return worst;
}
// نزدیک‌ترین نقطه امن به یک لنگر (هم از دیوار و هم از مبلمان دور باشد)
function safeSpawnNear(x, z, used, radius = 0.7) {
  const base = snapToFree(x, z, null);
  if (clearanceAt(base.x, base.z, radius) > 0.35 && (!used || !used.has(`${base.x},${base.z}`))) {
    if (used) used.add(`${base.x},${base.z}`);
    return base;
  }
  for (let ring = 1; ring <= 9; ring++) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      const nx = base.x + Math.cos(ang) * ring * TILE;
      const nz = base.z + Math.sin(ang) * ring * TILE;
      if (gridAt(nx, nz) === W) continue;
      if (clearanceAt(nx, nz, radius) < 0.35) continue;
      const key = `${nx},${nz}`;
      if (used && used.has(key)) continue;
      if (used) used.add(key);
      return { x: nx, z: nz };
    }
  }
  return base;
}

const SPAWN = (() => {
  const used = new Set();
  return {
    swat: SPAWN_ANCHORS.swat.map(p => safeSpawnNear(p.x, p.z, used)),
    terror: SPAWN_ANCHORS.terror.map(p => safeSpawnNear(p.x, p.z, used)),
  };
})();
let roundLock = false;

async function startRound() {
  for (const a of actors) {
    scene.remove(a.g);
    const mx = a.model?.userData?.mixer;
    if (mx) {
      mx.stopAllAction();
      const i = mixers.indexOf(mx);
      if (i >= 0) mixers.splice(i, 1);
    }
  }
  actors.length = 0;

  STAT.swat.alive = 5; STAT.terror.alive = 5; STAT.swat.kills = 0; STAT.terror.kills = 0;
  player.hp = player.maxHp; player.armor = player.maxArmor;
  player.alive = true; player.mag = WEAPONS[player.weapon].mag; player.reload = 0;
  player.ammo = { grenade: 3, smoke: 3 };
  player.abilityCd = { grenade: 0, smoke: 0 };

  // بازیکن
  const p0 = SPAWN.swat[0];
  playerG.position.set(p0.x, FLOOR_Y, p0.z);
  playerG.visible = true;
  if (clearanceAt(p0.x, p0.z, 0.65) < 0) unstick(playerG.position, 0.65);
  if (!playerModel) await buildPlayer();
  if (!playerTag) {
    playerTag = makeTag('تو (سوات)', 'swat');
    playerTag.position.y = 2.3;
    playerG.add(playerTag);
  }
  playerTag.visible = false;
  const pTag = playerTag;
  playerActor = {
    g: playerG, model: playerModel, tag: pTag, team: 'swat', name: 'تو (سوات)', role: 'فرمانده',
    hp: 100, maxHp: 100, alive: true, isPlayer: true, def: { gun: player.weapon },
    range: 30, dmg: 0, fireRate: 1, fireCd: 1e9, repath: 0, seed: 1,
  };
  actors.push(playerActor);

  const jobs = [];
  for (let i = 0; i < SWAT_TEAM.length; i++)
    jobs.push(spawnActor(SWAT_TEAM[i], 'swat', SPAWN.swat[(i + 1) % SPAWN.swat.length]));
  for (let i = 0; i < TERROR_TEAM.length; i++)
    jobs.push(spawnActor(TERROR_TEAM[i], 'terror', SPAWN.terror[i % SPAWN.terror.length]));
  await Promise.all(jobs);

  updateHUD();
  refreshStatics();
  document.getElementById('roundtext').textContent = `دور ${faNum(roundNum)}`;
  document.getElementById('banner').classList.remove('show');
  toast('⚡ برق قطع است | کلیک راست = چراغ‌قوه | ۱ ۲ ۳ = شاتگان/کلت/چاقو');
  const help = document.getElementById('helpcard');
  if (help && roundNum === 1) {
    help.classList.add('show');
    setTimeout(() => help.classList.remove('show'), 9000);
  }
  roundLock = false;
}

function checkRoundEnd() {
  if (roundLock) return;
  if (STAT.terror.alive === 0) {
    roundLock = true;
    addScore(600);
    banner('🏆 تیم سوات پیروز شد', 'همه تروریست‌ها پاک شدند');
    setTimeout(() => { roundNum++; startRound(); }, 3600);
  } else if (!player.alive || STAT.swat.alive === 0) {
    roundLock = true;
    banner('💀 تیم سوات شکست خورد', 'تروریست‌ها شرکت را تصرف کردند');
    setTimeout(() => { roundNum++; startRound(); }, 3600);
  }
}
function banner(title, sub) {
  const b = document.getElementById('banner');
  b.querySelector('h2').textContent = title;
  b.querySelector('p').textContent = sub;
  b.classList.add('show');
}

/* --------------------------- حلقه بازی --------------------------- */
const clock = new THREE.Clock();
const aimRay = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function screenAim() {
  const v = new THREE.Vector2((mouseX / innerWidth) * 2 - 1, -(mouseY / innerHeight) * 2 + 1);
  aimRay.setFromCamera(v, camera);
  const p = new THREE.Vector3();
  return aimRay.ray.intersectPlane(aimPlane, p) ? p : null;
}

let debugOn = location.search.includes('debug') || location.hash.includes('debug');
let fpsAcc = 0, fpsFrames = 0, fpsShown = 0;
addEventListener('keydown', e => {
  if (e.code === 'F3') { e.preventDefault(); debugOn = !debugOn; }
});

function updateDebug(dt) {
  const el = document.getElementById('debug');
  if (!el) return;
  el.style.display = debugOn ? 'block' : 'none';
  if (!debugOn) return;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 0.4) { fpsShown = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }
  const alive = actors.filter(a => a.alive).length;
  const keysDown = Object.keys(keys).filter(k => keys[k]).join(',') || '—';
  el.textContent =
    `FPS ${fpsShown}\n` +
    `بازیکن: x=${playerG.position.x.toFixed(1)} y=${playerG.position.y.toFixed(1)} z=${playerG.position.z.toFixed(1)}\n` +
    `چرخش: ${(aimAngle * 180 / Math.PI).toFixed(0)}°  |  سلاح: ${player.weapon}\n` +
    `چراغ‌قوه: ${lightState.on ? 'روشن' : 'خاموش'}  شدت: ${wLight.spot.intensity.toFixed(1)}\n` +
    `دوربین: y=${camera.position.y.toFixed(1)} z=${camera.position.z.toFixed(1)}  فاصله: ${camera.position.distanceTo(playerG.position).toFixed(1)}\n` +
    `زاویه دوربین: ${(Math.atan2(camera.position.y - camTarget0.y, Math.hypot(camera.position.x - camTarget0.x, camera.position.z - camTarget0.z)) * 180 / Math.PI).toFixed(0)}°\n` +
    `کلیدها: ${keysDown}\n` +
    `بازیگران زنده: ${alive}  |  خشاب: ${player.mag}\n` +
    `مه: ${scene.fog ? scene.fog.density : 'خاموش'}  |  نقاط نور: ${lightsInScene()}\n` +
    `روشنایی محیط: ${ambientLight.intensity.toFixed(2)}  بالاسری: ${overhead.intensity.toFixed(2)}\n` +
    `ارتفاع بازیکن: ${playerG.position.y.toFixed(2)}  |  قفل: ${document.pointerLockElement ? 'بله' : 'خیر'}`;
}

function lightsInScene() {
  let n = 0;
  scene.traverse(o => { if (o.isLight) n++; });
  return n;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (galleryOpen) {
    const target = GPOS.clone().setY(1.7);
    camera.position.set(
      target.x + Math.sin(gAz) * Math.sin(gPol) * gDist,
      target.y + Math.cos(gPol) * gDist,
      target.z + Math.cos(gAz) * Math.sin(gPol) * gDist
    );
    camera.lookAt(target);
    if (gModel?.userData?.mixer) gModel.userData.mixer.update(dt);
    for (const m of mixers) m.update(dt);
    renderer.render(scene, camera);
    return;
  }

  let mx = 0, mz = 0;
  // حرکت در محورهای جهانی (دوربین همیشه رو به -Z نگاه می‌کند)
  if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
  if (joyVec.x || joyVec.y) { mx = joyVec.x; mz = joyVec.y; }
  const ml = Math.hypot(mx, mz);
  joyMoving = ml > 0.18;

  if (player.alive) {
    if (joyMoving) {
      playerG.position.x += (mx / Math.max(ml, 1)) * player.speed * dt;
      playerG.position.z += (mz / Math.max(ml, 1)) * player.speed * dt;
    }
    resolveCollision(playerG.position, 0.6);
    if (IS_TOUCH) aimAngle = joyMoving ? Math.atan2(mx, mz) : aimAngle;
    else {
      const p = screenAim();
      if (p) aimAngle = Math.atan2(p.x - playerG.position.x, p.z - playerG.position.z);
    }
    playerG.rotation.y = aimAngle;
    playAnim(playerModel, joyMoving ? ['Run', 'Walk'] : ['Idle_Gun_Pointing', 'Idle_Neutral', 'Idle'], 0.16);
    ensureIdle(playerModel);
    if (playerModel?.userData.mixer) playerModel.userData.mixer.timeScale = joyMoving ? 1.15 : 1;
  }

  // شلیک / خشاب
  player.cd -= dt;
  if (player.reload > 0) {
    player.reload -= dt;
    if (player.reload <= 0) { player.mag = WEAPONS[player.weapon].mag; updateHUD(); }
  }
  for (const k in player.abilityCd) player.abilityCd[k] = Math.max(0, player.abilityCd[k] - dt);
  if (player.alive && (mouseDown || joyFire)) playerShoot();
  updateHUD();

  for (const a of actors) if (!a.isPlayer) updateAI(a, dt);

  // کالبد دشمن بعد از مرگ محو می‌شود
  for (const a of actors) {
    if (!a.alive && a.g.userData.deadAt && performance.now() - a.g.userData.deadAt > 2200) a.g.visible = false;
  }

  // ---- دوربین از بالا (top-down، زاویه ثابت) ----
  // دوربین با زاویه ثابت ۶۵ درجه بالای بازیکن می‌ماند. اگر دوربین با
  // aimAngle بچرخد، هنگام نگاه به سمت دور، نما افقی می‌شود و دیوارها
  // همه‌چیز را می‌بندند. پس جهت دوربین به بازیکن قفل است.
  const camTarget = new THREE.Vector3(playerG.position.x, 0.5, playerG.position.z);
  camTarget0.copy(camTarget);
  const back = camZoom * 0.48;           // فاصله افقی روی محور Z جهانی
  const desired = new THREE.Vector3(
    camTarget.x + camShakeX,
    camZoom,
    camTarget.z + back
  );
  camera.position.lerp(desired, 1 - Math.pow(0.0009, dt));
  camera.position.y = Math.max(14, camera.position.y);
  if (shake > 0) {
    camera.position.x += rand(-shake, shake);
    camera.position.y += rand(-shake, shake) * 0.6;
    camera.position.z += rand(-shake, shake);
    shake = Math.max(0, shake - dt * 2.2);
  }
  camera.lookAt(camTarget);
  recoil = Math.max(0, recoil - dt * 3);

  updateEffects(dt);
  for (const m of mixers) m.update(dt);

  // برق اضطراری: چشمک قرمز
  const pulse = (Math.sin(t * 1.4) + 1) / 2;
  emergency.intensity = pulse > 0.93 ? 40 : pulse > 0.86 ? 9 : 0;
  emergency.position.set(Math.sin(t * 0.11) * 9, 5, Math.cos(t * 0.13) * 7);

  // ---- چراغ‌قوه‌ها ----
  // نور بازیکن: اگر روشن است انرژی دارد، اگر خاموش است صفر
  const targetI = lightState.on ? 90 : 0;
  wLight.spot.intensity += (targetI - wLight.spot.intensity) * Math.min(1, dt * 14);
  // لرزش خیلی کم نور همراه با حرکت (دست لرزان)
  weaponLightGroup.position.x = (WEAPONS[player.weapon].kind === 'pistol' || WEAPONS[player.weapon].kind === 'melee' ? 0.22 : 0.32)
    + Math.sin(t * 6) * (joyMoving ? 0.035 : 0.014);
  weaponLightGroup.position.y = 1.5 + Math.sin(t * 4.3) * 0.012;
  wLight.halo.intensity += ((lightState.on ? 2.2 : 0) - wLight.halo.intensity) * Math.min(1, dt * 12);
  selfGlow.visible = lightState.on;

  // چراغ‌قوه ai: سوات‌ها روشن، تروریست‌ها گاهی روشن می‌شوند
  for (const a of actors) {
    if (a.isPlayer || !a.aiSpot) continue;
    if (a.lightOn === undefined) a.lightOn = a.team === 'swat';
    if (a.team === 'terror') {
      if (!a.lightOn && Math.random() < dt * 0.02) { a.lightOn = true; a.lightTimer = 5; }
      if (a.lightOn) {
        a.lightTimer = (a.lightTimer ?? 5) - dt;
        if (a.lightTimer <= 0) a.lightOn = false;
      }
    }
    a.aiSpot.intensity += ((a.lightOn && a.alive ? 4.2 : 0) - a.aiSpot.intensity) * Math.min(1, dt * 8);
  }
  updateTagVisibility(t);

  // شارژ آرام زره
  if (player.alive && player.armor < player.maxArmor) player.armor = Math.min(player.maxArmor, player.armor + dt * 3);

  drawMinimap();
  updateDebug(dt);
  renderer.render(scene, camera);
}

/* ----------------------------- اجرا ----------------------------- */
(async function init() {
  const msg = document.getElementById('loadmsg');
  msg.textContent = 'ساخت طبقات و دیوارهای شرکت…';
  await buildShell();
  msg.textContent = 'چیدن میز و تجهیزات…';
  await buildFurniture();
  msg.textContent = 'آماده‌سازی تیم‌ها…';
  playerModel = await buildPlayer();
  await startRound();
  buildGalleryUI();
  document.getElementById('loading').style.display = 'none';
  animate();
})();
