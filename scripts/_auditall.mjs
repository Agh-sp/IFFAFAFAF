// ممیزی کامل: همه مدل‌های استفاده‌شده (office/team/guns/weapons2) با مقیاس واقعی کد
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
const loader = new GLTFLoader();
const parse = f => new Promise((r, j) => { const b = fs.readFileSync(f); loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j); });
const MAX_H = 5.5;

function scaledSize(gltf, target, mode) {
  const root = gltf.scene.clone(true);
  root.updateMatrixWorld(true);
  const s0 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(s0.x, s0.z) : mode === 'length' ? Math.max(s0.x, s0.y, s0.z) : s0.y;
  root.scale.multiplyScalar(target / (dim || 1));
  root.updateMatrixWorld(true);
  let h = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
  if (h > MAX_H) root.scale.multiplyScalar(MAX_H / h);
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
}

const src = fs.readFileSync('src/main.js', 'utf8');
const jobs = [];
// مبلمان
const seen = new Map();
for (const m of src.matchAll(/\{ n: '([\w]+)', x: (-?[\d.]+), z: (-?[\d.]+), r: ([^,]+), s: ([\d.]+)(?:, mode: '(\w+)')?/g))
  if (!seen.has(m[1])) seen.set(m[1], { s: +m[5], mode: m[6] || 'height' });
for (const [n, { s, mode }] of seen) jobs.push({ path: `public/models/office/${n}.glb`, label: `office/${n}`, s, mode });
// سلاح‌های دستی (طول)
for (const f of ['Shotgun_1','Shotgun_2','Shotgun_SawedOff','Shotgun_ShortStock','Revolver_1','Revolver_2','Revolver_3','Pistol_1','Pistol_2','Knife','Torch'])
  jobs.push({ path: `public/models/weapons2/${f}.glb`, label: `weapons2/${f}`, s: f === 'Knife' ? 0.55 : 0.95, mode: 'length' });
// سلاح تیم‌ها
for (const f of ['AR_1','AR_3','AR_5','SMG_1','SMG_2','Pistol_1','Pistol_2','Sniper_1','Sniper_2'])
  jobs.push({ path: `public/models/guns/${f}.glb`, label: `guns/${f}`, s: 0.95, mode: 'length' });

const bad = [];
for (const j of jobs) {
  try {
    const g = await parse(j.path);
    const size = scaledSize(g, j.s, j.mode);
    const max = Math.max(size.x, size.y, size.z);
    // آستانه: سلاح حداکثر ۲ متر، مبلمان حداکثر ۶ متر
    const limit = j.label.startsWith('office') ? 6 : 2;
    if (max > limit) bad.push({ ...j, size });
  } catch (e) { console.log('ERR', j.label, e.message); }
}
console.log(`بررسی شد: ${jobs.length} مدل`);
if (!bad.length) console.log('✅ همه مدل‌ها اندازه منطقی دارند');
for (const b of bad) console.log(`⚠️ ${b.label} (هدف ${b.s}, ${b.mode}) → ${b.size.x.toFixed(2)} x ${b.size.y.toFixed(2)} x ${b.size.z.toFixed(2)}`);
