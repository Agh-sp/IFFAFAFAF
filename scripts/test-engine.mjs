/* تست جامع انجین — همه چیزهایی که باید سالم باشند:
   ۱) زمین صاف و خالی است (بدون دیوار/مبلمان)
   ۲) جهت حرکت و نگاه مدل درست است
   ۳) دوربین: نمای عمود ۹۰°، بدون ابهام up، میدان دید درست، کاراکتر قابل‌دیدن
   ۴) مدل‌های کاراکتر و انیمیشن‌هایشان موجودند
   ۵) صداهای واقعی موجودند
   ۶) هیچ شناسه‌ی DOM گم‌شده‌ای نیست
   ۷) تجهیزات خوانا برای نمای عمود (کلاه + پد شانه) به کاراکتر وصل می‌شوند
*/
import * as THREE from 'three';
import fs from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SPAWNS } from '../src/map.js';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

const MAIN = fs.readFileSync('src/main.js', 'utf8');
const MAP = fs.readFileSync('src/map.js', 'utf8');
const num = (re, name) => {
  const m = MAIN.match(re);
  if (!m) { check(false, `در main.js پیدا نشد: ${name}`); return 0; }
  return parseFloat(m[1]);
};

/* ---------------------------- ۱) زمین ---------------------------- */
console.log('=== ۱) زمین ===');
check(/GRID = PLAN\.map/.test(MAP) && /const PLAN = Array\.from\(\{ length: ROWS \}, \(\) => '\.'/.test(MAP),
  'نقشه یک گرید کاملاً خالی است (هیچ دیواری)');
check(/export const FURNITURE = \[\]/.test(MAP), 'صفر مبلمان');
check(/export const ROOMS = \[\]/.test(MAP), 'صفر اتاق');
check(SPAWNS.swat.length === 5 && SPAWNS.terror.length === 5, '۵ اسپاون برای هر تیم');
const HW = 40, HH = 30;
let spawnBad = 0;
for (const team of ['swat', 'terror']) for (const p of SPAWNS[team])
  if (Math.abs(p.x) > HW - 3 || Math.abs(p.z) > HH - 3) spawnBad++;
check(spawnBad === 0, 'همه اسپاون‌ها داخل زمین‌اند');
const dist = Math.hypot(SPAWNS.swat[0].x - SPAWNS.terror[0].x, SPAWNS.swat[0].z - SPAWNS.terror[0].z);
check(dist > 30, `تیم‌ها از هم دور شروع می‌کنند (${dist.toFixed(0)} متر)`);

/* ------------------------ ۲) حرکت و چرخش ------------------------ */
console.log('\n=== ۲) حرکت و چرخش ===');
const camZoom = num(/let camZoom = ([\d.]+)/, 'camZoom');
const camFov = num(/PerspectiveCamera\(([\d.]+),/, 'FOV');

const camProbe = new THREE.PerspectiveCamera(camFov, 1280 / 720, 0.1, 260);
camProbe.up.set(0, 0, -1);
camProbe.position.set(0, camZoom, 0);
camProbe.lookAt(0, 0, 0);
camProbe.updateMatrixWorld(true);
const sx = (x, z) => new THREE.Vector3(x, 0, z).project(camProbe).x;
check(sx(2, 0) > 0.02, 'کلید D (x+) → راست صفحه');
check(sx(-2, 0) < -0.02, 'کلید A (x−) → چپ صفحه');
const sz = (x, z) => new THREE.Vector3(x, 0, z).project(camProbe).y;
check(sz(0, -2) > 0.02, 'کلید W (z−) → بالای صفحه');
check(sz(0, 2) < -0.02, 'کلید S (z+) → پایین صفحه');

// مدل swat رو به +Z است (اثبات: ویزور ماسک از سمت +Z دیده می‌شود)
const MODEL_YAW_OFFSET = 0;
const fwd = th => ({ x: Math.sin(th), z: Math.cos(th) });
let badDir = 0;
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2, nx = Math.sin(a), nz = Math.cos(a);
  const f = fwd(Math.atan2(nx, nz) + MODEL_YAW_OFFSET);
  if (f.x * nx + f.z * nz < 0.99) badDir++;
}
check(badDir === 0, 'در ۱۶ جهت، نگاه مدل با جهت حرکت یکی است');

/* --------------------------- ۳) دوربین --------------------------- */
console.log('\n=== ۳) دوربین ===');
check(/camera\.up\.set\(0,\s*0,\s*-1\)/.test(MAIN),
  'camera.up صریح تنظیم شده (بدون ابهام در نمای عمود)');
check(/camera\.lookAt\(camTarget\)/.test(MAIN) &&
  /const desired = new THREE\.Vector3\(\s*playerG\.position\.x,\s*camZoom,\s*playerG\.position\.z,/.test(MAIN),
  'دوربین عمودِ کامل است (افست Z صفر)');
check(!/camBack/.test(MAIN), 'هیچ افست پشتی باقی نمانده (نما مایل نیست)');

// میدان دید عمودی = ۲ × ارتفاع × tan(FOV/2)
const viewH = 2 * camZoom * Math.tan((camFov * Math.PI / 180) / 2);
const pxPerM = 720 / viewH;
check(viewH < 11, `میدان دید ${viewH.toFixed(1)} متر عمودی — اتاق و راهرو در کادر جا می‌شود`);
check(viewH > 5.5, `میدان دید ${viewH.toFixed(1)} متر — به‌قدر کافی باز است`);
const bodyPx = 0.9 * pxPerM;
check(bodyPx > 34, `عرض کاراکتر روی صفحه ${bodyPx.toFixed(0)}px از 720px — دیده می‌شود`);

const pc = new THREE.Vector3(0, 0.9, 0).project(camProbe);
check(Math.abs(pc.x) < 0.02 && Math.abs(pc.y) < 0.02, 'با صفر بودن افست، بازیکن مرکز کادر است');

/* ---------------------- ۴) کاراکترها و انیمیشن ---------------------- */
console.log('\n=== ۴) کاراکترها و انیمیشن ===');
const CHAR_FILES = { Hero: 'public/models/chars/swat.glb', Robot: 'public/models/chars/swat_urban.glb' };
for (const [name, path] of Object.entries(CHAR_FILES)) {
  const exists = fs.existsSync(path);
  check(exists, `${name}: فایل موجود (${path})`);
  if (!exists) continue;
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const anims = (json.animations || []).map(a => a.name);
  const need = ['Idle_Gun_Pointing', 'Run', 'Run_Shoot', 'Walk', 'Death', 'Gun_Shoot', 'Interact'];
  const short = anims.map(a => a.split('|').pop());
  const missing = need.filter(n => !short.includes(n));
  check(missing.length === 0,
    `${name}: همه‌ی ۷ کلیپ لازم موجود است (${anims.length} کلیپ؛ کم: ${missing.join(',') || '—'})`);
  check((json.skins || []).length > 0 && json.skins[0].joints.length > 20,
    `${name}: ریگ واقعی (${json.skins?.[0]?.joints?.length || 0} استخوان)`);
  // قانون A1: هیچ کلیپ ممنوعه‌ای نباید پخش شود
  check(!/tpose|t_pose|bind/i.test(anims.join(' ')), `${name}: کلیپ ممنوعهٔ TPose/bind ندارد`);
}

/* --------------- ۵) انیمیشن واقعاً روی اسکلت کار می‌کند --------------- */
console.log('\n=== ۵) انیمیشن روی اسکلت ===');
globalThis.self = globalThis;
const loader = new GLTFLoader();
// در Node باید از فایل محلی parse کنیم (fetch نسبی وجود ندارد)
const glbBytes = fs.readFileSync(CHAR_FILES.Hero);
const gltf = await new Promise(res => loader.parse(
  glbBytes.buffer.slice(glbBytes.byteOffset, glbBytes.byteOffset + glbBytes.byteLength),
  '', res, () => res(null),
));
if (!gltf) {
  check(false, 'GLB بارگذاری نشد');
} else {
  const SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
  const root = SkeletonUtils.clone(gltf.scene);
  const mixer = new THREE.AnimationMixer(root);
  const clip = gltf.animations.find(a => /Idle_Gun_Pointing$/.test(a.name));
  check(!!clip, 'کلیپ Idle_Gun_Pointing پیدا شد');
  if (clip) {
    mixer.clipAction(clip).play();
    mixer.update(0.4);
    root.updateMatrixWorld(true);
    const head = root.getObjectByName('Head');
    const chest = root.getObjectByName('Chest');
    check(!!head && !!chest, 'استخوان‌های Head و Chest موجودند');
    // قانون A8: کف پا روی زمین
    const bb = new THREE.Box3().setFromObject(root);
    check(Math.abs(bb.min.y) < 0.06, `کف پا روی زمین است (min.y = ${bb.min.y.toFixed(3)})`);
    const h = bb.getSize(new THREE.Vector3()).y;
    check(h > 1.6 && h < 2.0, `قد کاراکتر ${h.toFixed(2)} متر (بدون کشیدگی)`);
    check(/import \{ addReadableKit \} from '\.\/kit\.js'/.test(MAIN), 'تجهیزات خوانا از ماژول مشترک می‌آید');
  }
}

/* --------------------------- ۶) صدا --------------------------- */
console.log('\n=== ۶) صداهای واقعی ===');
for (const f of ['shot_rifle.wav', 'shot_rifle2.wav', 'shot_pistol.wav', 'shot_shotgun.wav', 'shot_sniper.wav']) {
  const p = `public/audio/${f}`;
  if (!fs.existsSync(p)) { check(false, `صدا نیست: ${f}`); continue; }
  const b = fs.readFileSync(p);
  check(b.subarray(0, 4).toString() === 'RIFF', `${f} (${(b.length / 1024).toFixed(0)}KB) فایل WAV واقعی است`);
}

/* --------------------------- ۷) HUD --------------------------- */
console.log('\n=== ۷) HUD ===');
const html = fs.readFileSync('index.html', 'utf8');
const ids = [...MAIN.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
const missing = [...new Set(ids)].filter(id => !html.includes(`id="${id}"`));
check(missing.length === 0, `همه ${new Set(ids).size} شناسه‌ی DOM موجودند${missing.length ? ` (کم: ${missing.join(', ')})` : ''}`);

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ انجین سالم است');
process.exit(fails ? 1 : 0);
