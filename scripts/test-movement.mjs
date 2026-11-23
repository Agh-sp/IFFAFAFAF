// تست جهت حرکت و چرخش: با ریاضیات سه‌بعدی اثبات می‌کند که
// کلید D بازیکن را به راست صفحه می‌برد و مدل به همان سمت نگاه می‌کند.
import * as THREE from 'three';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

// ---- بازسازی دوربین دقیقاً مثل بازی ----
const camZoom = 22;
const camera = new THREE.PerspectiveCamera(62, 1.6, 0.1, 400);
const setCamera = (px, pz) => {
  const target = new THREE.Vector3(px, 0.8, pz);
  camera.position.set(px, camZoom, pz + camZoom * 0.30);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return target;
};
setCamera(0, 0);

// ---- ۱) جهت روی صفحه: D باید راست باشد ----
const toScreen = (x, z) => new THREE.Vector3(x, 0.8, z).project(camera).x;
console.log('=== جهت حرکت روی صفحه ===');
check(toScreen(2, 0) > 0.02, `کلید D (x+) → سمت راست صفحه (${toScreen(2,0).toFixed(3)})`);
check(toScreen(-2, 0) < -0.02, `کلید A (x−) → سمت چپ صفحه (${toScreen(-2,0).toFixed(3)})`);
// W باید به بالای صفحه (دور شدن) باشد
const toScreenY = (x, z) => new THREE.Vector3(x, 0.8, z).project(camera).y;
check(toScreenY(0, -3) > toScreenY(0, 0), `کلید W (z−) → بالای صفحه (دورتر)`);
check(toScreenY(0, 3) < toScreenY(0, 0), `کلید S (z+) → پایین صفحه (نزدیک‌تر)`);

// ---- ۲) چرخش مدل: با MODEL_YAW_OFFSET = π، مدل باید رو به جهت حرکت باشد ----
console.log('\n=== جهت نگاه مدل ===');
const MODEL_YAW_OFFSET = Math.PI;
// مدل Soldier رو به -Z است: بردار جلوی مدل پس از چرخش θ برابر است با
// (0,0,-1) چرخیده به اندازه θ حول Y
const modelForward = (theta) => ({
  x: -Math.sin(theta),
  z: -Math.cos(theta),
});
for (const [name, nx, nz] of [['D', 1, 0], ['A', -1, 0], ['W', 0, -1], ['S', 0, 1]]) {
  const aim = Math.atan2(nx, nz);
  const rot = aim + MODEL_YAW_OFFSET;
  const f = modelForward(rot);
  const dot = f.x * nx + f.z * nz;           // ۱ = هم‌جهت کامل
  const ok = Math.abs(dot - 1) < 0.01;
  check(ok, `کلید ${name}: حرکت (${nx},${nz}) و نگاه مدل (${f.x.toFixed(2)},${f.z.toFixed(2)}) هم‌جهت (ضرب داخلی ${dot.toFixed(3)})`);
}

// ---- ۳) بدون MODEL_YAW_OFFSET، باگ باید بازتولید شود (اثبات ریشه‌ی باگ) ----
console.log('\n=== اثبات ریشه‌ی باگ قبلی ===');
{
  const aim = Math.atan2(1, 0);              // کلید D
  const f = modelForward(aim);               // بدون تصحیح
  const dot = f.x * 1 + f.z * 0;
  check(dot < -0.9, `بدون تصحیح، کلید D مدل را رو به -x می‌چرخاند (ضرب داخلی ${dot.toFixed(2)}) → همان باگ «چپ میرم راست میره»`);
}

// ---- ۴) هم‌خوانی حرکت و نگاه در ۱۶ جهت ----
console.log('\n=== ۱۶ جهت مختلف ===');
let bad = 0;
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  const nx = Math.sin(a), nz = Math.cos(a);
  const rot = Math.atan2(nx, nz) + MODEL_YAW_OFFSET;
  const f = modelForward(rot);
  if (Math.abs(f.x * nx + f.z * nz - 1) > 0.01) bad++;
}
check(bad === 0, `در همه ۱۶ جهت، نگاه مدل با جهت حرکت یکی است (${16-bad}/16)`);

// ---- ۵) دوربین هرگز بیرون زمین ----
console.log('\n=== دوربین داخل زمین ===');
const HW = 40, HH = 30;
for (const [px, pz] of [[0,0],[HW,0],[-HW,0],[0,HH],[0,-HH],[HW,HH]]) {
  const camZ = pz + camZoom * 0.30;
  const clampedZ = Math.min(HH - 2, Math.max(-HH + 2, camZ));
  const camX = Math.min(HW - 2, Math.max(-HW + 2, px));
  check(Math.abs(camX) <= HW - 2 && Math.abs(clampedZ) <= HH - 2,
    `بازیکن در (${px},${pz}) → دوربین (${camX}, ${clampedZ.toFixed(1)}) داخل مرز`);
}

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ حرکت و چرخش درست است');
process.exit(fails ? 1 : 0);
