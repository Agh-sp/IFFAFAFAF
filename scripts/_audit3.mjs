import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
const loader = new GLTFLoader();
const parse = f => new Promise((r, j) => { const b = fs.readFileSync(f); loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j); });

const src = fs.readFileSync('src/main.js', 'utf8');
const seen = new Map();
for (const m of src.matchAll(/\{ n: '([\w]+)', x: (-?[\d.]+), z: (-?[\d.]+), r: ([^,]+), s: ([\d.]+)(?:, mode: '(\w+)')?/g))
  if (!seen.has(m[1])) seen.set(m[1], { s: +m[5], mode: m[6] || 'height' });

const out = [];
for (const [n, { s, mode }] of seen) {
  const g = await parse(`public/models/office/${n}.glb`);
  g.scene.updateMatrixWorld(true);
  const raw = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
  const root = g.scene.clone(true);
  const s0 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(s0.x, s0.z) : s0.y;
  root.scale.multiplyScalar(s / (dim || 1));
  root.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  out.push({ n, s, mode, raw, scaled, max: Math.max(scaled.x, scaled.y, scaled.z) });
}
out.sort((a, b) => b.max - a.max);
console.log('۱۰ مدل بزرگ‌تر (بعد از مقیاس‌دهی کد):');
for (const o of out.slice(0, 10)) {
  console.log(`  ${o.n.padEnd(22)} ${o.scaled.x.toFixed(1)}x${o.scaled.y.toFixed(1)}x${o.scaled.z.toFixed(1)}  | خام ${o.raw.x.toFixed(0)}x${o.raw.y.toFixed(0)}x${o.raw.z.toFixed(0)} | ${o.mode}`);
}
console.log('\nمدل‌هایی که در X یا Z بزرگ‌تر از ۱۰ متر می‌شوند:');
const wide = out.filter(o => o.scaled.x > 10 || o.scaled.z > 10);
if (!wide.length) console.log('  هیچ');
for (const o of wide) console.log(`  ⚠️ ${o.n}: ${o.scaled.x.toFixed(1)}x${o.scaled.y.toFixed(1)}x${o.scaled.z.toFixed(1)}`);
