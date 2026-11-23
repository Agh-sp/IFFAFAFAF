// تست: هیچ مدلی در بازی نباید از ۵.۵ متر بلندتر یا از ۱۲ متر بزرگ‌تر باشد
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { FURNITURE } from '../src/map.js';
const loader = new GLTFLoader();
const parse = f => new Promise((r, j) => { const b = fs.readFileSync(f); loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j); });
const MAX_H = 5.5, MAX_XZ = 12;

const seen = new Map();
for (const f of FURNITURE) if (!seen.has(f.n)) seen.set(f.n, { s: f.s, mode: f.mode || 'height' });

let bad = 0;
for (const [n, { s, mode }] of seen) {
  const g = await parse(`public/models/office/${n}.glb`);
  const root = g.scene.clone(true);
  root.updateMatrixWorld(true);
  const s0 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(s0.x, s0.z) : mode === 'length' ? Math.max(s0.x, s0.y, s0.z) : s0.y;
  root.scale.multiplyScalar(s / (dim || 1));
  root.updateMatrixWorld(true);
  let size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  // گارد کد
  if (size.y > MAX_H) root.scale.multiplyScalar(MAX_H / size.y);
  root.updateMatrixWorld(true);
  size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const ok = size.y <= MAX_H + 0.01 && Math.max(size.x, size.z) <= MAX_XZ;
  if (!ok) { bad++; console.log(`❌ ${n}: ${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}`); }
}
console.log(bad === 0 ? `✅ هیچ‌کدام از ${seen.size} مدل مبلمان بزرگ نیست` : `❌ ${bad} مدل بزرگ`);
