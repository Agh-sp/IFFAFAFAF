/* =====================================================================
   تست سیستم تاریکی و دید — اثبات عددی، نه ادعا.

   باگ اصلی: «AI در تاریکی مطلق هم بازیکن را می‌بیند و شلیک می‌کند.»
   این تست همان سناریو را بازسازی می‌کند و می‌سنجد.
   ===================================================================== */
import { canSee, lightLevel, coneIntensity, viewRangeOf, LIGHT, CONE } from '../src/vision.js';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

const P = (x, z) => ({ x, z });
const dirOf = ang => ({ x: Math.sin(ang), z: Math.cos(ang) });

/* -------------------- ۱) ریاضیات مخروط نور -------------------- */
console.log('=== ۱) مخروط نور ===');
const org = P(0, 0);
const cfg = CONE.player;

check(coneIntensity(org, dirOf(0), P(0, 5), cfg) > 0.8, 'مستقیم جلو و نزدیک: شدت بالا');
check(coneIntensity(org, dirOf(0), P(0, 25), cfg) === 0, 'بیرون از برد: صفر');
check(coneIntensity(org, dirOf(0), P(0, -5), cfg) === 0, 'پشت سر: صفر');
check(coneIntensity(org, dirOf(0), P(5, 0.2), cfg) === 0, 'کنارِ ۹۰ درجه: صفر');

// افت نرم در لبه‌ی زاویه‌ای
const center = coneIntensity(org, dirOf(0), P(0, 8), cfg);
const aEdge = cfg.angle * 0.95;
const edge = coneIntensity(org, dirOf(0), P(Math.sin(aEdge) * 8, Math.cos(aEdge) * 8), cfg);
check(edge < center * 0.35, `لبه‌ی مخروط نرم است (مرکز ${center.toFixed(2)}، لبه ${edge.toFixed(2)})`);

// پیوستگی: بدون پرش ناگهانی
let maxJump = 0, prev = null;
for (let a = -0.6; a <= 0.6; a += 0.004) {
  const p = P(Math.sin(a) * 10, Math.cos(a) * 10);
  const v = coneIntensity(org, dirOf(0), p, cfg);
  if (prev !== null) maxJump = Math.max(maxJump, Math.abs(v - prev));
  prev = v;
}
check(maxJump < 0.06, `بدون پرش ناگهانی در لبه (بیشترین تغییر ${maxJump.toFixed(3)})`);

/* -------------------- ۲) جمع نور -------------------- */
console.log('\n=== ۲) مقدار نور در نقطه ===');
const src = (pos, ang, c = CONE.player) => ({ org: pos, dir: dirOf(ang), cfg: c, on: true });

const dark = lightLevel(P(0, 0), []);
check(Math.abs(dark - LIGHT.ambient) < 1e-6, `در تاریکی مطلق فقط ${dark} (نور محیط)`);
check(dark < LIGHT.visible, 'تاریکی مطلق زیر آستانه‌ی دیده‌شدن است ← کسی دیده نمی‌شود');

const lit = lightLevel(P(0, 5), [src(P(0, 0), 0)]);
check(lit > LIGHT.visible, `در مخروط نور ${lit.toFixed(2)} ← دیده می‌شود`);

// دو چراغ‌قوه روی هم
const both = lightLevel(P(0, 5), [src(P(0, 0), 0), src(P(0, 10), Math.PI)]);
check(both > lit, `دو نور روی هم روشن‌تر است (${lit.toFixed(2)} → ${both.toFixed(2)})`);

// چراغ خاموش نباید بشمار بیاید
const offSrc = { ...src(P(0, 0), 0), on: false };
check(lightLevel(P(0, 5), [offSrc]) < LIGHT.visible, 'چراغ خاموش نوری نمی‌دهد');

/* -------------------- ۳) canSee: سناریوی باگ -------------------- */
console.log('\n=== ۳) canSee — همان سناریوی باگ ===');
const losFree = () => true;       // بدون دیوار
const losBlocked = () => false;   // دیوار در میان

const ai = { x: 0, z: 0, viewRange: 16 };
const playerDark = P(0, 8);       // بازیکن در تاریکی، ۸ متر جلو
const playerLit = P(0, 8);

check(!canSee(ai, playerDark, [], losFree),
  '🔴 سناریوی باگ: بازیکن در تاریکی، AI چراغ خاموش → دیده نمی‌شود (قبلاً دیده می‌شد)');

check(canSee(ai, playerLit, [src(P(0, 0), 0)], losFree),
  'بازیکن در مخروط چراغ‌قوه → دیده می‌شود');

check(!canSee(ai, playerLit, [src(P(0, 0), 0)], losBlocked),
  'پشت دیوار حتی با نور → دیده نمی‌شود (خط دید واقعی)');

// نور «دیگری» هم کافی است (مثلاً چراغ اضطراری یا چراغ‌قوه‌ی هم‌تیمی)
check(canSee(ai, playerLit, [src(P(5, 8), Math.PI * 1.5)], losFree),
  'نورِ منبع دیگر (نه خودِ بازیکن) هم او را لو می‌دهد');

/* -------------------- ۴) برد دید وابسته به چراغ -------------------- */
console.log('\n=== ۴) چراغ‌قوه‌ی AI و برد دید ===');
/* ⚠️ قاعده‌ی مهم: کسی که خودش روشن است (زیر نور است) از دور دیده می‌شود،
   حتی اگر ناظر چراغش خاموش باشد. پس این تست‌ها باید نور را از دید هدف
   بگذارند — نه نوری که خود ناظر را روشن می‌کند. */

// AI چراغ خاموش، هدف در ۲۰ متر و کاملاً تاریک → نمی‌بیند
check(!canSee({ x: 0, z: 0, viewRange: viewRangeOf(false, 16) }, P(0, 20), [], losFree),
  'AI با چراغ خاموش، هدفِ تاریک در ۲۰ متر → نمی‌بیند');

// AI چراغ خاموش، هدف روشن در ۱۲ متر → می‌بیند (هدف خودش نور دارد)
const nearDark = P(0, 12);
check(canSee({ x: 0, z: 0, viewRange: viewRangeOf(false, 16) }, nearDark,
  [src(P(0, 12), 0)], losFree),
  'AI با چراغ خاموش، اما هدف روشن در ۱۲ متر → می‌بیند (نورِ هدف او را لو می‌دهد)');

const touch = P(0, 2);
check(canSee({ x: 0, z: 0, viewRange: viewRangeOf(false, 16) }, touch, [], losFree),
  'AI با چراغ خاموش در ۲ متر (حس نزدیک) می‌بیند');

/* -------------------- ۵) شبیه‌سازی ۱۰۰۰ فریم -------------------- */
console.log('\n=== ۵) شبیه‌سازی ۱۰۰۰ فریم — بازیکن در تاریکی ===');
let shots = 0, seenFrames = 0;
const player = P(12, 9);
const enemies = [{ x: 0, z: 0, viewRange: 16, lightOn: false, cd: 0.5 },
                 { x: 24, z: 20, viewRange: 16, lightOn: true, cd: 0.4 }];
const lightsNoPlayer = [src(P(0, 0), 0, CONE.ai), src(P(24, 20), Math.PI, CONE.ai)];
for (let f = 0; f < 1000; f++) {
  for (const e of enemies) {
    if (canSee(e, player, lightsNoPlayer, losFree)) { seenFrames++; if (e.cd <= 0) { shots++; e.cd = 1.0; } }
    e.cd -= 0.016;
  }
}
check(shots === 0, `بازیکن در تاریکی در ۱۰۰۰ فریم: ${shots} گلوله (باید ۰ باشد)`);
check(seenFrames === 0, `AI در ${seenFrames} فریم از ۲۰۰۰ فریم-بات او را دیده (باید ۰ باشد — او در تاریکی است)`);

/* با چراغ روشن، باید دیده شود */
console.log('\n=== ۶) همان سناریو با چراغ‌قوه‌ی روشن ===');
let shots2 = 0;
const lightsWithPlayer = [...lightsNoPlayer, src({ x: player.x, z: player.z - 3 }, 0)];
for (let f = 0; f < 1000; f++) {
  for (const e of enemies) {
    if (e.cd > 0) { e.cd -= 0.016; continue; }
    if (canSee(e, player, lightsWithPlayer, losFree)) { shots2++; e.cd = 1.0; }
  }
}
check(shots2 > 0, `با چراغ‌قوه‌ی روشن: ${shots2} گلوله — بازیکن دیده می‌شود (تعادل)`.replace('گلوله — بازیکن', 'شلیک — بازیکن'));

/* -------------------- ۷) نور محیط صفر نیست -------------------- */
console.log('\n=== ۷) قانون نور ۱ (تله‌ی سیاه مطلق) ===');
check(LIGHT.ambient > 0, `نور محیط ${LIGHT.ambient} — صفحه کاملاً سیاه نمی‌شود`);
check(LIGHT.ambient < LIGHT.visible * 0.5, 'نور محیط به‌قدر کم است که کسی را نشان نمی‌دهد');

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ سیستم تاریکی و دید درست کار می‌کند');
process.exit(fails ? 1 : 0);
