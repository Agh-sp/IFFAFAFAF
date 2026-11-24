/* =====================================================================
   سیستم دید و نور — قلب «تاریکی واقعی»
   ---------------------------------------------------------------------
   قاعده‌ی بنیادی: نور = اطلاعات.
   هر چیزی روشن است دیده می‌شود؛ هر چیزی در تاریکی است، وجود ندارد.

   چرا این ماژول لازم است؟
   AI قبلی فقط فاصله را می‌سنجید (`flatDist`) و بدون هیچ بررسی نوری
   شلیک می‌کرد. نتیجه: بازیکن با چراغ‌قوه‌ی خاموش در تاریکی مطلق
   هدف گلوله بود. این ماژول همان باگ را ریشه‌کن می‌کند.
   ===================================================================== */

/* ---------------- ثابت‌های حس‌شده، نه حدسی ---------------- */
export const LIGHT = {
  ambient: 0.05,        // نور محیط: تقریباً هیچ، ولی صفر نه (تله‌ی سیاه مطلق)
  visible: 0.22,        // آستانه‌ی دیده‌شدن
  touchRange: 2.5,      // زیر این فاصله، حتی در تاریکی حس می‌شود (صدا/لمس)
};

export const CONE = {
  player:  { angle: 0.34, range: 22, intensity: 1.0 },   // زاویه‌ی نیم‌باز (رادیان) ≈ ۱۹°
  ai:      { angle: 0.30, range: 14, intensity: 0.8 },
  static:  { angle: 0.60, range: 8,  intensity: 0.4 },
};

/* سنبه‌ی نرم: ۱ در مرکز، ۰ در لبه */
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/* ---- آیا نقطه‌ی p داخل مخروط نوری با مبدأ org و جهت dir است؟ ----
   برمی‌گرداند ۰ تا ۱ (شدت).
   سه افت:
     ۱) افت طولی: ابتدای مخروط کامل، انتها محو
     ۲) افت زاویه‌ای: مرکز کامل، لبه محو
     ۳) برد: بیرون از برد صفر */
export function coneIntensity(org, dir, p, cfg) {
  const dx = p.x - org.x, dz = p.z - org.z;
  const dist = Math.hypot(dx, dz);
  if (dist > cfg.range) return 0;
  if (dist < 0.001) return cfg.intensity;

  // زاویه نسبت به جهت مخروط
  const cos = (dx * dir.x + dz * dir.z) / dist;
  const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
  if (ang > cfg.angle) return 0;

  const along = smoothstep(0, 0.12, dist / cfg.range) *
                (1 - smoothstep(0.7, 1.0, dist / cfg.range));
  const angular = 1 - smoothstep(0.45, 1.0, ang / cfg.angle);
  return cfg.intensity * along * angular;
}

/* ---- مقدار نور در یک نقطه ----
   sources: [{ org:{x,z}, dir:{x,z}, cfg, on:boolean }] */
export function lightLevel(p, sources) {
  let v = LIGHT.ambient;
  for (const s of sources) {
    if (!s.on) continue;
    v += coneIntensity(s.org, s.dir, p, s.cfg);
  }
  return v;
}

/* ---- آیا a می‌تواند t را ببیند؟ ----
   ترتیب شرط‌ها از ارزان به گران است (این ترتیب مهم است). */
export const LIT_SIGHT = 22;   // کسی که خودش روشن است، از این فاصله دیده می‌شود

export function canSee(a, t, sources, los) {
  const dx = t.x - a.x, dz = t.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d < LIGHT.touchRange) return true;      // ۱) حس نزدیک (بدون شرط نور)

  /* ۲) برد مؤثر: هر کدام بیشتر باشد
     - برد دید خودِ ناظر (وابسته به چراغ‌قوه‌ی خودش)
     - برد «هدفِ روشن»: کسی که چراغش روشن است یا زیر نور دیگری است،
       حتی برای ناظرِ چراغ‌خاموش هم از دور دیده می‌شود.
     بدون این، یک بازیکنِ کاملاً روشن در ۱۰ متریِ بات دیده نمی‌شد — که
     هم غیرواقعی است، هم بازی را سخت و بی‌منطق می‌کرد. */
  const lit = lightLevel(t, sources);
  const effRange = lit > LIGHT.visible ? Math.max(a.viewRange, LIT_SIGHT) : a.viewRange;
  if (d > effRange) return false;

  if (los && !los(a, t)) return false;        // ۳) خط دید واقعی (دیوار)
  return lit > LIGHT.visible;                 // ۴) نور
}

/* ---- برد دید یک AI، وابسته به چراغ‌قوه‌ی خودش ----
   چراغ خاموش = تقریباً کور. این همان چیزی است که بازی را تاکتیکال می‌کند. */
export function viewRangeOf(lightOn, base = 16) {
  /* چراغ خاموش = دید کوتاه ولی نه صفر. ۶ متر «چشم عادت‌کرده به تاریکی»
     است: کسی که چراغ خودش را خاموش کرده، هنوز چیزهای روشن را در
     فاصله‌ی نزدیک می‌بیند. عدد ۴ خیلی سخت بود و بازی را به «همه کور» می‌برد. */
  return lightOn ? base : 6;
}
