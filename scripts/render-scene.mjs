/* رندر نرم‌افزاری (بدون مرورگر و بدون GPU) برای دیدن صحنه‌ی بازی.
   همان دوربین، همان زمین، همان مدل و همان نور بازی را می‌سازد و با
   raycasting ساده تصویر می‌دهد. هدف: دیدن اینکه کاراکتر کجاست و
   اندازه‌اش چقدر است، بدون نیاز به مرورگر. */
globalThis.self = globalThis;
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { addReadableKit } from '../src/kit.js';
import fs from 'node:fs';
import { deflateSync } from 'node:zlib';

const loader = new GLTFLoader();
const load = f => new Promise((r, j) => {
  const b = fs.readFileSync(f);
  loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j);
});

// ---------- ساخت صحنه مثل بازی ----------
const HW = 40, HH = 30, camZoom = 11;
const W = 720, H = 460;

const g = await load(process.env.MODEL || 'public/models/chars/swat.glb');

/* تکسچر پالت (256×256، خانه‌های ۱۶ پیکسلی). سه.js در Node نمی‌تواند PNG را
   باز کند، پس خودمان از GLB بیرون می‌کشیم و با UV رنگ هر وجه را می‌گیریم. */
const palBytes = process.env.NO_PALETTE === '1' || !process.env.PALETTE
  ? null : fs.readFileSync(process.env.PALETTE );
const PAL = 256;
const samplePal = (u, v) => {
  const x = Math.min(PAL - 1, Math.max(0, Math.floor(u * PAL)));
  const y = Math.min(PAL - 1, Math.max(0, Math.floor(v * PAL)));
  const i = (y * PAL + x) * 3;
  return [palBytes[i], palBytes[i + 1], palBytes[i + 2]];
};
const root = SkeletonUtils.clone(g.scene);
root.updateMatrixWorld(true);
const rawH = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
root.scale.multiplyScalar(1.8 / rawH);
root.traverse(o => {
  if (o.isMesh) {
    o.frustumCulled = false;
    o.material = o.material.clone();
    // همان تینت بازی
    o.material.emissive = new THREE.Color(0x1b4c8f).multiplyScalar(0.5);
    o.material.emissiveIntensity = 0.5;
  }
});
const mixer = new THREE.AnimationMixer(root);
const idle = g.animations.find(a => /Idle_Gun_Pointing$/.test(a.name))
  || g.animations.find(a => /idle/i.test(a.name));
mixer.clipAction(idle).play();
mixer.update(0.6);

// ---- اسلحه در دست (همان چیدمان layoutGun) ----
const gunGltf = await load('public/models/guns/AR_1.glb');
const gunScene = gunGltf.scene;
gunScene.updateMatrixWorld(true);
const gsz = new THREE.Box3().setFromObject(gunScene).getSize(new THREE.Vector3());
const glen = Math.max(gsz.x, gsz.y, gsz.z);
const gunHolder = new THREE.Group();
gunScene.scale.setScalar(1 / glen);
gunScene.rotation.set(-0.10, -Math.PI / 2, 0);
gunHolder.add(gunScene);
gunHolder.scale.setScalar(0.95 / (1 * root.scale.x));
const wrist = root.getObjectByName('WristR');
let gunReady = false;
if (wrist) {
  const wp = new THREE.Vector3(); wrist.getWorldPosition(wp);
  gunHolder.position.copy(wp).add(new THREE.Vector3(0.16, -0.08, 0.05));
  gunReady = true;
}
const gunMeshes = [];
if (gunReady) {
  gunScene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; gunMeshes.push(o); } });
}


const playerPos = new THREE.Vector3(0, 0.09, 0);
const playerG = new THREE.Group();
playerG.position.copy(playerPos);
playerG.rotation.y = Math.PI;      // رو به دوربین
playerG.add(root);
if (gunReady) gunHolder.position.copy(root.worldToLocal(gunHolder.position.clone())), playerG.add(gunHolder);
playerG.updateMatrixWorld(true);
// ---- تجهیزات خوانا: از همان ماژول بازی
addReadableKit(root, process.env.TEAM || 'swat');
playerG.updateMatrixWorld(true);

if (gunMeshes.length) {
  const bb = new THREE.Box3().setFromObject(gunHolder);
  console.log('gun world bbox', bb.min.toArray().map(v=>v.toFixed(2)).join(','), '→', bb.max.toArray().map(v=>v.toFixed(2)).join(','),
    '| size', bb.getSize(new THREE.Vector3()).toArray().map(v=>v.toFixed(2)).join(' x '));
}

// ---------- دوربین دقیقاً مثل بازی ----------
const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 400);
camera.up.set(0, 0, -1);   // مثل بازی
camera.position.set(playerPos.x, camZoom, playerPos.z);
camera.lookAt(playerPos.x, 0.9, playerPos.z);
camera.updateMatrixWorld(true);

// ---------- رندر: برای هر پیکسل، پرتو بزن ----------
const ray = new THREE.Raycaster();
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);


// جمع‌آوری مش‌ها (بعد از افزودن کلاه/پد شانه، وگرنه جا می‌مانند)
const meshes = [];
playerG.traverse(o => { if (o.isMesh && !gunMeshes.includes(o)) meshes.push(o); });

// پوست‌دهی لازم است چون raycaster روی SkinnedMesh با boneTransform کار نمی‌کند
// پس هندسه را با اعمال استخوان‌ها به‌روز می‌کنیم
for (const m of [...meshes]) {
  if (!m.isSkinnedMesh) continue;
  const pos = m.geometry.attributes.position;
  const baked = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    m.applyBoneTransform(i, v);
    m.localToWorld(v);
    baked[i*3] = v.x; baked[i*3+1] = v.y; baked[i*3+2] = v.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(baked, 3));
  if (m.geometry.index) geo.setIndex(m.geometry.index);
  geo.computeVertexNormals();

  // رنگ هر رأس از پالت با UV خودش
  const uv = m.geometry.attributes.uv;
  const cols = new Float32Array(pos.count * 3);
  // اگر مدل تکسچر پالت ندارد، رنگ خودِ متریال را استفاده کن
  const mc = m.material?.color ? m.material.color : null;
  // رنگ تیمی همان‌طور که tintCharacter می‌دهد
  const nm2 = (m.material?.name || '').toLowerCase();
  const teamColor = nm2 === 'skin' ? [201, 141, 99]
    : nm2 === 'visor' ? [27, 39, 51] : [74, 95, 120];
  // دو تُن لباس، مطابق tintCharacter: Swat روشن‌تر، Swat_Black تیره
  if (nm2 === 'swat') teamColor.splice(0, 3, 74, 95, 120);
  if (nm2 === 'swat_black') teamColor.splice(0, 3, 38, 46, 58);
  const flat = palBytes && mc ? [Math.round(mc.r * 255), Math.round(mc.g * 255), Math.round(mc.b * 255)] : teamColor;
  for (let i = 0; i < pos.count; i++) {
    const c = (palBytes && uv) ? samplePal(uv.getX(i), uv.getY(i)) : flat;
    cols[i*3] = c[0] / 255; cols[i*3+1] = c[1] / 255; cols[i*3+2] = c[2] / 255;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const nm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  nm.updateMatrixWorld();
  nm.userData.faceCols = true;
  nm.name = (Array.isArray(m.material) ? m.material[0]?.name : m.material?.name) || '?';
  meshes.push(nm);
  meshes.splice(meshes.indexOf(m), 1);
}

const buf = Buffer.alloc(W * H * 3);
function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i+1] = c[1]; buf[i+2] = c[2];
}

let gunPx = 0;
let charPixels = 0, charMinX = W, charMaxX = 0, charMinY = H, charMaxY = 0;
const ndc = new THREE.Vector2();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);

    // زمین
    const p = new THREE.Vector3();
    const hitFloor = ray.ray.intersectPlane(floor, p);
    let col = [10, 13, 18];
    if (hitFloor && Math.abs(p.x) < HW && Math.abs(p.z) < HH) {
      // بتن با نویز
      const n = (Math.sin(p.x * 7.3) * Math.cos(p.z * 5.1) * 0.5 + 0.5) * 14;
      col = [58 + n, 61 + n, 66 + n];
      // حلقه مرکز
      const r = Math.hypot(p.x, p.z);
      if (r > 5.9 && r < 6.1) col = [107, 127, 150];
      if (r > 7.4 && r < 7.6) col = col;
      // مرزها
      if (Math.abs(Math.abs(p.x) - HW) < 0.2 || Math.abs(Math.abs(p.z) - HH) < 0.2) col = [91, 107, 126];
      // مه با فاصله
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      const fog = Math.min(1, d / 70);
      col = col.map(c => Math.round(c * (1 - fog * 0.72)));
    }

    // مقایسه‌ی عمق: اسلحه فقط اگر از بدن نزدیک‌تر باشد دیده می‌شود
    const charHits = ray.intersectObjects(meshes, false);
    const charD = charHits.length ? charHits[0].distance : Infinity;

    // اسلحه
    if (gunMeshes.length) {
      const gh = ray.intersectObjects(gunMeshes, false);
      if (gh.length && gh[0].distance < 200 && gh[0].distance < charD) {
        const n = gh[0].face?.normal || new THREE.Vector3(0,1,0);
        const l = Math.max(0.55, 0.55 + 0.45 * Math.abs(n.z));
        col = [Math.round(140*l), Math.round(150*l), Math.round(165*l)];
        gunPx++;
        px(x, y, col); continue;
      }
    }

    // کاراکتر
    const hits = charHits;
    if (hits.length && hits[0].distance < 200) {
      // مش‌هایی که رنگ رأس ندارند (کلاه/پد شانه): رنگ متریالشان را بگیر
      if (!hits[0].object.geometry.attributes.color) {
        const mc = hits[0].object.material?.color || { r: 0.5, g: 0.5, b: 0.5 };
        const n = hits[0].face?.normal || new THREE.Vector3(0, 1, 0);
        const l = Math.max(0.7, 0.7 + 0.3 * Math.abs(n.y));
        const c2 = [mc.r * 255 * l, mc.g * 255 * l, mc.b * 255 * l].map(v => Math.min(255, Math.round(v)));
        px(x, y, c2);
        charPixels++;
        charMinX = Math.min(charMinX, x); charMaxX = Math.max(charMaxX, x);
        charMinY = Math.min(charMinY, y); charMaxY = Math.max(charMaxY, y);
        continue;
      }
      if (process.env.DEBUGCOL) { const k = hits[0].object.name || '?'; globalThis.__c = globalThis.__c || {}; globalThis.__c[k] = (globalThis.__c[k]||0)+1; }
      col = [226, 152, 88];
      const h = hits[0];
      if (h.face && h.object.geometry.attributes.color) {
        const ca = h.object.geometry.attributes.color;
        const idx = h.object.geometry.index;
        const a = idx ? idx.getX(h.face.a) : h.face.a;
        const b = idx ? idx.getX(h.face.b) : h.face.b;
        const c = idx ? idx.getX(h.face.c) : h.face.c;
        const mix = (k) => Math.round(255 * (ca.getX(a) + ca.getX(b) + ca.getX(c)) / 3 * (k === 0 ? 1 : 1));
        col = [
          Math.round(255 * (ca.getX(a) + ca.getX(b) + ca.getX(c)) / 3),
          Math.round(255 * (ca.getY(a) + ca.getY(b) + ca.getY(c)) / 3),
          Math.round(255 * (ca.getZ(a) + ca.getZ(b) + ca.getZ(c)) / 3),
        ];
        // نرمال برای سایه‌ی ساده
        const n = h.face.normal;
        const l = Math.max(0.42, 0.42 + 0.58 * (n.y * 0.45 + n.x * 0.35 + 0.55));
        col = col.map(v => Math.min(255, Math.round(v * l)));
      }
      charPixels++;
      charMinX = Math.min(charMinX, x); charMaxX = Math.max(charMaxX, x);
      charMinY = Math.min(charMinY, y); charMaxY = Math.max(charMaxY, y);
    }
    px(x, y, col);
  }
}

// نوشتن PNG
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y*(W*3+1)] = 0; buf.copy(raw, y*(W*3+1)+1, y*W*3, (y+1)*W*3); }
const crcTable = (() => { const t = []; for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;} return t; })();
const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcTable[(c^x)&0xFF] ^ (c>>>8); return (c^0xFFFFFFFF)>>>0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync('scene-preview.png', Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));

console.log('scene-preview.png نوشته شد، اسلحه:', gunReady ? 'در دست' : '❌ نیست');
if (globalThis.__c) console.log('hits by object:', JSON.stringify(globalThis.__c));
console.log('پیکسل‌های اسلحه:', gunPx);
console.log('پیکسل‌های کاراکتر:', charPixels, `(${(charPixels/(W*H)*100).toFixed(2)}٪ صفحه)`);
if (charPixels > 0) {
  console.log(`محدوده روی صفحه: x ${charMinX}..${charMaxX} | y ${charMinY}..${charMaxY}`);
  console.log(`ارتفاع کاراکتر روی صفحه: ${charMaxY - charMinY} پیکسل از ${H}`);
} else {
  console.log('❌ کاراکتر دیده نمی‌شود!');
}
