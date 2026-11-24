/* =====================================================================
   تجهیزات خوانا برای نمای عمود — منبع واحد حقیقت
   هم بازی (src/main.js) و هم ابزار پیش‌نمایش (scripts/render-scene.mjs)
   از همین فایل استفاده می‌کنند تا آنچه تست می‌شود همان چیزی باشد که
   بازیکن می‌بیند.

   چرا این ماژول وجود دارد؟
   در دوربین عمود ۹۰° بازیکن فقط «تاج سر» و «شانه‌ها» را می‌بیند.
   مدل پایه کلاه دارد ولی تاج سر را نمی‌پوشاند، نتیجه: یک دایره‌ی
   رنگ پوست که کل کاراکتر را می‌بلعد و تیم از تیم قابل تشخیص نیست.

   دو پروفایل کاملاً متفاوت (GDD v2 بخش ۲):
     سوات    = کلاه ایمنی براق + پد افقی روشن + کوله‌ی بلند
               ⇒ از بالا: دایره‌ی روشن + خطوط افقی + سرمه‌ای
     تروریست = هودی پارچه‌ای مات + خشاب‌های عمودی + بازوبند قرمز
               ⇒ از بالا: دایره‌ی مات + خطوط عمودی + خاکی + یک نقطه‌ی قرمز
   تفاوت باید در ۰.۲ ثانیه و بدون نگاه دقیق معلوم شود.
   ===================================================================== */
import * as THREE from 'three';

export const TEAM_KIT = {
  swat: {
    head: 0x46607d, headAccent: 0x33465d,
    pad: 0x6a8ab5, padDark: 0x415a7d,
    metal: 0.25, rough: 0.55,        // براق = حرفه‌ای
    hood: false, visor: true, antenna: true, armband: false, pouches: false,
  },
  terror: {
    head: 0x5c5346, headAccent: 0x403a30,
    pad: 0x4a4437, padDark: 0x332e26,
    metal: 0.02, rough: 0.95,        // مات = پارچه
    hood: true, visor: false, antenna: false, armband: true, pouches: true,
  },
};

/* جسم را به یک استخوان می‌چسباند و مقیاس استخوان را جبران می‌کند.
   ⚠️ استخوان‌های این ریگ اسکیل ۱۰۰ دارند؛ اگر جبران نشود جسم ۱۰۰ برابر
   می‌شود (باگ واقعی که در همین پروژه رخ داد). */
function attachToBone(model, boneName, obj, worldOffset) {
  const bone = model.getObjectByName(boneName);
  if (!bone) return false;
  bone.updateWorldMatrix(true, false);
  const ws = bone.getWorldScale(new THREE.Vector3());
  obj.scale.setScalar(1 / (Math.abs(ws.x) || 1));
  const world = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).add(worldOffset);
  bone.worldToLocal(world);
  obj.position.copy(world);
  bone.add(obj);
  return true;
}

/* ---------------- سرپوش ----------------
   سوات: کلاه ایمنی با ویزور براق و آفتاب‌گیر
   تروریست: هودی پارچه‌ای با لبه‌ی نرم، بدون براقی */
function buildHeadgear(kit) {
  const g = new THREE.Group();
  g.name = 'kitHelmet';

  const mat = new THREE.MeshStandardMaterial({
    color: kit.head, roughness: kit.rough, metalness: kit.metal, flatShading: true,
  });

  if (kit.hood) {
    // هودی: کره‌ی کمی کشیده با لبه‌ی پایین‌آمده
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.78),
      mat,
    );
    hood.scale.set(1.04, 0.96, 1.10);   // کشیدگی خیلی کم، رو به عقب
    g.add(hood);
    // لبه‌ی پارچه‌ای دور صورت (یک حلقه‌ی نازک)
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.022, 5, 12),
      new THREE.MeshStandardMaterial({ color: kit.headAccent, roughness: 0.95 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.03;
    g.add(rim);
  } else {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.72),
      mat,
    );
    g.add(helmet);
    // آفتاب‌گیر جلو — جهت نگاه از بالا خوانا می‌شود
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.11), mat.clone());
    brim.material.color.setHex(kit.headAccent);
    brim.position.set(0, -0.03, 0.155);
    g.add(brim);
    if (kit.visor) {
      // ویزور براق: تنها سطح براق کاراکتر — از بالا یک خط روشن
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.21, 0.045, 0.05),
        new THREE.MeshStandardMaterial({
          color: 0x9fd8ff, roughness: 0.08, metalness: 0.9,
          emissive: 0x1d3a52, emissiveIntensity: 1.0,
        }),
      );
      visor.position.set(0, -0.035, 0.145);
      g.add(visor);
    }
  }
  return g;
}

/* ---------------- شانه ----------------
   سوات: پد افقی روشن (خط افقی از بالا)
   تروریست: خشاب‌های عمودی روی جلیقه (خط عمودی از بالا) */
function buildShoulders(kit, model) {
  const padMat = new THREE.MeshStandardMaterial({
    color: kit.pad, roughness: kit.rough + 0.05, metalness: kit.metal, flatShading: true,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: kit.padDark, roughness: kit.rough + 0.08, metalness: kit.metal * 0.5, flatShading: true,
  });

  if (kit.pouches) {
    // سه خشاب عمودی روی سینه — از بالا «|||» خوانده می‌شود
    for (let i = -1; i <= 1; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.15), i === 0 ? padMat : darkMat);
      p.name = 'kitPad';
      attachToBone(model, 'Chest', p, new THREE.Vector3(i * 0.075, 0.10, 0.075));
    }
    // بند جلیقه روی شانه‌ها
    for (const x of [0.16, -0.16]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.20), darkMat);
      s.name = 'kitStrap';
      attachToBone(model, 'Chest', s, new THREE.Vector3(x, 0.20, 0.0));
    }
  } else {
    // پد شانه‌ی پهن و افقی
    const geo = new THREE.BoxGeometry(0.17, 0.075, 0.24);
    for (const [x, rz, m] of [[0.215, -0.28, padMat], [-0.215, 0.28, darkMat]]) {
      const pad = new THREE.Mesh(geo, m);
      pad.name = 'kitPad';
      pad.rotation.z = rz;
      attachToBone(model, 'Chest', pad, new THREE.Vector3(x, 0.165, -0.01));
    }
  }
}

/* ---------------- کوله و آنتن (فقط سوات) ---------------- */
function buildBackpack(kit, model) {
  if (!kit.antenna) return;
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.34, 0.16),
    new THREE.MeshStandardMaterial({ color: kit.padDark, roughness: 0.8, flatShading: true }),
  );
  pack.name = 'kitPack';
  attachToBone(model, 'Chest', pack, new THREE.Vector3(0, 0.06, -0.19));

  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4),
    new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.6, metalness: 0.4 }),
  );
  ant.position.set(0.10, 0.30, -0.22);
  model.getObjectByName('Chest')?.add(ant);
  // انتن هم به همان استخوان، با همان جبران مقیاس
  attachToBone(model, 'Chest', ant, new THREE.Vector3(0.10, 0.30, -0.22));
}

/* ---------------- بازوبند (فقط تروریست) ---------------- */
function buildArmband(kit, model) {
  if (!kit.armband) return;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.055, 8),
    new THREE.MeshStandardMaterial({
      color: 0xb0432f, roughness: 0.85,
      emissive: 0x2a0c07, emissiveIntensity: 1,
    }),
  );
  band.name = 'kitArmband';
  // استخوان بازوی چپ؛ اگر نبود، شانه
  const ok = attachToBone(model, 'UpperArmL', band, new THREE.Vector3(0, -0.10, 0));
  if (!ok) attachToBone(model, 'Chest', band, new THREE.Vector3(-0.20, 0.15, 0));
}

export function addReadableKit(model, team) {
  const kit = TEAM_KIT[team] || TEAM_KIT.swat;

  const headgear = buildHeadgear(kit);
  attachToBone(model, 'Head', headgear, new THREE.Vector3(0, 0.115, 0.05));

  buildShoulders(kit, model);
  buildBackpack(kit, model);
  buildArmband(kit, model);

  model.updateMatrixWorld(true);
  return model;
}
