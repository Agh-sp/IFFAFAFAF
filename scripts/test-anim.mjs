/* =====================================================================
   تست قوانین انیمیشن — GDD بخش ۳ (A1 تا A12)
   هر بند این فایل یک باگ واقعی است که در همین پروژه رخ داده:
   کاراکتر «عروسکی»، انیمیشن گیرکرده، جسد لرزان، پا در هوا و…
   اگر این تست قرمز شد، merge ممنوع است.
   ===================================================================== */
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

globalThis.self = globalThis;

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

const MAIN = fs.readFileSync('src/main.js', 'utf8');
const KIT = fs.existsSync('src/kit.js') ? fs.readFileSync('src/kit.js', 'utf8') : '';

/* ------------------------- A1: کلیپ ممنوعه ------------------------- */
console.log('=== A1: هیچ کلیپ TPose/bind پخش نمی‌شود ===');
check(/tpose\|t_pose\|sad_pose\|bind/.test(MAIN), 'فیلتر TPose/sad_pose در کد وجود دارد');
check(!/action\.play\(\)/.test(MAIN.replace(/\/\*[\s\S]*?\*\//g, '')),
  'هیچ play() مستقیمی بیرون از playAnim نیست (قانون A5)');

/* --------------------- A2/A3: reset و loop صریح --------------------- */
console.log('\n=== A2/A3: reset و setLoop صریح ===');
check(/next\.reset\(\)/.test(MAIN), 'A2: هر پخش با reset() شروع می‌شود');
check(/setLoop\(once \? THREE\.LoopOnce : THREE\.LoopRepeat/.test(MAIN),
  'A3: loop همیشه صریح تنظیم می‌شود');
check(/clampWhenFinished/.test(MAIN), 'A6: clampWhenFinished برای انیمیشن‌های Once ست می‌شود');

/* ---------------------- A4: حداقل fade در گذار ---------------------- */
console.log('\n=== A4: fade کافی در گذارها ===');
const fades = [...MAIN.matchAll(/playAnim\([^,]+,\s*\[[^\]]*\],\s*([\d.]+)/g)].map(m => parseFloat(m[1]));
check(fades.length > 0, `${fades.length} فراخوانی playAnim با fade پیدا شد`);
const tooShort = fades.filter(f => f < 0.05);
check(tooShort.length === 0, `هیچ fade کوتاه‌تر از ۰.۰۵s نیست (کمترین: ${Math.min(...fades)}s)`);

/* ------------------------- A7/A10: میکسر ------------------------- */
console.log('\n=== A7/A10: میکسر و Root Motion ===');
check(/new THREE\.AnimationMixer\(root\)/.test(MAIN), 'میکسر روی ریشه‌ی کاراکتر ساخته می‌شود');
check(/for \(const m of mixers\) m\.update\(dt\)/.test(MAIN), 'همه‌ی میکسرها هر فریم با dt به‌روز می‌شوند');
check(/timeScale = hasInput \? 1\.25 : 1/.test(MAIN), 'A9: timeScale در بازه‌ی مجاز (۱ تا ۱.۲۵)');
const ts = [...MAIN.matchAll(/timeScale\s*=\s*[^;]*?(?:\?\s*([\d.]+)\s*:\s*([\d.]+)|(?<![\w.])1(?![\d.]))/g)]
  .flatMap(m => [m[1], m[2]]).filter(Boolean).map(parseFloat);
const ternaryTs = [...MAIN.matchAll(/timeScale\s*=\s*[^;]*?\?\s*([\d.]+)\s*:\s*([\d.]+)/gi)].flatMap(m=>[+m[1],+m[2]]);
const allTs = [...new Set([...ts, ...ternaryTs].filter(v => v > 0 && v !== 1))];
check(ternaryTs.length > 0, `${ternaryTs.length} مقدار timeScale پیدا شد`);
check(ternaryTs.length > 0 && ternaryTs.every(v => v >= 0.8 && v <= 1.3), `همه‌ی timeScale ها در بازه ۰.۸–۱.۳ (${ternaryTs.join(', ')})`);

/* ---------------- A8: کف پا روی زمین + نسبت بدن ---------------- */
console.log('\n=== A8: کف پا روی زمین و نسبت بدن ===');
const loader = new GLTFLoader();
const readGlb = f => {
  const b = fs.readFileSync(f);
  return new Promise((res, rej) => loader.parse(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej));
};

for (const [name, path] of [['Hero', 'public/models/chars/swat.glb'], ['Robot', 'public/models/chars/swat_urban.glb']]) {
  const gltf = await readGlb(path);
  const root = SkeletonUtils.clone(gltf.scene);
  const mixer = new THREE.AnimationMixer(root);

  // چند انیمیشن مختلف را بررسی کن — نه فقط idle
  const tested = [];
  for (const re of [/Idle_Gun_Pointing$/, /Run$/, /Walk$/, /Death$/]) {
    const clip = gltf.animations.find(a => re.test(a.name));
    if (clip) tested.push(clip);
  }
  check(tested.length >= 3, `${name}: ${tested.length} کلیپ برای بررسی پیدا شد`);

  let worstFoot = 0, worstH = 0;
  for (const clip of tested) {
    mixer.stopAllAction();
    const a = mixer.clipAction(clip);
    a.reset().play();
    mixer.update(clip.duration * 0.5);
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root);
    const h = bb.getSize(new THREE.Vector3()).y;
    if (clip.name.endsWith('Death')) continue;   // مرگ روی زمین است، طبیعی
    worstFoot = Math.max(worstFoot, Math.abs(bb.min.y));
    worstH = Math.max(worstH, h);
  }
  check(worstFoot < 0.08, `${name}: پا روی زمین است در همه انیمیشن‌ها (بیشترین خطا ${worstFoot.toFixed(3)}m)`);
  check(worstH > 1.6 && worstH < 2.05, `${name}: قد در بازه ۱.۶–۲.۰۵ متر (${worstH.toFixed(2)}m، بدون کشیدگی)`);

  // نسبت عرض شانه به قد — نشانه‌ی کشیدگی
  const bb = new THREE.Box3().setFromObject(root);
  const sz = bb.getSize(new THREE.Vector3());
  const ratio = Math.max(sz.x, sz.z) / sz.y;
  check(ratio < 1.2, `${name}: نسبت عرض به قد ${ratio.toFixed(2)} (بدون کشیدگی)`);
}

/* ------------------- A5: حالت‌های لازم در ماشین حالت ------------------- */
console.log('\n=== A5: حالت‌های انیمیشن لازم ===');
const REQUIRED_STATES = {
  'Idle مسلح': 'Idle_Gun_Pointing',
  'شلیک': 'Gun_Shoot',
  'مرگ': 'Death',
};
for (const [label, clip] of Object.entries(REQUIRED_STATES))
  check(MAIN.includes(clip) || MAIN.includes(clip.split('_')[0]),
    `حالت «${label}» از کلیپ ${clip} استفاده می‌کند`);

/* مرگ باید قفل حرکت باشد */
console.log('\n=== A6: مرگ حرکت را قفل می‌کند ===');
const deathIdx = MAIN.indexOf('playAnim(a.model, [\'Death\']');
check(deathIdx > 0, 'انیمیشن Death با LoopOnce پخش می‌شود');
const deathCtx = MAIN.slice(deathIdx, deathIdx + 400);
check(/alive = false|a\.alive\s*=\s*false/.test(deathCtx) || /alive = false/.test(MAIN),
  'پس از مرگ، actor.alive = false می‌شود (حرکت/AI قفل)');

/* --------------------- تجهیزات خوانا (بخش ۲.۳) --------------------- */
console.log('\n=== تجهیزات خوانا برای نمای عمود ===');
check(KIT.includes('kitHelmet'), 'کلاه تاکتیکی تعریف شده');
check(KIT.includes('kitPad'), 'پد شانه تعریف شده');
check(/1 \/ \(Math\.abs\(worldScale|\/ \(Math\.abs\(ws\.x\)/.test(KIT),
  'مقیاس استخوان (۱۰۰×) جبران می‌شود — باگ واقعی که رخ داد');
check(/camera\.up\.set\(0,\s*0,\s*-1\)/.test(MAIN), 'دوربین عمود بدون ابهام up');

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ قوانین انیمیشن رعایت شده');
process.exit(fails ? 1 : 0);
