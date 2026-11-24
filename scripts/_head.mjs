globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import fs from 'node:fs';
const loader = new GLTFLoader();
const load = f => new Promise((r,j)=>{const b=fs.readFileSync(f);loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',r,j);});
const g = await load('public/models/chars/swat.glb');
const root = SkeletonUtils.clone(g.scene);
const mx=new THREE.AnimationMixer(root);
mx.clipAction(g.animations.find(a=>/Idle_Gun_Pointing$/.test(a.name))).play(); mx.update(0.8);
root.updateMatrixWorld(true);
const head = root.getObjectByName('Head');
const p=new THREE.Vector3(), q=new THREE.Quaternion(), sc=new THREE.Vector3();
head.getWorldPosition(p); head.getWorldQuaternion(q); head.getWorldScale(sc);
console.log('Head world pos', p.toArray().map(v=>v.toFixed(3)).join(','), 'scale', sc.toArray().map(v=>v.toFixed(3)).join(','));
console.log('root world scale', root.getWorldScale(new THREE.Vector3()).toArray().map(v=>v.toFixed(3)).join(','));
// bbox of head mesh
for (const n of ['Swat_Head_1','Swat_Head_2','Swat_Head_3']) {
  const o=root.getObjectByName(n); const bb=new THREE.Box3().setFromObject(o);
  console.log(n,'bbox y',bb.min.y.toFixed(2),'→',bb.max.y.toFixed(2),' x',bb.min.x.toFixed(2),'→',bb.max.x.toFixed(2),' z',bb.min.z.toFixed(2),'→',bb.max.z.toFixed(2));
}
const neck = root.getObjectByName('Neck'); const np=new THREE.Vector3(); neck.getWorldPosition(np);
console.log('Neck', np.toArray().map(v=>v.toFixed(3)).join(','));
