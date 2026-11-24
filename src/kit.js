/* =====================================================================
   تجهیزات خوانا برای نمای عمود — منبع واحد حقیقت
   هم بازی (src/main.js) و هم ابزار پیش‌نمایش (scripts/render-scene.mjs)
   از همین فایل استفاده می‌کنند تا آنچه تست می‌شود همان چیزی باشد که
   بازیکن می‌بیند.

   چرا این ماژول وجود دارد؟
   در دوربین عمود ۹۰° بازیکن فقط «تاج سر» و «شانه‌ها» را می‌بیند. مدل
   پایه کلاه دارد ولی تاج سر را نمی‌پوشاند، نتیجه: یک دایره‌ی رنگ پوست
   که کل کاراکتر را می‌بلعد و تیم از تیم قابل تشخیص نیست.
   این ماژول سه چیز کم‌هزینه اضافه می‌کند:
     ۱) کلاه تاکتیکی روی تاج سر   ← بزرگ‌ترین دایره‌ی دید از بالا
     ۲) آفتاب‌گیر جلوی کلاه        ← جهت نگاه از بالا خوانا می‌شود
     ۳) دو پد شانه در رنگ تیم     ← از بالا مثل «||» خوانده می‌شود
   ===================================================================== */
import * as THREE from 'three';

export const TEAM_KIT = {
  swat:   { helmet: 0x46607d, brim: 0x33465d, pad: 0x5f7fa8, padDark: 0x3f5675 },
  terror: { helmet: 0x6d6552, brim: 0x4c4639, pad: 0xb0432f, padDark: 0x7d2f21 },
};

/* جسم را به یک استخوان می‌چسباند و مقیاس استخوان را جبران می‌کند.
   ⚠️ استخوان‌های این ریگ اسکیل ۱۰۰ دارند؛ اگر جبران نشود جسم ۱۰۰ برابر
   می‌شود (باگ واقعی که در همین پروژه رخ داد). */
function attachToBone(model, boneName, obj, worldOffset, worldScale = null) {
  const bone = model.getObjectByName(boneName);
  if (!bone) return false;
  bone.updateWorldMatrix(true, false);
  const ws = bone.getWorldScale(new THREE.Vector3());
  obj.scale.setScalar(1 / (Math.abs(worldScale || ws.x) || 1));
  const world = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).add(worldOffset);
  bone.worldToLocal(world);
  obj.position.copy(world);
  bone.add(obj);
  return true;
}

export function addReadableKit(model, team) {
  const kit = TEAM_KIT[team] || TEAM_KIT.swat;

  /* ---- ۱) کلاه ---- */
  const helmetMat = new THREE.MeshStandardMaterial({
    color: kit.helmet, roughness: 0.85, metalness: 0.04, flatShading: true,
  });
  // نیم‌کره‌ی کم‌پالی: عرض ۰.۲۸ متر، ارتفاع ۰.۱۶ متر — کمی بزرگ‌تر از جمجمه
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.185, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.72),
    helmetMat,
  );
  helmet.name = 'kitHelmet';

  /* ---- ۲) آفتاب‌گیر جلو ---- */
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.11), helmetMat.clone());
  brim.material.color.setHex(kit.brim);
  brim.position.set(0, -0.03, 0.155);
  helmet.add(brim);

  // مرکز جمجمه تقریباً y=1.62 و ز=0.12 در مدل ایستاده است
  attachToBone(model, 'Head', helmet, new THREE.Vector3(0, 0.115, 0.05));

  /* ---- ۳) پد شانه ---- */
  const padGeo = new THREE.BoxGeometry(0.16, 0.07, 0.26);
  const padMat = new THREE.MeshStandardMaterial({
    color: kit.pad, roughness: 0.7, metalness: 0.06, flatShading: true,
  });
  const padMatDark = new THREE.MeshStandardMaterial({
    color: kit.padDark, roughness: 0.75, metalness: 0.05, flatShading: true,
  });
  for (const [x, rz, m] of [[0.215, -0.30, padMat], [-0.215, 0.30, padMatDark]]) {
    const pad = new THREE.Mesh(padGeo, m);
    pad.name = 'kitPad';
    pad.rotation.z = rz;
    attachToBone(model, 'Chest', pad, new THREE.Vector3(x, 0.16, -0.02));
  }

  model.updateMatrixWorld(true);
  return model;
}
