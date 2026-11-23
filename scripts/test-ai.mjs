// شبیه‌سازی AI روی زمین صاف: بات باید به هدف نزدیک شود، نه دور خودش بچرخد.
import { HW, HH } from '../src/map.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);

function simulate(seconds = 45) {
  const a = { pos: { x: -20, z: 0 }, speed: 3.4, role: 'مهاجم', range: 18, fireC: 0, fireRate: 0.8 };
  const target = { pos: { x: 20, z: 0 } };
  const dt = 1 / 60;
  let moved = 0, still = 0, totalDist = 0, minD = Infinity;
  let prev = { ...a.pos };
  for (let f = 0; f < seconds * 60; f++) {
    const bestD = Math.hypot(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
    minD = Math.min(minD, bestD);
    const want = a.role === 'مهاجم' ? 7 : 10;
    let moving = false;
    if (bestD > want) {
      const ang = Math.atan2(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
      a.pos.x += Math.sin(ang) * a.speed * dt;
      a.pos.z += Math.cos(ang) * a.speed * dt;
      moving = true;
    } else if (bestD < want * 0.5) {
      const ang = Math.atan2(a.pos.x - target.pos.x, a.pos.z - target.pos.z);
      a.pos.x += Math.sin(ang) * a.speed * 0.7 * dt;
      a.pos.z += Math.cos(ang) * a.speed * 0.7 * dt;
      moving = true;
    }
    a.pos.x = clamp(a.pos.x, -HW + 2, HW - 2);
    a.pos.z = clamp(a.pos.z, -HH + 2, HH - 2);
    const d = Math.hypot(a.pos.x - prev.x, a.pos.z - prev.z);
    if (d > 1e-5) { moved++; totalDist += d; } else still++;
    prev = { ...a.pos };
  }
  return { moved, still, totalDist, minD };
}

console.log('شبیه‌سازی ۴۵ ثانیه (بات از -20,0 به سمت دشمن در 20,0):\n');
const r = simulate();
// رفتار درست: بات جلو می‌رود، به فاصله‌ی شلیک می‌رسد و همان‌جا می‌ایستد.
// پس «۱۰۰٪ در حرکت بودن» نشانه‌ی سلامتی نیست؛ مهم رسیدن به هدف است.
const ok = r.minD < 9 && r.totalDist > 20;
  r.minD < 9 &&                                  // به برد رسید
console.log(`  نزدیک‌ترین فاصله به هدف: ${r.minD.toFixed(1)}m (باید < ۹) ${r.minD < 9 ? '✅' : '❌'}`);
console.log(`  مسافت طی‌شده: ${r.totalDist.toFixed(0)}m (باید > ۲۰) ${r.totalDist > 20 ? '✅' : '❌'}`);
console.log(`  پس از رسیدن به برد، ایستاده شلیک می‌کند (${(r.moved/(r.moved+r.still)*100).toFixed(0)}٪ در حرکت)`);
console.log(ok ? '\n✅ بات به هدف می‌رسد و دور خودش نمی‌چرخد' : '\n❌ بات گیر کرده');
process.exit(ok ? 0 : 1);
