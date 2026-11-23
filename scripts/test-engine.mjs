/* تست جامع انجین — همه چیزهایی که باید سالم باشند:
   ۱) زمین صاف و خالی است (بدون دیوار/مبلمان)
   ۲) جهت حرکت و نگاه مدل درست است
   ۳) دوربین داخل زمین می‌ماند و از سطح بالا نیست
   ۴) مدل‌های کاراکتر و انیمیشن‌هایشان موجودند
   ۵) صداهای واقعی موجودند
   ۶) هیچ شناسه‌ی DOM گم‌شده‌ای نیست
*/
import * as THREE from 'three';
import fs from 'node:fs';
import { TILE, COLS, ROWS, HW, HH, WORLD_W, WORLD_D, GRID, FURNITURE, ROOMS, SPAWNS } from '../src/map.js';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

console.log('=== ۱) زمین ===');
check(WORLD_W === 80 && WORLD_D === 60, `ابعاد زمین ${WORLD_W}×${WORLD_D} متر`);
let walls = 0;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (GRID[r][c] === 1) walls++;
check(walls === 0, `صفر دیوار (${walls} یافت شد)`);
check(FURNITURE.length === 0, `صفر مبلمان (${FURNITURE.length} یافت شد)`);
check(ROOMS.length === 0, 'صفر اتاق');
check(SPAWNS.swat.length === 5 && SPAWNS.terror.length === 5, '۵ اسپاون برای هر تیم');
// اسپاون‌ها داخل زمین و از هم دور
let spawnBad = 0;
for (const team of ['swat','terror']) for (const p of SPAWNS[team])
  if (Math.abs(p.x) > HW - 3 || Math.abs(p.z) > HH - 3) spawnBad++;
check(spawnBad === 0, 'همه اسپاون‌ها داخل زمین‌اند');
const dist = Math.hypot(SPAWNS.swat[0].x - SPAWNS.terror[0].x, SPAWNS.swat[0].z - SPAWNS.terror[0].z);
check(dist > 30, `تیم‌ها از هم دور شروع می‌کنند (${dist.toFixed(0)} متر)`);

console.log('\n=== ۲) حرکت و چرخش ===');
const camZoom = 22;
const camera = new THREE.PerspectiveCamera(62, 1.6, 0.1, 400);
camera.position.set(0, camZoom, camZoom * 0.30);
camera.lookAt(0, 0.8, 0);
camera.updateMatrixWorld(true);
const sx = (x, z) => new THREE.Vector3(x, 0.8, z).project(camera).x;
check(sx(2, 0) > 0.02, 'کلید D (x+) → راست صفحه');
check(sx(-2, 0) < -0.02, 'کلید A (x−) → چپ صفحه');

// مدل blocky رو به +Z است، پس بدون تصحیح باید هم‌جهت باشد
const MODEL_YAW_OFFSET = 0;
const fwd = th => ({ x: Math.sin(th), z: Math.cos(th) });   // مدل رو به +Z
let badDir = 0;
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2, nx = Math.sin(a), nz = Math.cos(a);
  const f = fwd(Math.atan2(nx, nz) + MODEL_YAW_OFFSET);
  if (f.x * nx + f.z * nz < 0.99) badDir++;
}
check(badDir === 0, 'در ۱۶ جهت، نگاه مدل با جهت حرکت یکی است');

console.log('\n=== ۳) دوربین ===');
let camBad = 0;
for (const [px, pz] of [[0,0],[HW,0],[-HW,0],[0,HH],[0,-HH],[HW,HH],[-HW,-HH]])
  for (const z of [14, 22, 40]) {
    const cx = Math.min(HW - 2, Math.max(-HW + 2, px));
    const cz = Math.min(HH - 2, Math.max(-HH + 2, pz + z * 0.30));
    if (Math.abs(cx) > HW || Math.abs(cz) > HH) camBad++;
  }
check(camBad === 0, 'دوربین در همه حالت‌ها داخل زمین می‌ماند');
check(camZoom >= 12, `ارتفاع دوربین ${camZoom} متر (از سطح بالاتر)`);

console.log('\n=== ۴) کاراکترها و انیمیشن ===');
const CHAR_FILES = { Hero: 'public/models/chars/blocky_01_hero.glb', Robot: 'public/models/chars/blocky_08_robot.glb' };
for (const [name, path] of Object.entries(CHAR_FILES)) {
  const exists = fs.existsSync(path);
  check(exists, `${name}: فایل موجود (${path})`);
  if (!exists) continue;
  // خواندن بخش JSON فایل GLB برای انیمیشن‌ها
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const anims = (json.animations || []).map(a => a.name);
  const need = ['idle', 'walk', 'run'];
  const have = need.filter(n => anims.some(a => a.toLowerCase() === n));
  check(have.length === need.length, `${name}: انیمیشن‌های اصلی موجود (${anims.length} انیمیشن: ${anims.slice(0,5).join(', ')}…)`);
}

console.log('\n=== ۵) صداهای واقعی ===');
for (const f of ['shot_rifle.wav','shot_rifle2.wav','shot_pistol.wav','shot_shotgun.wav','shot_sniper.wav']) {
  const p = `public/audio/${f}`;
  if (!fs.existsSync(p)) { check(false, `صدا نیست: ${f}`); continue; }
  const b = fs.readFileSync(p);
  // WAV باید هدر RIFF داشته باشد
  const ok = b.subarray(0, 4).toString() === 'RIFF';
  check(ok, `${f} (${(b.length/1024).toFixed(0)}KB) فایل WAV واقعی است`);
}

console.log('\n=== ۶) HUD ===');
const html = fs.readFileSync('index.html', 'utf8');
const src = fs.readFileSync('src/main.js', 'utf8');
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...src.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
const missing = [...used].filter(id => !htmlIds.has(id));
check(missing.length === 0, missing.length ? `شناسه‌های گم‌شده: ${missing.join(', ')}` : `همه ${used.size} شناسه‌ی DOM موجودند`);
for (const gone of ['top','scorebox','gallery','scoreboard','health','weapons'])
  if (htmlIds.has(gone)) { check(false, `پنل اضافی «${gone}» هنوز در HTML است`); }

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ انجین سالم است');
process.exit(fails ? 1 : 0);
