// تست پارس همه مدل‌های GLB با GLTFLoader در Node (بدون مرورگر)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
import path from 'node:path';

const root = 'public/models';
const loader = new GLTFLoader();
let ok = 0, fail = 0, tris = 0;
const animated = [];

for (const cat of fs.readdirSync(root)) {
  for (const f of fs.readdirSync(path.join(root, cat))) {
    if (!f.endsWith('.glb')) continue;
    const b = fs.readFileSync(path.join(root, cat, f));
    await new Promise(res => {
      loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', g => {
        let meshes = 0, t = 0;
        g.scene.traverse(o => {
          if (o.isMesh) {
            meshes++;
            t += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3;
          }
        });
        if (g.animations.length) animated.push(`${cat}/${f}(${g.animations.length})`);
        if (meshes === 0 || t === 0) { console.log(`⚠️ خالی: ${cat}/${f}`); fail++; }
        else { ok++; tris += t; }
        res();
      }, e => { console.log(`❌ ${cat}/${f}:`, e?.message || e); fail++; res(); });
    });
  }
}
console.log(`✅ ${ok} مدل سالم | ${fail} خطا | ${Math.round(tris).toLocaleString()} مثلث`);
console.log('انیمیشن‌دار:', animated.join(', '));
