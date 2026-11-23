// تست پوشش صفحه: کدام مدل از دید دوربین چقدر از کادر را می‌پوشاند؟
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
const loader = new GLTFLoader();
const parse = f => new Promise((r, j) => { const b = fs.readFileSync(f); loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j); });
const MAX_H = 5.5, FOV = 55;

function build(gltf, target, mode) {
  const root = gltf.scene.clone(true);
  root.updateMatrixWorld(true);
  const s0 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(s0.x, s0.z) : mode === 'length' ? Math.max(s0.x, s0.y, s0.z) : s0.y;
  root.scale.multiplyScalar(target / (dim || 1));
  root.updateMatrixWorld(true);
  let h = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
  if (h > MAX_H) root.scale.multiplyScalar(MAX_H / h);
  root.updateMatrixWorld(true);
  return root;
}

const src = fs.readFileSync('src/main.js', 'utf8');
const rows = [...src.matchAll(/\{ n: '([\w]+)', x: (-?[\d.]+), z: (-?[\d.]+), r: ([^,]+), s: ([\d.]+)(?:, mode: '(\w+)')?/g)];
const camY = 25, camBack = 25 * 0.48;
const results = [];
for (const m of rows) {
  const [, n, x, z, , s, mode] = m;
  const g = await parse(`public/models/office/${n}.glb`);
  const obj = build(g, +s, mode || 'height');
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  // بدترین حالت: دوربین در همان ارتفاع و نزدیک‌ترین حالت به جسم
  const cam = new THREE.Vector3(+x, camY, +z + camBack);
  const d = Math.max(1, cam.distanceTo(center));
  const screenFrac = (2 * Math.atan(radius / d)) / (FOV * Math.PI / 180);
  results.push({ n, screenFrac, size: box.getSize(new THREE.Vector3()), d });
}
results.sort((a, b) => b.screenFrac - a.screenFrac);
console.log('بیشترین پوشش صفحه (اگر > ۰.۸ باشد کادر را می‌پوشاند):');
for (const r of results.slice(0, 6)) {
  console.log(`  ${r.n.padEnd(22)} ${(r.screenFrac * 100).toFixed(0)}% کادر | اندازه ${r.size.x.toFixed(1)}x${r.size.y.toFixed(1)}x${r.size.z.toFixed(1)} | فاصله ${r.d.toFixed(0)}m ${r.screenFrac > 0.8 ? '⚠️' : ''}`);
}
const bad = results.filter(r => r.screenFrac > 0.8);
console.log(bad.length ? `❌ ${bad.length} مدل کادر را می‌پوشاند` : '✅ هیچ مدلی بیش از ۸۰٪ کادر را نمی‌پوشاند');
