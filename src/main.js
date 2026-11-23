import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  TILE, COLS, ROWS, HW, HH, GRID, FLOOR, WALL,
  ROOMS, cellCenter, cellX, cellZ, world, isWall, cellOf, roomAt, FURNITURE, PLAN,
} from './map.js';

/* =====================================================================
   نبرد شرکت  |  تیم سوات  vs  تیم تروریست
   مپ: ساختمان مرکزی یک شرکت بزرگ — برق قطع است، فقط چراغ‌قوه و
   نور اضطراری. همه مدل‌ها GLB از پک‌های Quaternius (CC0).
   ===================================================================== */


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
// تیم سوات: سرباز واقعی با انیمیشن Idle/Run/Walk
const SWAT_TEAM = [
  { id: 'swat1', name: 'سوات ۱', model: 'Soldier', gun: 'AR_1',     role: 'مهاجم',      hp: 100 },
  { id: 'swat2', name: 'سوات ۲', model: 'Soldier', gun: 'SMG_1',    role: 'پشتیبان',    hp: 110 },
  { id: 'swat3', name: 'سوات ۳', model: 'Soldier', gun: 'Sniper_2', role: 'تک‌تیرانداز', hp: 90 },
  { id: 'swat4', name: 'سوات ۴', model: 'Soldier', gun: 'Pistol_1', role: 'پزشک',       hp: 95 },
];
// تیم تروریست: ربات با ۱۴ انیمیشن (شامل Death و Punch)
const TERROR_TEAM = [
  { id: 'ter1', name: 'تروریست ۱', model: 'Xbot', gun: 'AR_3',     role: 'مهاجم',      hp: 105 },
  { id: 'ter2', name: 'تروریست ۲', model: 'Xbot', gun: 'SMG_2',    role: 'خرابکار',    hp: 95 },
  { id: 'ter3', name: 'تروریست ۳', model: 'Xbot', gun: 'Sniper_1', role: 'تک‌تیرانداز', hp: 100 },
  { id: 'ter4', name: 'تروریست ۴', model: 'Xbot', gun: 'Pistol_2', role: 'نفربر',      hp: 100 },
  { id: 'ter5', name: 'تروریست ۵', model: 'Xbot', gun: 'AR_5',     role: 'مهاجم',      hp: 95 },
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
const ambientLight = new THREE.AmbientLight(0x6b7f96, 1.55);
scene.add(ambientLight);
// نور عمودی کم‌سو از بالا: بدون این، دیوارها و کف کاملاً تخت و سیاه می‌شوند
const overhead = new THREE.DirectionalLight(0x9fb6d4, 0.95);
overhead.position.set(8, 40, 12);
scene.add(overhead);

/* ------------------------------ لودر ------------------------------ */
const loader = new GLTFLoader();
const cache = new Map();
const pathOf = (cat, name) => `/models/${cat}/${name}.glb`;

function bboxOf(o) { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); }
// جعبه بدنه بر اساس استخوان‌ها: مستقل از T-pose و از مقیاس عجیب گره‌های میانی
function boneBox(o) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3(), v = new THREE.Vector3();
  let any = false;
  o.traverse(n => { if (n.isBone) { b.expandByPoint(n.getWorldPosition(v)); any = true; } });
  return any ? b : bboxOf(o);
}

// هیچ مدلی نباید غول‌آسا شود. مدل‌هایی مثل کابل در محور Y کشیده‌اند و
// اگر فقط ابعاد افقی نرمال شود، ارتفاعشان چند ده متر می‌شود.
const MAX_PROP_HEIGHT = 5.5;

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
  // گارد ارتفاع: اگر هنوز بلندتر از حد است، دوباره کوچک کن
  const h = bboxOf(root).getSize(new THREE.Vector3()).y;
  if (h > MAX_PROP_HEIGHT) root.scale.multiplyScalar(MAX_PROP_HEIGHT / h);
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

// ---------- کاراکترها: مدل و انیمیشن از خود فایل GLB ----------
const CHAR_FILES = {
  Soldier: { path: '/models/chars/Soldier.glb', height: 1.8 },  // سرباز سوات
  Xbot:    { path: '/models/chars/Xbot.glb',    height: 1.8 },  // تروریست (ریگ Mixamo)
};

/* کاراکترها: هر فایل GLB فقط یک‌بار بارگذاری می‌شود و با SkeletonUtils کلون می‌شود.
   Soldier.glb → سرباز (Idle/Run/Walk/TPose)
   Xbot.glb    → تروریست (idle/run/walk/agree/headShake/sneak_pose)
   هر دو ریگ Mixamo هستند، پس ارتفاع و مقیاسشان یکسان است. */
const CHAR_CACHE = new Map();   // key → { scene, clips }

function rawCharacter(key) {
  if (!CHAR_CACHE.has(key)) {
    const info = CHAR_FILES[key];
    CHAR_CACHE.set(key, loader.loadAsync(info.path).then(gltf => ({
      scene: gltf.scene,
      clips: gltf.animations || [],
    })));
  }
  return CHAR_CACHE.get(key);
}

async function loadCharacter(key, target = 1.8) {
  const info = CHAR_FILES[key];
  const src = await rawCharacter(key);
  // کلون اسکلتی واقعی: مش‌ها و استخوان‌ها کپی می‌شوند تا هر کاراکتر انیمیشن مستقل داشته باشد
  const root = SkeletonUtils.clone(src.scene);
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = true;
      o.frustumCulled = false;
      // مواد را کلون کن تا نور/رنگ هر کاراکتر مستقل باشد
      if (o.material) o.material = Array.isArray(o.material)
        ? o.material.map(m => m.clone()) : o.material.clone();
    }
  });

  // نرمال‌سازی قد از جعبه مش‌ها (هر دو مدل Mixamo در حالت دست-پایین حدود
  // ۱.۸ متر هستند، پس این اندازه‌گیری معتبر است).
  const rawH = bboxOf(root).getSize(new THREE.Vector3()).y || 1;
  root.scale.multiplyScalar(target / rawH);
  root.userData.baseY = -bboxOf(root).min.y;
  root.userData.charKey = key;
  root.userData.height = target;

  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const clip of src.clips) {
    // ⚠️ TPose/sad_pose حالت مرجع هستند؛ اگر پخش شوند کاراکتر «عروسکی» می‌شود
    if (/tpose|t_pose|sad_pose|bind/i.test(clip.name)) continue;
    actions[clip.name] = mixer.clipAction(clip);
  }
  root.userData.mixer = mixer;
  root.userData.actions = actions;
  root.userData.current = null;
  mixers.push(mixer);

  const idle = findClip(src.clips, ['Idle', 'Standing']);
  if (idle) { actions[idle.name].play(); root.userData.current = idle.name; }
  return root;
}

const mixers = [];
const gunHolders = [];

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
    const safe = list.filter(a => !/tpose|t_pose|sad_pose|bind/i.test(a.getClip().name));
    if (!safe.length) return;
    const first = safe.find(a => /idle/i.test(a.getClip().name)) || safe[0];
    first.reset().play();
    obj.userData.current = first.getClip().name;
  }
}

// پخش انیمیشن با محافظت در برابر باگ‌های رایج:
//  - کلیپ مرجع (TPose) هرگز پخش نمی‌شود
//  - کلیپ از پایان/میانه شروع نمی‌شود (همیشه reset)
//  - loop درست تنظیم می‌شود تا انیمیشن وسط کار گیر نکند
function playAnim(obj, keys, fade = 0.18, once = false) {
  const acts = obj?.userData?.actions;
  if (!acts) return;
  const names = Object.keys(acts);
  const clips = Object.values(acts).map(a => a.getClip());
  const clip = findClip(clips, keys);
  if (!clip || obj.userData.current === clip.name) return;
  const prev = acts[obj.userData.current], next = acts[clip.name];
  if (!next) return;

  next.reset();
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  next.clampWhenFinished = once;
  next.fadeIn(fade).play();

  if (prev && prev !== next) prev.fadeOut(fade);
  obj.userData.current = clip.name;
}

/* --------------------------- نقشه ساختمان ---------------------------
   نقشه در src/map.js تعریف شده تا تست‌ها و بازی از یک منبع بخوانند. */
const grid = GRID;
const F = FLOOR, W = WALL;
const roomAtWorld = roomAt;

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
/* ---------------------- مسیریابی (A*) ----------------------
   مشکل قبلی: بات‌ها فقط مستقیم به سمت هدف می‌رفتند، به دیوار می‌خوردند و
   دور خودشان می‌چرخیدند. حالا روی گرید کف مسیر واقعی حساب می‌شود. */
const NAV = {
  w: COLS, h: ROWS,
  // خانه‌ای که مبلمان سنگین در آن است، برای مسیریابی بسته حساب می‌شود؛
  // وگرنه بات مستقیم به میز می‌خورد و گیر می‌کند.
  blocked: null,          // Set از "c,r" — پس از ساخت مبلمان پر می‌شود
  open(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    if (grid[r][c] === W) return false;
    if (this.blocked && this.blocked.has(`${c},${r}`)) return false;
    return true;
  },
  key(c, r) { return r * COLS + c; },
};

// پس از ساخت مبلمان، خانه‌های اشغال‌شده را برای مسیریابی علامت بزن
function buildNavBlockers() {
  const set = new Set();
  for (const c of PROP_COLLIDERS) {
    // ⚠️ فقط خودِ خانه‌ی مبلمان را ببند، نه ۳×۳ اطرافش.
    // با شعاع بزرگ‌تر، اتاق‌های کوچک کاملاً مسدود می‌شدند و بات داخل
    // اتاقش زندانی می‌شد (همان باگ «بات‌ها تکون نمی‌خورن»).
    // همه‌ی وسایلی که بات واقعاً به آن‌ها برخورد می‌کند باید بسته باشند،
    // حتی صندلی‌های کوچک؛ وگرنه مسیر از رویشان رد می‌شود و بات گیر می‌کند.
    if (c.r < 0.05) continue;
    const cc = Math.floor((c.x + HW) / TILE), rr = Math.floor((c.z + HH) / TILE);
    if (cc < 1 || rr < 1 || cc >= COLS - 1 || rr >= ROWS - 1) continue;
    if (grid[rr][cc] !== W) set.add(`${cc},${rr}`);
  }
  // راهروها هرگز بسته نشوند (تضمین اتصال)
  for (const r of [8, 9, 17, 18]) for (let c = 1; c < COLS - 1; c++) set.delete(`${c},${r}`);
  for (const c of [16, 17]) for (let r = 1; r < ROWS - 1; r++) set.delete(`${c},${r}`);
  NAV.blocked = set;
}

// لیست همسایه‌ها با ۸ جهت (قطرها گران‌تر)
const DIRS8 = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];

function findPath(sx, sz, tx, tz) {
  const sc = Math.floor((sx + HW) / TILE), sr = Math.floor((sz + HH) / TILE);
  const tc = Math.floor((tx + HW) / TILE), tr = Math.floor((tz + HH) / TILE);
  if (!NAV.open(tc, tr)) return null;
  if (sc === tc && sr === tr) return [{ x: tx, z: tz }];

  const start = NAV.key(sc, sr), goal = NAV.key(tc, tr);
  const openSet = new Map();     // key → {c,r,g,f,parent}
  const closed = new Set();
  const h = (c, r) => Math.hypot(c - tc, r - tr);
  openSet.set(start, { c: sc, r: sr, g: 0, f: h(sc, sr), parent: null });

  let guard = 0;
  while (openSet.size && guard++ < 4000) {
    // کمترین f
    let bestK = null, bestF = Infinity;
    for (const [k, n] of openSet) if (n.f < bestF) { bestF = n.f; bestK = k; }
    const cur = openSet.get(bestK);
    if (bestK === goal) {
      // بازسازی مسیر
      const out = [];
      for (let n = cur; n; n = n.parent) out.push(world(n.c, n.r));
      out.reverse();
      out[out.length - 1] = { x: tx, z: tz };
      // حذف نقاط هم‌راستا برای نرم‌تر شدن حرکت
      const simp = [out[0]];
      for (let i = 1; i < out.length - 1; i++) {
        const a = simp[simp.length - 1], b = out[i], c2 = out[i + 1];
        const cross = (b.x - a.x) * (c2.z - a.z) - (b.z - a.z) * (c2.x - a.x);
        if (Math.abs(cross) > 0.35) simp.push(b);
      }
      simp.push(out[out.length - 1]);
      return simp;
    }
    openSet.delete(bestK);
    closed.add(bestK);
    for (const [dc, dr, cost] of DIRS8) {
      const nc = cur.c + dc, nr = cur.r + dr;
      if (!NAV.open(nc, nr)) continue;
      // قطرها نباید از گوشه دیوار رد شوند
      if (dc && dr && (!NAV.open(cur.c + dc, cur.r) || !NAV.open(cur.c, cur.r + dr))) continue;
      const nk = NAV.key(nc, nr);
      if (closed.has(nk)) continue;
      const g2 = cur.g + cost;
      const ex = openSet.get(nk);
      if (!ex || g2 < ex.g) {
        openSet.set(nk, { c: nc, r: nr, g: g2, f: g2 + h(nc, nr), parent: cur });
      }
    }
  }
  return null;
}

// مسیر تنبل: هر چند ثانیه دوباره حساب می‌شود
function setActorPath(a, tx, tz) {
  const now = performance.now();
  if (a.path && a.pathTarget && Math.hypot(a.pathTarget.x - tx, a.pathTarget.z - tz) < 1.5 && now - a.pathAt < 900) return;
  a.pathTarget = { x: tx, z: tz };
  a.pathAt = now;
  a.path = findPath(a.g.position.x, a.g.position.z, tx, tz);
  a.pathI = 0;
  a.stuck = 0;
}

// حرکت‌دادن بات روی مسیر؛ خروجی: آیا واقعاً حرکت کرد
function followPath(a, speed, dt) {
  if (!a.path || a.pathI >= a.path.length) return false;
  const p = a.path[a.pathI];
  const dx = p.x - a.g.position.x, dz = p.z - a.g.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.45) { a.pathI++; return true; }
  const step = Math.min(speed * dt, d);
  a.g.position.x += (dx / d) * step;
  a.g.position.z += (dz / d) * step;
  a.g.rotation.y = Math.atan2(dx, dz);
  return true;
}

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
  const h = geo.boundingBox.max.y;
  if (h > MAX_PROP_HEIGHT) {
    const k2 = MAX_PROP_HEIGHT / h;
    geo.scale(k2, k2, k2);
    geo.computeBoundingBox();
  }
  return { geo, mat: mesh.material, height: geo.boundingBox.max.y };
}

function instancedFrom(gltf, placements, target, mode = 'footprint', opts = {}) {
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
  // دیوارها با ارتفاع کنترل‌شده ساخته می‌شوند تا دوربین از بالا دید کامل داشته باشد
  // ⚠️ دیوارها نیمه‌شفاف نمی‌شوند: با depthWrite=false ترتیب رسم تصادفی
  // می‌شود و دیوارها از داخل هم دیده می‌شوند (همان «باگ نامرئی‌شدن»).
  // به‌جایش دیوارها کامل مات‌اند و فقط ارتفاعشان محدود است تا دوربین از بالا ببیند.
  const walls = [
    instancedFrom(wA, wallA, TILE, 'footprint'),
    instancedFrom(wB, wallB, TILE, 'footprint'),
    instancedFrom(wT, wallTall, TILE, 'footprint'),
  ];
  for (const im of walls) {
    im.geometry.computeBoundingBox();
    const h = im.geometry.boundingBox.max.y;
    if (h > 2.0) { im.scale.y = 2.0 / h; im.updateMatrix?.(); }
    im.material.depthWrite = true;
    im.material.transparent = false;
    im.material.opacity = 1;
    im.material.needsUpdate = true;
  }
}

/* -------------------------- مبلمان شرکت -------------------------- */
// flat = روی زمین (فرش/کابل)، ceiling = آویزان از سقف
// مبلمان: هر اتاق چند قطعه، همه رو به مرکز اتاق، روی کف و دور از درها.
// مختصات بر اساس ROOMS (ردیف/ستون) محاسبه شده تا با نقشه هم‌تراز باشد.
// مبلمان از src/map.js می‌آید (هم‌تراز با اتاق‌ها)

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
      // اگر مدل هنوز غیرمنطقی بزرگ است، اصلاً نمایش نده (جلوگیری از پوشاندن صفحه)
      const sizeNow = bboxOf(m).getSize(new THREE.Vector3());
      if (sizeNow.y > MAX_PROP_HEIGHT + 0.5 || Math.max(sizeNow.x, sizeNow.z) > 12) {
        console.warn('مدل خیلی بزرگ، حذف شد:', f.n, sizeNow.toArray().map(v => v.toFixed(1)));
        scene.remove(m);
        return;
      }
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
const selfGlow = new THREE.PointLight(0xb8d2f5, 7, 8.5, 1.4);
selfGlow.position.set(0, 1.1, 0);
playerG.add(selfGlow);

function setFlashlight(on) {
  lightState.on = on;
  playClick(on ? 0.7 : 0.5);
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
      // مواد در loadCharacter از قبل کلون شده‌اند، پس اینجا دست نمی‌زنیم
      o.material.emissive = base.clone().multiplyScalar(0.5);
      o.material.emissiveIntensity = team === 'swat' ? 0.5 : 0.65;
      o.material.needsUpdate = true;
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

/* ---------------- نصب سلاح در دست ----------------
   مشکل ریگ‌ها: استخوان دست در این ریگ‌ها مقیاس حدود ۰.۰۱ دارد و با انیمیشن
   هم تغییر می‌کند. اگر اسلحه مستقیم به استخوان بسته شود، یا میکروسکوپی
   می‌شود یا کل صفحه را می‌پوشاند.
   راه‌حل: هر فریم مقیاس گروهِ اسلحه طوری تنظیم می‌شود که طولش در جهان
   ثابت بماند و موقعیتش هم نسبت به کف دست در متر محاسبه می‌شود. */
const GUN_WORLD_LEN = { melee: 0.62, pistol: 0.44, rifle: 0.95, shotgun: 0.95, sniper: 1.05 };

async function attachGun(charRoot, gunName, offset) {
  const d = weaponDef(gunName);
  const hand = findBone(charRoot, ['mixamorigRightHand', 'mixamorig:RightHand', 'RightHand']);
  try {
    // اسلحه با واحد «طول» ساخته می‌شود؛ مقیاس نهایی را layoutGun می‌دهد
    const gun = await loadProp(d.cat, d.model, 1.0, 'length');
    const rawSize = bboxOf(gun).getSize(new THREE.Vector3());
    const gunLen = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;

    const holder = new THREE.Group();
    holder.name = 'gunHolder';
    holder.add(gun);
    holder.userData.gun = gun;
    holder.userData.gunLen = gunLen;
    holder.userData.hand = hand || null;
    holder.userData.charRoot = charRoot;
    holder.userData.def = d;
    holder.userData.offset = offset || new THREE.Vector3(
      d.kind === 'pistol' || d.kind === 'melee' ? 0.02 : 0.05,
      d.kind === 'melee' ? -0.02 : -0.08,
      0.05,
    );

    // جهت‌دهی: لوله رو به جلوی کاراکتر (+Z)
    gun.rotation.set(-0.12, Math.PI / 2, 0);
    if (d.kind === 'melee') gun.rotation.set(Math.PI / 2, 0, Math.PI);

    charRoot.add(holder);   // دنبال‌کردن دست در layoutGun انجام می‌شود

    gunHolders.push(holder);
    layoutGun(holder, 1);   // اولین چیدمان فوری (بدون انتظار برای فریم بعد)
    return holder;
  } catch (e) { console.warn('سلاح نصب نشد:', gunName, e); return null; }
}

// هر فریم: اسلحه را «دنبال دست» می‌بریم، اما در فضای خودِ کاراکتر.
// چرا؟ استخوان دست این ریگ‌ها مقیاس ۰.۰۱ و ماتریس شِییر دارد؛ بستن مستقیم
// اسلحه به استخوان باعث می‌شود یا نامرئی شود یا کل صفحه را بپوشاند.
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _sc = new THREE.Vector3();

function layoutGun(h, dt = 0.016) {
  const gun = h.userData.gun, hand = h.userData.hand, root = h.userData.charRoot;
  if (!gun || !h.parent) return;
  const d = h.userData.def || {};
  const worldLen = GUN_WORLD_LEN[d.kind] || 0.9;
  const gunLen = h.userData.gunLen || 1;

  // مقیاس کاراکتر در جهان (برای اینکه طول اسلحه در متر ثابت بماند)
  root.updateWorldMatrix(true, false);
  root.getWorldScale(_sc);
  const rootScale = Math.abs(_sc.x) || 1;

  if (hand) {
    hand.updateWorldMatrix(true, false);
    // موقعیت و چرخش دست در فضای کاراکتر
    hand.getWorldPosition(_v1);
    root.worldToLocal(_v1);
    hand.getWorldQuaternion(_q1);
    root.getWorldQuaternion(_q2).invert();
    _q1.premultiply(_q2);

    const o = h.userData.offset;
    // جابه‌جایی کوچک به سمت کف دست (در فضای کاراکتر)
    _v2.copy(o).applyQuaternion(_q1);
    h.position.copy(_v1).add(_v2);
    h.quaternion.copy(_q1);
  } else {
    const hh = root.userData.height || 1.8;
    h.position.set(0.34, hh * 0.62, 0.42);
    h.quaternion.identity();
  }
  // طول اسلحه در جهان ≈ worldLen
  const want = worldLen / (gunLen * rootScale);
  const cur = h.scale.x || want;
  h.scale.setScalar(Math.abs(cur - want) < 1e-4 ? want : cur + (want - cur) * Math.min(1, dt * 14));
}

let playerGunHolder = null;
async function buildPlayer() {
  playerModel = await loadCharacter('Soldier', 1.8);
  // در نمای از بالا کاراکتر باید کمی بزرگ‌تر دیده شود
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
  playAnim(a.model, ['Death', 'sad_pose'], 0.1, true);
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
  if (w.kind !== 'melee' && player.mag <= 0) { playClick(1.3); startReload(); return; }
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
    playClick(hitAny ? 1.4 : 0.8);   // ضربه چاقو: کلیک فلزی، نه صدای شلیک
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
  if (w.kind !== 'melee') playShot(w.kind, 0, 1);
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
  playReload();
}

/* ------------------------------ هوش دشمن ------------------------------
   باگ قبلی: وقتی بات هدف نداشت، هر فریم wanderDir عوض می‌شد و بات سر جایش
   می‌چرخید. حالا:
   ۱) حتی در تاریکی روی مسیر A* راه می‌رود و هر ۲-۴ ثانیه مقصد تازه می‌گیرد
   ۲) انیمیشن راه‌رفتن فقط وقتی پخش می‌شود که واقعاً جابه‌جا شود
   ۳) اگر گیر کرد، مسیر دوباره حساب می‌شود و مقصد عوض می‌شود
*/
function updateAI(a, dt) {
  if (!a.alive) return;
  a.fireCd -= dt;
  a.repath -= dt;
  if (a.pathCd === undefined) a.pathCd = 0;
  a.pathCd -= dt;

  // ---- انتخاب هدف دیداری (فقط چیزی که در نور یا خیلی نزدیک باشد) ----
  let visible = null, visD = Infinity, nearest = null, nearD = Infinity;
  for (const e of actors) {
    if (!e.alive || e.team === a.team) continue;
    const d = flatDist(a.g.position, e.g.position);
    if (d < nearD) { nearD = d; nearest = e; }
    if (d > 26) continue;
    const spotted = hasLineOfSight(a.g.position, e.g.position) &&
      (litByAi(a, e.g.position) || (e.isPlayer && litByPlayer(a.g.position)) || d < 3.2);
    if (spotted && d < visD) { visD = d; visible = e; }
  }
  a.target = visible;
  a.lastKnown = nearest;
  a.visible = !!visible;

  const want = a.role === 'تک‌تیرانداز' ? 15 : a.role === 'پشتیبان' ? 9 : 6;

  if (!a.target) {
    // ---- سرگردانی با مسیر واقعی: به اتاق/راهروی تصادفی برو ----
    if (a.pathCd <= 0 || !a.path || a.pathI >= a.path.length) {
      a.pathCd = rand(2.5, 4.5);
      const goal = pickWanderGoal(a);
      if (goal) setActorPath(a, goal.x, goal.z);
    }
    const moved = followPath(a, a.speed * 0.55, dt);
    if (moved) {
      // اگر جلوی بات بسته بود، مقصد تازه بگیر
      const before = a.g.position.clone();
      resolveCollision(a.g.position, 0.55);
      if (a.g.position.distanceTo(before) > 0.02) { a.path = null; a.pathCd = 0; }
      playAnim(a.model, ['Walk', 'walk', 'Walking'], 0.18);
    } else {
      playAnim(a.model, ['Idle', 'idle', 'Standing'], 0.2);
      a.path = null;
    }
    return;
  }

  // ---- هدف دیده شد: نزدیک شو یا در فاصله مناسب بایست ----
  const t = a.target.g.position;
  const d = flatDist(a.g.position, t);

  if (d > want * 1.1) {
    if (a.pathCd <= 0 || !a.path) { a.pathCd = 0.4; setActorPath(a, t.x, t.z); }
    const moved = followPath(a, a.speed, dt);
    const before = a.g.position.clone();
    resolveCollision(a.g.position, 0.55);
    const blocked = a.g.position.distanceTo(before) > 0.02;
    if (blocked || !moved) { a.path = null; a.pathCd = 0; }
    playAnim(a.model, ['Run', 'run', 'Running', 'Walk', 'walk'], 0.16);
  } else if (d < want * 0.5) {
    // خیلی نزدیک: عقب بکش (با مسیر، نه با چرخیدن دور خود)
    if (a.pathCd <= 0 || !a.path) {
      a.pathCd = 0.8;
      const away = Math.atan2(a.g.position.x - t.x, a.g.position.z - t.z);
      const gx = a.g.position.x + Math.sin(away) * 4;
      const gz = a.g.position.z + Math.cos(away) * 4;
      setActorPath(a, clamp(gx, -HW + 3, HW - 3), clamp(gz, -HH + 3, HH - 3));
    }
    followPath(a, a.speed * 0.8, dt);
    resolveCollision(a.g.position, 0.55);
    playAnim(a.model, ['Run', 'run', 'Walking', 'walk'], 0.16);
  } else {
    // در برد: رو به هدف بایست و شلیک کن
    a.g.rotation.y = Math.atan2(t.x - a.g.position.x, t.z - a.g.position.z);
    playAnim(a.model, ['Idle', 'idle'], 0.2);
  }

  if (a.target && d < a.range && a.fireCd <= 0) {
    a.fireCd = a.fireRate * rand(0.8, 1.3);
    a.g.rotation.y = Math.atan2(t.x - a.g.position.x, t.z - a.g.position.z);
    const origin = a.g.position.clone();
    origin.x += Math.sin(a.g.rotation.y) * 0.55;
    origin.z += Math.cos(a.g.rotation.y) * 0.55;
    origin.y = 1.2;
    const target = t.clone(); target.y = 1.15;
    let hitChance = clamp(1.1 - d / (a.range * 1.6), 0.15, 0.8);
    if (inSmoke(a.g.position) || inSmoke(t)) hitChance *= 0.42;
    const miss = target.clone().add(new THREE.Vector3(rand(-2.6, 2.6), rand(-0.4, 1.6), rand(-2.6, 2.6)));
    spawnTracer(origin, Math.random() < hitChance ? target : miss, a.team, 0.05);
    if (Math.random() < hitChance) damageActor(a.target, a.dmg * rand(0.8, 1.2), a);
    playAnim(a.model, ['Punch', 'agree', 'Attack'], 0.06);
    const ek = WEAPONS[a.def.gun]?.kind || 'rifle';
    playShot(ek === 'melee' ? 'rifle' : ek, flatDist(a.g.position, playerG.position), 0.85);
  }
}

// مقصد سرگردانی: نقطه‌ای دورتر در محدوده‌ی ۱۲ متری، روی کف
function pickWanderGoal(a) {
  for (let i = 0; i < 14; i++) {
    const ang = rand(-Math.PI, Math.PI);
    const dist = rand(5, 14);
    const x = a.g.position.x + Math.sin(ang) * dist;
    const z = a.g.position.z + Math.cos(ang) * dist;
    if (x < -HW + 3 || x > HW - 3 || z < -HH + 3 || z > HH - 3) continue;
    if (gridAt(x, z) === W) continue;
    return { x, z };
  }
  return null;
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
  playClick(0.9);
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
  playExplosion(flatDist(pos, playerG.position));
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
  playSmoke();
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
let camZoom = 26;
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
  if (code === 'Escape') document.exitPointerLock?.();
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
  if (e.shiftKey) {
    // Shift + چرخ = تعویض سلاح
    const i = PLAYER_LOADOUT.indexOf(player.weapon);
    const n = (i + (e.deltaY > 0 ? 1 : -1) + PLAYER_LOADOUT.length) % PLAYER_LOADOUT.length;
    equipWeapon(PLAYER_LOADOUT[n]);
  } else {
    camZoom = clamp(camZoom + e.deltaY * 0.02, 18, 34);   // زوم محدود: دوربین از نقشه بیرون نزند
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
document.querySelectorAll('#bar .slot').forEach(b => { b.onclick = () => equipWeapon(b.dataset.w); });
document.getElementById('grenbtn').onclick = () => throwGrenade('grenade');
document.getElementById('smokebtn').onclick = () => throwGrenade('smoke');

/* ------------------------------ HUD ------------------------------ */
let score = 0, roundNum = 1;
const faNum = n => Math.round(n).toLocaleString('fa-IR');
const addScore = n => { score = Math.max(0, score + n); };

function updateHUD() {
  document.getElementById('hpfill').style.width = Math.max(0, player.hp) + '%';
  document.getElementById('armorfill').style.width = Math.max(0, player.armor) + '%';
  const w = WEAPONS[player.weapon];
  const magTxt = w.kind === 'melee' ? '∞' : faNum(player.mag);
  const capTxt = w.mag === Infinity ? '∞' : faNum(w.mag);
  document.getElementById('magtext').textContent = `${magTxt} / ${capTxt}`;
  document.getElementById('torchstate').className = lightState.on ? 'on' : 'off';
  document.querySelectorAll('#bar .slot').forEach(b => b.classList.toggle('active', b.dataset.w === player.weapon));
  document.getElementById('wepname').textContent = WEAPONS[player.weapon].fa;
  document.getElementById('ammoG').textContent = faNum(player.ammo.grenade);
  document.getElementById('ammoS').textContent = faNum(player.ammo.smoke);
  document.getElementById('cdG').style.height = (player.abilityCd.grenade / ABILITY_CD.grenade * 100) + '%';
  document.getElementById('cdS').style.height = (player.abilityCd.smoke / ABILITY_CD.smoke * 100) + '%';
}

function refreshStatics() {
  // نوار بالای صفحه حذف شده؛ آمار فقط در HUD فشرده و F3 استفاده می‌شود
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

/* --------------------------- نقشه کوچک --------------------------- */
const mmCanvas = document.getElementById('minimap');
const mm = mmCanvas.getContext('2d');
mmCanvas.width = COLS * 7; mmCanvas.height = ROWS * 7;
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

const muteBtn = document.getElementById('muteBtn');
muteBtn.onclick = () => {
  initAudio();
  audio.muted = !audio.muted;
  muteBtn.textContent = audio.muted ? '🔇' : '🔊';
  toast(audio.muted ? '🔇 صدا خاموش' : '🔊 صدا روشن');
};

/* ============================ صدا ============================ */
// صداهای واقعی ضبط‌شده (CC0) — از پک firearm_sfx:
// public/audio/shot_rifle.wav, shot_pistol.wav, shot_shotgun.wav, shot_sniper.wav
const audio = {
  ctx: null, master: null, ready: false, muted: false,
  buffers: {},          // نمونه‌های رمزگشایی‌شده
  loading: null,
};

const AUDIO_FILES = {
  rifle:   ['/audio/shot_rifle.wav', '/audio/shot_rifle2.wav'],
  pistol:  ['/audio/shot_pistol.wav'],
  shotgun: ['/audio/shot_shotgun.wav'],
  sniper:  ['/audio/shot_sniper.wav'],
};

function initAudio() {
  if (audio.ctx) return audio.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audio.ctx = new AC();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.5;
  // محدودکننده سبک تا صدای شلیک تیز و آزاردهنده نباشد
  const comp = audio.ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 7;
  comp.attack.value = 0.002; comp.release.value = 0.22;
  audio.master.connect(comp).connect(audio.ctx.destination);
  audio.ready = true;
  return audio.ctx;
}

// بارگذاری نمونه‌های واقعی (یک‌بار)
function loadSamples() {
  initAudio();
  if (!audio.ctx) return Promise.resolve(false);
  if (audio.loading) return audio.loading;
  audio.loading = Promise.all(
    Object.entries(AUDIO_FILES).map(([key, urls]) =>
      Promise.all(urls.map(u =>
        fetch(u).then(r => r.arrayBuffer()).then(b => audio.ctx.decodeAudioData(b))
          .catch(() => null)
      )).then(bufs => { audio.buffers[key] = bufs.filter(Boolean); })
    )
  ).then(() => {
    const ok = Object.keys(audio.buffers).filter(k => audio.buffers[k].length);
    console.log('🔊 نمونه‌های صوتی واقعی بارگذاری شد:', ok.join(', '));
    return ok.length > 0;
  }).catch(() => false);
  return audio.loading;
}

// مرورگر تا اولین کلیک/لمس اجازه پخش نمی‌دهد
for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  addEventListener(ev, () => {
    initAudio();
    if (audio.ctx?.state === 'suspended') audio.ctx.resume();
    loadSamples();
  }, { once: true });
}

/* —— پخش شلیک واقعی —— */
// dist: فاصله شنونده تا منبع (متر)  |  volume: شدت نسبی
function playShot(kind = 'rifle', dist = 0, volume = 1) {
  if (!audio.ready || audio.muted) return;
  const ctx = audio.ctx;
  const set = audio.buffers[kind] || audio.buffers.rifle;
  if (!set || !set.length) return;

  // افت شدت در فضای بسته: صدا از دیوار عبور می‌کند ولی گل می‌کند
  const atten = Math.max(0.04, 1 / (1 + Math.pow(dist / 8, 1.6))) * volume;
  if (atten < 0.02) return;

  const src = ctx.createBufferSource();
  // تنوع: هر بار یکی از نمونه‌ها به‌صورت تصادفی + پیچ تصادفی خفیف
  src.buffer = set[(Math.random() * set.length) | 0];
  src.playbackRate.value = 0.94 + Math.random() * 0.12;

  // فاصله = کم‌کردن بم و افت شدت (هوای شرکت)
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = dist > 4 ? Math.max(900, 14000 - dist * 900) : 16000;

  const g = ctx.createGain();
  g.gain.value = atten * 0.95;

  src.connect(lp).connect(g).connect(audio.master);
  src.start(ctx.currentTime + Math.random() * 0.01);
  setTimeout(() => { try { src.disconnect(); lp.disconnect(); g.disconnect(); } catch (_) {} }, 3000);
}

/* —— خشاب خالی / کلیک فلزی (سنتز کوتاه، چون ضبط جدا لازم نیست) —— */
let clickBuf = null;
function makeClickBuf() {
  const ctx = audio.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 0.055);
  const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 95);
    // چند مؤلفه فلزی + نویز
    d[i] = env * (Math.sin(2 * Math.PI * 2600 * t) * 0.5 +
                  Math.sin(2 * Math.PI * 4100 * t) * 0.3 +
                  (Math.random() * 2 - 1) * 0.55);
  }
  return b;
}
function playClick(strength = 1) {
  if (!audio.ready || audio.muted) return;
  const ctx = audio.ctx;
  if (!clickBuf) clickBuf = makeClickBuf();
  const src = ctx.createBufferSource();
  src.buffer = clickBuf;
  src.playbackRate.value = 0.9 + Math.random() * 0.25;
  const g = ctx.createGain();
  g.gain.value = 0.22 * strength;
  src.connect(g).connect(audio.master);
  src.start();
}

/* —— تعویض خشاب: دو کلیک + سُرخوردن فلز —— */
function playReload() {
  if (!audio.ready || audio.muted) return;
  playClick(1.2);
  setTimeout(() => playClick(0.9), 280);
  setTimeout(() => playClick(0.55), 560);
}

/* —— انفجار نارنجک: نمونه بم ضبط‌شده + تقویت پایین —— */
function playExplosion(dist = 0) {
  if (!audio.ready || audio.muted) return;
  const ctx = audio.ctx;
  const base = (audio.buffers.shotgun || audio.buffers.rifle || [])[0];
  if (!base) return;
  const atten = Math.max(0.15, 1 / (1 + dist / 12));

  const src = ctx.createBufferSource();
  src.buffer = base;
  src.playbackRate.value = 0.32;           // کشیدن صدا به پایین = انفجار
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = atten * 1.5;
  src.connect(lp).connect(g).connect(audio.master);
  src.start();

  // لرزش بم اضافی
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(85, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(26, ctx.currentTime + 0.55);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.5 * atten, ctx.currentTime);
  og.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + 0.7);
  osc.connect(og).connect(audio.master);
  osc.start(); osc.stop(ctx.currentTime + 0.75);
  setTimeout(() => { try { src.disconnect(); lp.disconnect(); g.disconnect(); } catch (_) {} }, 2500);
}

/* —— دود: هیس نویزی —— */
function playSmoke() {
  if (!audio.ready || audio.muted) return;
  const ctx = audio.ctx, sr = ctx.sampleRate, len = Math.floor(sr * 2.4);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.3) * Math.exp(-t / 0.85);
    // نویز صورتی تقریبی (فیلتر یک‌قطبی)
    prev = prev * 0.85 + (Math.random() * 2 - 1) * 0.15;
    d[i] = prev * env * 1.6;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1600;
  const g = ctx.createGain(); g.gain.value = 0.5;
  src.connect(hp).connect(g).connect(audio.master);
  src.start();
}

function beep() { }

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
// سوات از سمت چپ/پایین، تروریست‌ها از سمت راست/بالا وارد می‌شوند
const SPAWN_ANCHORS = {
  swat:   [cellCenter(2, 21), cellCenter(7, 21), cellCenter(12, 21), cellCenter(2, 12), cellCenter(7, 12)],
  terror: [cellCenter(31, 2), cellCenter(26, 2), cellCenter(31, 12), cellCenter(26, 12), cellCenter(31, 21)],
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
    `camZoom: ${camZoom.toFixed(0)}  |  محدوده نقشه: ±${HW.toFixed(0)}x±${HH.toFixed(0)}\n` +
    `زاویه دوربین: ${(Math.atan2(camera.position.y - camTarget0.y, Math.hypot(camera.position.x - camTarget0.x, camera.position.z - camTarget0.z)) * 180 / Math.PI).toFixed(0)}°\n` +
    `کلیدها: ${keysDown}\n` +
    `بازیگران زنده: ${alive}  |  خشاب: ${player.mag}\n` +
    `مه: ${scene.fog ? scene.fog.density : 'خاموش'}  |  نقاط نور: ${lightsInScene()}\n` +
    `روشنایی محیط: ${ambientLight.intensity.toFixed(2)}  بالاسری: ${overhead.intensity.toFixed(2)}\n` +
    `ارتفاع بازیکن: ${playerG.position.y.toFixed(2)}  |  صدا: ${audio.ready ? (audio.muted ? 'بی‌صدا' : 'روشن') : 'منتظر کلیک'}\n` +
    `بزرگ‌ترین اجسام:\n              ${biggestObjects(3)}`;
}

// بزرگ‌ترین مدل‌های صحنه: ابزار تشخیص مدل‌های غول‌آسا
function biggestObjects(n = 3) {
  const list = [];
  scene.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const box = new THREE.Box3().setFromObject(o);
    const s = box.getSize(new THREE.Vector3());
    const m = Math.max(s.x, s.y, s.z);
    if (m > 1) list.push({ name: o.name || o.parent?.name || '?', size: s, max: m });
  });
  return list.sort((a, b) => b.max - a.max).slice(0, n)
    .map(o => `${o.name.slice(0, 14)} ${o.size.x.toFixed(1)}x${o.size.y.toFixed(1)}x${o.size.z.toFixed(1)}`)
    .join('\n              ');
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
    playAnim(playerModel, joyMoving ? ['Run', 'Walk'] : ['Idle'], 0.16);
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
  // نقطه هدف کمی «جلوی» بازیکن است تا فضای پیش‌رو در کادر بیاید
  // دوربین هرگز با aimAngle نمی‌چرخد. هدف همیشه خود بازیکن است.
  const camTarget = new THREE.Vector3(playerG.position.x, 0.5, playerG.position.z);
  camTarget0.copy(camTarget);
  const back = camZoom * 0.22;           // فاصله افقی کم = زاویه تند (نمای از بالا)
  const desired = new THREE.Vector3(
    camTarget.x + camShakeX,
    camZoom,
    camTarget.z + back
  );
  camera.position.lerp(desired, 1 - Math.pow(0.0009, dt));
  // دوربین داخل محدوده نقشه قفل شود تا از بیرون ساختمان نگاه نکند
  camera.position.y = Math.max(16, camera.position.y);
  camera.position.x = clamp(camera.position.x, -HW + 3, HW - 3);
  camera.position.z = clamp(camera.position.z, -HH + 3, HH - 3);
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
  for (const h of gunHolders) layoutGun(h, dt);

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
const BUILD_VERSION = 'v10-newmap';

(async function init() {
  const msg = document.getElementById('loadmsg');
  msg.textContent = 'ساخت طبقات و دیوارهای شرکت…';
  await buildShell();
  msg.textContent = 'چیدن میز و تجهیزات…';
  await buildFurniture();
  buildNavBlockers();   // پس از ساخت مبلمان، مسیرهای مسدود را علامت بزن
  msg.textContent = 'آماده‌سازی تیم‌ها…';
  playerModel = await buildPlayer();
  await startRound();
  document.getElementById('loading').style.display = 'none';
  const verEl = document.getElementById('version');
  if (verEl) verEl.textContent = BUILD_VERSION;
  console.log('[نبرد شرکت] نسخه:', BUILD_VERSION);
  animate();
})();
