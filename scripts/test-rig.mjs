// تست ریمپ انیمیشن شوالیه روی کاراکترهای تیم
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';

const loader = new GLTFLoader();
const parse = f => new Promise((res, rej) => {
  const b = fs.readFileSync(f);
  loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej);
});

const ALIAS = {
  PalmL: 'HandL', PalmR: 'HandR', MiddleHandL: 'HandL', MiddleHandR: 'HandR',
  FingersL: 'HandL', FingersR: 'HandR',
  ThumbL: 'Thumb2L', Thumb2L: 'Thumb3L', ThumbR: 'Thumb2R', Thumb2R: 'Thumb3R',
};
function remapClip(clip, root) {
  const bones = new Set();
  root.traverse(o => { if (o.isBone) bones.add(o.name); });
  const tracks = [];
  for (const t of clip.tracks) {
    const [node, prop] = t.name.split('.');
    if (!prop || !prop.includes('quaternion')) continue;   // فقط چرخش
    const target = bones.has(node) ? node : ALIAS[node];
    if (!target || !bones.has(target)) continue;
    const nt = t.clone();
    nt.name = `${target}.quaternion`;
    tracks.push(nt);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

const anim = await parse('public/models/anim/KnightCharacter.glb');
for (const model of ['Swat', 'Worker', 'Suit', 'Casual', 'Punk', 'CyberCharacter', 'Spacesuit', 'Casual2', 'Beach', 'Adventurer']) {
  const g = await parse(`public/models/team/${model}.glb`);
  const root = g.scene;
  let bones = 0; root.traverse(o => { if (o.isBone) bones++; });
  let totalTracks = 0, okClips = 0;
  // شبیه‌سازی واقعی: میکسر روی ریشه کاراکتر
  const mixer = new THREE.AnimationMixer(root);
  const runClip = anim.animations.find(a => a.name.endsWith('|Run'));
  const mapped = remapClip(runClip, root);
  totalTracks = mapped.tracks.length;
  const action = mixer.clipAction(mapped);
  action.play();
  const sample = [];
  root.traverse(o => { if (o.isBone) sample.push([o.name, o.quaternion.clone()]); });
  mixer.update(0.2);
  let moved = 0;
  for (const [name, q0] of sample) {
    const b = root.getObjectByName(name);
    if (b && q0.angleTo(b.quaternion) > 0.002) moved++;
  }
  // همه کلیپ‌ها
  let bad = [];
  for (const c of anim.animations) {
    const m = remapClip(c, root);
    if (m.tracks.length < 6) bad.push(c.name.split('|').pop() + '(' + m.tracks.length + ')');
    else okClips++;
  }
  console.log(`${model.padEnd(15)} bones=${String(bones).padStart(2)} runTracks=${String(totalTracks).padStart(2)} bonesMoved=${moved} clipsOK=${okClips}/${anim.animations.length}${bad.length ? ' weak:' + bad.join(',') : ''}`);
}
