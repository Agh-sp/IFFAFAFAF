// تست پارس همه مدل‌ها با GLTFLoader در Node (بدون مرورگر)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = 'public/models';
const cats = fs.readdirSync(root);
const loader = new GLTFLoader();
let ok = 0, fail = 0;
const clipsFound = {};

for (const cat of cats) {
  for (const f of fs.readdirSync(path.join(root, cat))) {
    if (!f.endsWith('.glb')) continue;
    const buf = fs.readFileSync(path.join(root, cat, f));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    await new Promise(res => {
      loader.parse(ab, '', gltf => {
        let meshes = 0, tris = 0;
        gltf.scene.traverse(o => {
          if (o.isMesh) {
            meshes++;
            const g = o.geometry;
            tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
          }
        });
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const s = box.getSize(new THREE.Vector3());
        if (gltf.animations.length) clipsFound[`${cat}/${f}`] = gltf.animations.length;
        if (meshes === 0 || tris === 0) { console.log(`⚠️ خالی: ${cat}/${f}`); fail++; }
        else ok++;
        res();
      }, err => { console.log(`❌ خطا ${cat}/${f}:`, err?.message || err); fail++; res(); });
    });
  }
}
console.log(`\n✅ ${ok} مدل سالم پارس شد، ${fail} خطا`);
console.log('مدل‌های انیمیشن‌دار:', Object.keys(clipsFound).join(', '));
