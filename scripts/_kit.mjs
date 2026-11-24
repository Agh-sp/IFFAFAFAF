globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import fs from 'node:fs';
const loader = new GLTFLoader();
const load = f => new Promise((r,j)=>{const b=fs.readFileSync(f);loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',r,j);});
const g = await load('public/models/chars/swat.glb');
const root = SkeletonUtils.clone(g.scene);
const pg = new THREE.Group(); pg.add(root);   // مثل بازی
pg.updateMatrixWorld(true);
const mx = new THREE.AnimationMixer(root);
mx.clipAction(g.animations.find(a=>/Idle_Gun_Pointing$/.test(a.name))).play();
mx.update(0.8); pg.updateMatrixWorld(true);

const head = root.getObjectByName('Head');
const ws = head.getWorldScale(new THREE.Vector3());
console.log('Head world scale', ws.x.toFixed(2));
console.log('Head world pos', head.getWorldPosition(new THREE.Vector3()).toArray().map(v=>v.toFixed(3)).join(','));

const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.158,14,8,0,Math.PI*2,0,Math.PI*0.58), new THREE.MeshBasicMaterial());
const brim = new THREE.Mesh(new THREE.BoxGeometry(0.20,0.022,0.09), new THREE.MeshBasicMaterial());
brim.position.set(0,-0.02,0.13); helmet.add(brim);
helmet.scale.setScalar(1/ws.x);
const target = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld).add(new THREE.Vector3(0,0.14,0.10));
head.worldToLocal(target);
helmet.position.copy(target);
head.add(helmet);
pg.updateMatrixWorld(true);
const hb = new THREE.Box3().setFromObject(helmet);
console.log('helmet world bbox y', hb.min.y.toFixed(3),'→',hb.max.y.toFixed(3), ' size', hb.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(3)).join(' x '));
const hz = new THREE.Box3().setFromObject(root.getObjectByName('Swat_Head_2'));
console.log('head mesh bbox y', hz.min.y.toFixed(3),'→',hz.max.y.toFixed(3));
