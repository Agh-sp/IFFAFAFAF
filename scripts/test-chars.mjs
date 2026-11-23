// تست کاراکترهای جدید: مدل، انیمیشن، استخوان دست
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import fs from 'node:fs';

// پلی‌فیل‌های لازم برای تکسچر در Node
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 4, height: 4, close() {} });
globalThis.URL.createObjectURL = () => 'blob:test';

const loader = new GLTFLoader();
const load = f => new Promise((res, rej) => {
  const b = fs.readFileSync(f);
  loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej);
});

for (const [key, file] of [['Soldier', 'public/models/chars/Soldier.glb'], ['Xbot', 'public/models/chars/Xbot.glb']]) {
  const g = await load(file);
  g.scene.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
  let meshes = 0, bones = 0;
  g.scene.traverse(o => { if (o.isMesh) meshes++; if (o.isBone) bones++; });
  const hand = g.scene.getObjectByName('mixamorigRightHand');
  console.log(`${key}: ${size.y.toFixed(2)}m قد | ${meshes} mesh | ${bones} استخوان | ${g.animations.length} انیمیشن`);
  console.log(`  انیمیشن‌ها: ${g.animations.map(a => a.name).join(', ')}`);
  console.log(`  استخوان دست راست: ${hand ? '✅ ' + hand.name : '❌ پیدا نشد'}`);
  // میکسر واقعاً کار می‌کند؟
  const mixer = new THREE.AnimationMixer(g.scene);
  const idle = g.animations.find(a => /idle|standing/i.test(a.name));
  if (idle) {
    mixer.clipAction(idle).play();
    const before = new THREE.Vector3(); hand?.getWorldPosition(before);
    mixer.update(0.4);
    g.scene.updateMatrixWorld(true);
    const after = new THREE.Vector3(); hand?.getWorldPosition(after);
    console.log(`  حرکت استخوان با انیمیشن ${idle.name}: ${before.distanceTo(after) > 0.0005 ? '✅ ' + before.distanceTo(after).toFixed(3) + 'm' : '❌ ساکن'}`);
  }
  console.log();
}
