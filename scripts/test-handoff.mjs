// تست: اسلحه دنبال دست کاراکتر می‌رود، با طول و ارتفاع درست.
// همان منطق layoutGun بازی، بدون نیاز به مرورگر.
globalThis.self = globalThis;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import fs from 'node:fs';

const loader = new GLTFLoader();
const load = f => new Promise((res, rej) => {
  const b = fs.readFileSync(f);
  loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej);
});
const bboxOf = o => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
const GUN_WORLD_LEN = { melee: 0.62, pistol: 0.44, rifle: 0.95, shotgun: 0.95, sniper: 1.05 };

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _sc = new THREE.Vector3();
function layoutGun(h) {
  const gun = h.userData.gun, hand = h.userData.hand, root = h.userData.charRoot;
  const worldLen = GUN_WORLD_LEN[h.userData.def.kind] || 0.9;
  const gunLen = h.userData.gunLen || 1;
  root.updateWorldMatrix(true, false);
  root.getWorldScale(_sc);
  const rootScale = Math.abs(_sc.x) || 1;
  hand.updateWorldMatrix(true, false);
  hand.getWorldPosition(_v1);
  root.worldToLocal(_v1);
  hand.getWorldQuaternion(_q1);
  root.getWorldQuaternion(_q2).invert();
  _q1.premultiply(_q2);
  _v2.copy(h.userData.offset).applyQuaternion(_q1);
  h.position.copy(_v1).add(_v2);
  h.quaternion.copy(_q1);
  h.scale.setScalar(worldLen / (gunLen * rootScale));
}

let fail = 0;
for (const [key, file, handBone, target] of [
  ['Soldier', 'public/models/chars/Soldier.glb', 'mixamorigRightHand', 1.8],
  ['Xbot', 'public/models/chars/Xbot.glb', 'mixamorigRightHand', 1.8],
]) {
  const src = await load(file);
  // شبیه‌سازی صحنه: کاراکتر در نقطه‌ای از مپ، با چرخش
  const group = new THREE.Group();
  group.position.set(-7, 0.09, 11);
  group.rotation.y = 1.2;
  const root = SkeletonUtils.clone(src.scene);
  root.scale.multiplyScalar(target / bboxOf(root).getSize(new THREE.Vector3()).y);
  group.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const idleClip = src.animations.find(a => /^idle$/i.test(a.name));
  mixer.clipAction(idleClip).play();
  mixer.update(1.2);

  const hand = root.getObjectByName(handBone);

  for (const [kind, len] of Object.entries({ rifle: 0.95, pistol: 0.44, melee: 0.62 })) {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 1.0), new THREE.MeshBasicMaterial());
    const holder = new THREE.Group();
    holder.add(gun);
    holder.userData = { gun, hand, charRoot: root, gunLen: 1.0, def: { kind },
      offset: new THREE.Vector3(0.05, -0.02, 0.06) };
    root.add(holder);

    // چند فریم مثل بازی
    for (let i = 0; i < 40; i++) { hand.updateWorldMatrix(true, false); layoutGun(holder); }

    group.updateMatrixWorld(true);
    const gb = bboxOf(gun).getSize(new THREE.Vector3());
    const gp = gun.getWorldPosition(new THREE.Vector3());
    const handP = hand.getWorldPosition(new THREE.Vector3());
    const lenWorld = Math.max(gb.x, gb.y, gb.z);
    // ارتفاع محلی نسبت به کف (group در y=0.09)
    const localY = gp.y - group.position.y;

    const okLen = Math.abs(lenWorld - len) < len * 0.15;
    const okPlace = localY > target * 0.3 && localY < target * 1.3;
    const okFollow = gp.distanceTo(handP) < 0.5;   // اسلحه کنار همان دست
    if (!okLen || !okPlace || !okFollow) fail++;
    console.log(`${key.padEnd(7)} ${kind.padEnd(6)}: طول ${lenWorld.toFixed(2)}m ${okLen?'✅':'❌'} | ارتفاع ${localY.toFixed(2)}m ${okPlace?'✅':'❌'} | فاصله از دست ${gp.distanceTo(handP).toFixed(2)}m ${okFollow?'✅':'❌'}`);
  }
}
console.log(fail ? `\n❌ ${fail} مورد ناموفق` : '\n✅ اسلحه در هر دو کاراکتر با اندازه و جای درست است و دست را دنبال می‌کند');
process.exit(fail ? 1 : 0);
