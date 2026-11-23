// تست منطق دید در تاریکی: آیا بدون چراغ‌قوه کسی کسی را می‌بیند؟
const half = 0.30, range = 24;
const inCone = (observer, px, pz, rotY) => {
  const dx = px - observer.x, dz = pz - observer.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  const cos = (dx * Math.sin(rotY) + dz * Math.cos(rotY)) / (dist || 1);
  return cos >= Math.cos(half);
};

const A = { x: 0, z: 0, rotY: 0 };          // ناظر رو به +Z
const cases = [
  ['جلوی ناظر، ۸ متر', 0, 8, true],
  ['جلوی ناظر، ۳۰ متر (خارج برد)', 0, 30, false],
  ['پشت ناظر، ۵ متر', 0, -5, false],
  ['کنار ناظر ۹۰ درجه', 6, 0.1, false],
  ['لبه مخروط (۱۵ درجه)', Math.tan(0.26) * 8, 8, true],
  ['کمی بیرون مخروط (۲۵ درجه)', Math.tan(0.44) * 8, 8, false],
];
let pass = 0, fail = 0;
for (const [name, x, z, expect] of cases) {
  const got = inCone(A, x, z, A.rotY);
  const ok = got === expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${name}: ${got ? 'دیده می‌شود' : 'پنهان'} (انتظار: ${expect ? 'دیده' : 'پنهان'})`);
}

// سناریو: چراغ خاموش → هیچ‌کس دیده نمی‌شود مگر نزدیک‌تر از ۲.۶ متر
const spots = [[0, 5], [10, 10], [-8, 3], [3, 18]];
let visibleWhenOff = 0;
for (const [x, z] of spots) {
  const d = Math.hypot(x, z);
  const seen = (false && inCone(A, x, z, 0)) || d < 2.6;
  if (seen) visibleWhenOff++;
  console.log(`  چراغ خاموش، هدف در (${x},${z}) فاصله ${d.toFixed(1)}m → ${seen ? 'دیده' : 'پنهان'}`);
}
console.log(`\n${pass} تست قبول، ${fail} رد | در تاریکی ${visibleWhenOff} هدف دیده شد (باید ۰ باشد)`);
