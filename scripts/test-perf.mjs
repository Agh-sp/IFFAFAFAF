/* =====================================================================
   تست عملکرد — شمارش کارهایی که هر فریم انجام می‌شود.

   این تست GPU را نمی‌سنجد (در Node ممکن نیست). چیزی را می‌سنجد که
   *قابل شمارش* است و روی سیستم ضعیف کشنده است:
     - نوشتن DOM در هر فریم
     - تعداد نورهای فعال
     - تعداد draw call تقریبی
     - به‌روزرسانی مینی‌مپ
   ===================================================================== */
import fs from 'node:fs';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

const MAIN = fs.readFileSync('src/main.js', 'utf8');

/* ---------------- ۱) نوشتن DOM در حلقه ---------------- */
console.log('=== ۱) نوشتن DOM در حلقه‌ی رندر ===');

const animateStart = MAIN.indexOf('function animate()');
const animateEnd = MAIN.indexOf('/* ----------------------------- اجرا ----------------------------- */');
const loop = MAIN.slice(animateStart, animateEnd > animateStart ? animateEnd : undefined);

const domWrites = [...loop.matchAll(/\.(style\.\w+|textContent|innerHTML)\s*=/g)].map(m => m[1]);
check(domWrites.length <= 2,
  `فقط ${domWrites.length} نوشتن DOM مستقیم در حلقه (${domWrites.join(', ') || 'هیچ'})`);

// updateHUD باید حافظه‌ی مقدار داشته باشد، نه نوشتن بی‌قید
check(/const _hud = \{/.test(MAIN), 'updateHUD حافظه‌ی مقدار دارد (بدون نوشتن تکراری)');
check(/if \(force \|\| .* !== _hud\./.test(MAIN), 'updateHUD فقط با تغییر مقدار می‌نویسد');

// مینی‌مپ باید محدود شده باشد
check(/mmAcc\s*\+=\s*dt/.test(MAIN), 'مینی‌مپ با شمارنده اجرا می‌شود (نه هر فریم)');
const mmRate = MAIN.match(/mmAcc > 1 \/ (\d+)/);
check(mmRate && +mmRate[1] <= 30, `نرخ مینی‌مپ ${mmRate ? mmRate[1] : '?'} fps (حداکثر ۳۰)`);

/* ---------------- ۲) بودجه‌ی نور ---------------- */
console.log('\n=== ۲) بودجه‌ی نور ===');
check(/MAX_AI_LIGHTS = (\d+)/.test(MAIN), 'چراغ‌قوه‌های AI بودجه دارند');
const budget = +(MAIN.match(/MAX_AI_LIGHTS = (\d+)/)?.[1] || 99);
check(budget <= 3, `حداکثر ${budget} چراغ AI هم‌زمان (باید ≤ ۳)`);

// شمارش نورهای ثابت
const staticLights = [
  ...MAIN.matchAll(/new THREE\.(PointLight|SpotLight|DirectionalLight|AmbientLight)\(/g),
].length;
check(staticLights <= 12, `${staticLights} نور در کد ساخته می‌شود (بودجه: ۱۲)`);

// هیچ نور جدیدی در حلقه ساخته نمی‌شود
const lightsInLoop = (loop.match(/new THREE\.(Point|Spot|Directional)Light/g) || []).length;
check(lightsInLoop === 0, `هیچ نور جدیدی در حلقه ساخته نمی‌شود (${lightsInLoop})`);

/* ---------------- ۳) تخصیص حافظه در حلقه ---------------- */
console.log('\n=== ۳) تخصیص شیء در حلقه (GC spike) ===');
const newVec = (loop.match(/new THREE\.(Vector3|Quaternion|Euler|Matrix4)\(/g) || []).length;
const newArr = (loop.match(/= \[\]/g) || []).length;
check(newVec <= 6, `${newVec} شیء برداری جدید در هر فریم (باید ≤ ۶) — کمتر = بدون پرش GC`);
check(newArr <= 6, `${newArr} آرایه‌ی جدید در هر فریم (باید ≤ ۶)`);

/* ---------------- ۴) هندسه و متریال ---------------- */
console.log('\n=== ۴) دارایی‌ها ===');
const chars = ['public/models/chars/swat.glb', 'public/models/chars/swat_urban.glb'];
let sizeOk = true;
for (const f of chars) {
  const mb = fs.statSync(f).size / 1048576;
  if (mb > 2.0) sizeOk = false;
  console.log(`   ${f}: ${mb.toFixed(2)} MB`);
}
check(sizeOk, 'هر مدل کاراکتر زیر ۲ مگابایت (بارگذاری سریع)');

// چراغ‌های AI باید SpotLight با cost کم باشند
check(/new THREE\.SpotLight\([^)]*16, 0\.30, 0\.4, 1\.2\)/.test(MAIN.replace(/\s+/g, ' ')) ||
  /SpotLight\(team === 'swat'/.test(MAIN), 'چراغ AI با پارامترهای بهینه ساخته می‌شود');

/* ---------------- ۵) رندر ---------------- */
console.log('\n=== ۵) تنظیمات رندر ===');
check(/setPixelRatio\(Math\.min\(devicePixelRatio, 1\.[0-9]\)\)/.test(MAIN),
  'pixelRatio محدود است (نه ۲ یا ۳ روی رتینا)');
check(/shadowMap\.enabled = false/.test(MAIN), 'سایه خاموش است (بودجه‌ی ۴GB)');
check(!/EffectComposer|UnrealBloom/.test(MAIN), 'بدون post-processing سنگین');

/* ---------------- ۶) حلقه‌ی اصلی ---------------- */
console.log('\n=== ۶) حلقه‌ی اصلی ===');
check(/requestAnimationFrame\(animate\)/.test(MAIN), 'حلقه با requestAnimationFrame است');
check(/Math\.min\(clock\.getDelta\(\), 0\.05\)/.test(MAIN), 'dt محدود شده (بدون پرش بعد از تب)');

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ عملکرد در بودجه است');
process.exit(fails ? 1 : 0);
