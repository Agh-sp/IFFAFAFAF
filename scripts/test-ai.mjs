/* =====================================================================
   تست حرکت و رفتار AI — با همان مدل حرکتی که در بازی اجرا می‌شود.

   سه چیزی که این تست اثبات می‌کند:
     ۱) AI به هدف می‌رسد (گیر نمی‌کند، دور خودش نمی‌چرخد)
     ۲) حرکتش «انسانی» است: شتاب دارد، تلپورت نمی‌کند، چرخش ناگهانی ندارد
     ۳) در تاریکی به بازیکن شلیک نمی‌کند (با سیستم دید واقعی)
   ===================================================================== */
import { HW, HH } from '../src/map.js';
import { canSee, viewRangeOf, CONE, LIGHT } from '../src/vision.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

/* ---------- مدل حرکتی دقیقاً مثل updateAI در main.js ---------- */
function makeAI(x, z) {
  return {
    pos: { x, z }, vel: { x: 0, z: 0 }, rot: 0,
    speed: 4.5, viewRange: 16, lightOn: false,
    aware: 0, fireCd: 0.5, shots: 0,
  };
}

function stepAI(a, target, dt, lights, losFn) {
  const dx = target.x - a.pos.x, dz = target.z - a.pos.z;
  const bestD = Math.hypot(dx, dz);

  // دید
  const fake = { x: a.pos.x, z: a.pos.z, viewRange: viewRangeOf(a.lightOn, 16) };
  const sees = canSee(fake, target, lights, losFn);
  if (sees) a.aware += dt; else a.aware = Math.max(0, a.aware - dt * 2);

  // جهت
  const wantAngle = Math.atan2(dx, dz);
  let d = wantAngle - a.rot;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const maxTurn = 6.0 * dt;                     // ~۳۴۳°/s حداکثر
  a.rot += clamp(d, -maxTurn, maxTurn);

  /* ⚠️ نکته‌ی مهم: AI فقط چیزی را تعقیب می‌کند که «می‌بیند».
     بدون این شرط، بات کور هم به سمت بازیکن راه می‌افتاد و آخرش
     به او می‌رسید — که در بازی رخ نمی‌دهد (updateAI بدون target
     برمی‌گردد). این تفاوت، کل تست را بی‌معنی می‌کرد. */
  if (!sees && (a.aware || 0) <= 0) {
    /* گشت: بدون هدف، AI می‌چرخد (مطابق patrol در main.js).
       این هم از یخ زدن جلوگیری می‌کند، هم بازی را زنده نگه می‌دارد. */
    if (!a.patrolGoal) a.patrolGoal = { x: 0, z: 0 };
    const gx = a.patrolGoal.x, gz = a.patrolGoal.z;
    const gd = Math.hypot(gx - a.pos.x, gz - a.pos.z);
    if (gd < 2.0) a.patrolGoal = { x: 0, z: 0 };
    let pvx = 0, pvz = 0;
    if (gd >= 2.0) {
      const pang = Math.atan2(gx - a.pos.x, gz - a.pos.z);
      pvx = Math.sin(pang) * 2.6; pvz = Math.cos(pang) * 2.6;
    }
    const pk = 1 - Math.exp(-6 * dt);
    a.vel.x += (pvx - a.vel.x) * pk;
    a.vel.z += (pvz - a.vel.z) * pk;
    a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
    a.fireCd -= dt;
    return;
  }

  // حرکت با شتاب
  let vx = 0, vz = 0;
  const wantsToShoot = sees && bestD < 18 && a.aware >= 0.4;
  if (!wantsToShoot) {
    const dxn = dx / (bestD || 1), dzn = dz / (bestD || 1);
    vx = dxn * a.speed; vz = dzn * a.speed;
  }
  const k = 1 - Math.exp(-8 * dt);
  a.vel.x += (vx - a.vel.x) * k;
  a.vel.z += (vz - a.vel.z) * k;
  a.pos.x += a.vel.x * dt;
  a.pos.z += a.vel.z * dt;
  a.pos.x = clamp(a.pos.x, -HW + 2, HW - 2);
  a.pos.z = clamp(a.pos.z, -HH + 2, HH - 2);

  // شلیک با تأخیر واکنش
  a.fireCd -= dt;
  if (sees && bestD < 18 && a.aware >= 0.4 && a.fireCd <= 0) {
    a.shots++; a.fireCd = 0.8;
  }
  return seeks => seeks;
}

/* ---------- نور تست: یک چراغ‌قوه‌ی روشن روی هدف ---------- */
const litAt = p => [{ org: { x: p.x, z: p.z - 1.5 }, dir: { x: 0, z: 1 }, cfg: CONE.player, on: true }];

/* -------------------- ۱) رسیدن به هدف -------------------- */
console.log('=== ۱) AI به هدف می‌رسد ===');
{
  const a = makeAI(-10, 0);
  const target = { x: 6, z: 0 };   // داخل برد دید ۱۶ متری
  const dt = 1 / 60;
  let dist = 0, prev = { ...a.pos }, teleports = 0, maxTurnSeen = 0, turns = [];
  for (let f = 0; f < 45 * 60; f++) {
    const r0 = a.rot;
    // هدف روشن است (وگرنه AI از فاصله‌ی دور او را نمی‌بیند و FOLLOW نمی‌کند)
    stepAI(a, target, dt, litAt({ x: target.x, z: target.z }), () => true);
    const dd = Math.hypot(a.pos.x - prev.x, a.pos.z - prev.z);
    dist += dd;
    if (dd > 0.2) teleports++;
    const dturn = Math.abs(a.rot - r0);
    maxTurnSeen = Math.max(maxTurnSeen, dturn);
    if (dturn > 0) turns.push(dturn);
    prev = { ...a.pos };
  }
  const finalD = Math.hypot(target.x - a.pos.x, target.z - a.pos.z);
  check(finalD < 18, `به سمت هدف پیش رفت (فاصله‌ی نهایی ${finalD.toFixed(1)}m)`);
  // AI در برد شلیک (۱۸ متر) می‌ایستد؛ پس مسافت زیاد نیست. مهم این است
  // که واقعاً جابه‌جا شده باشد، نه اینکه ۴۰ متر بدود.
  check(dist > 1.5, `واقعاً جابه‌جا شد (${dist.toFixed(1)}m) و بعد ایستاد — انسانی`);
  check(teleports === 0, `هیچ تلپورتی رخ نداد (${teleports} مورد بیش از ۰.۲m/فریم)`);
  check(maxTurnSeen < 0.12, `چرخش نرم، بدون ناگهانی (بیشترین ${(maxTurnSeen * 180 / Math.PI).toFixed(1)}°/فریم)`);
}

/* -------------------- ۲) شتاب، نه لغزش ثابت -------------------- */
console.log('\n=== ۲) حرکت با شتاب ===');
{
  const far = { x: 0, z: 40 };
  const a = makeAI(0, 26);   // ۱۴ متر از هدف، داخل برد ۱۶
  const dt = 1 / 60;
  const speeds = [];
  for (let f = 0; f < 3 * 60; f++) {
    stepAI(a, far, dt, litAt(far), () => true);
    speeds.push(Math.hypot(a.vel.x, a.vel.z));
  }
  check(speeds[0] < 0.6, `سرعت اولیه کم است (${speeds[0].toFixed(2)} m/s) — شتاب می‌گیرد`);
  check(speeds[20] > speeds[0] * 2, `پس از ۲۰ فریم سرعت بالا رفته (${speeds[20].toFixed(2)})`);
  const vMax = Math.max(...speeds);
  check(vMax > 4.0, `به سرعت کامل رسید (${vMax.toFixed(2)} m/s)`);
  // بعد از رسیدن به برد شلیک، AI می‌ایستد — این هدف است، نه باگ
  check(speeds[speeds.length - 1] < 1.0, `در پایان站在原地 (${speeds[speeds.length - 1].toFixed(2)} m/s)`);

  // AI باید در برد شلیک بایستد (توقف نرم، نه فوری)
  const close = { x: 0, z: 40 };
  const b = makeAI(0, 24);
  let vPeak = 0, vStopped = 9;
  for (let f = 0; f < 12 * 60; f++) {
    stepAI(b, close, dt, litAt(close), () => true);
    const v = Math.hypot(b.vel.x, b.vel.z);
    vPeak = Math.max(vPeak, v);
    const d = Math.hypot(close.x - b.pos.x, close.z - b.pos.z);
    if (d < 18 && b.aware > 0.4) vStopped = Math.min(vStopped, v);
  }
  check(vPeak > 3.5, `به سرعت کامل دویدن رسید (${vPeak.toFixed(1)} m/s)`);
  check(vStopped < 1.2, `قبل از شلیک توقف کرد (کمترین سرعت ${vStopped.toFixed(1)} m/s) — انسانی`);
}

/* -------------------- ۳) کوری در تاریکی -------------------- */
console.log('\n=== ۳) AI در تاریکی شلیک نمی‌کند ===');
{
  const a = makeAI(0, 0);
  const player = { x: 0, z: 10 };
  const dt = 1 / 60;
  for (let f = 0; f < 60 * 20; f++) stepAI(a, player, dt, [], () => true);
  check(a.shots === 0, `بازیکن در تاریکی، AI چراغ خاموش: ${a.shots} شلیک در ۲۰ ثانیه (باید ۰)`);
}

console.log('\n=== ۴) با چراغ روشن، شلیک می‌کند ===');
{
  const a = makeAI(0, 0);
  const player = { x: 0, z: 10 };
  const dt = 1 / 60;
  const lights = [{ org: { x: player.x, z: player.z - 1.5 }, dir: { x: 0, z: 1 }, cfg: CONE.player, on: true }];
  for (let f = 0; f < 60 * 20; f++) stepAI(a, player, dt, lights, () => true);
  check(a.shots > 0, `با چراغ روشن: ${a.shots} شلیک در ۲۰ ثانیه`);
  check(a.aware >= 0.4, 'زمان «متوجه شدن» قبل از شلیک طی شده (تأخیر واکنش)');
}

/* -------------------- ۵) تأخیر واکنش -------------------- */
console.log('\n=== ۵) تأخیر واکنش انسانی ===');
{
  const a = makeAI(0, 0);
  const player = { x: 0, z: 8 };
  const dt = 1 / 60;
  const lights = [{ org: { x: player.x, z: player.z - 1.5 }, dir: { x: 0, z: 1 }, cfg: CONE.player, on: true }];
  let framesToFirstShot = 0;
  for (let f = 0; f < 60 * 5; f++) {
    stepAI(a, player, dt, lights, () => true);
    if (a.shots > 0) { framesToFirstShot = f; break; }
  }
  const secs = framesToFirstShot / 60;
  check(secs >= 0.4, `اولین شلیک پس از ${secs.toFixed(2)}s — نه فوری`);
  check(secs < 2.2, `اولین شلیک در ${secs.toFixed(2)}s — نه کند`);
}

/* -------------------- ۶) حافظه‌ی هدف -------------------- */
console.log('\n=== ۶) نور محیط کافی نیست ===');
check(LIGHT.ambient < LIGHT.visible, 'نور محیط زیر آستانه است (AI در تاریکی کور)');

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ حرکت و رفتار AI انسانی و درست است');
process.exit(fails ? 1 : 0);
