// بازسازی بدون‌رندر کل صحنه + پرتوتابی از دوربین بازی برای یافتن جسم مسدودکننده
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
const loader = new GLTFLoader();
const parse = f => new Promise((r, j) => { const b = fs.readFileSync(f); loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', r, j); });

const TILE = 2, COLS = 30, ROWS = 22, HW = COLS * TILE / 2, HH = ROWS * TILE / 2, MAX_H = 5.5, W = 1;
// --- نقشه (همان کد بازی) ---
const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
for (let c = 0; c < COLS; c++) { grid[0][c] = W; grid[ROWS - 1][c] = W; }
for (let r = 0; r < ROWS; r++) { grid[r][0] = W; grid[r][COLS - 1] = W; }
grid[10].fill(0);
for (let r = 1; r < ROWS - 1; r++) grid[r][14] = 0;
const row = (r, c0, c1, g = []) => { for (let c = c0; c <= c1; c++) if (!g.includes(c)) grid[r][c] = W; };
const col = (c, r0, r1, g = []) => { for (let r = r0; r <= r1; r++) if (!g.includes(r)) grid[r][c] = W; };
col(8, 1, 9, [5]); col(21, 1, 9, [5]); row(9, 1, COLS - 2, [4, 14, 25]);
for (let r = 4; r <= 6; r++) for (let c = 25; c <= 27; c++) grid[r][c] = W;
col(7, 11, ROWS - 2, [16]); col(17, 11, ROWS - 2, [13]); col(23, 11, ROWS - 2, [18]);
row(11, 1, COLS - 2, [3, 11, 20, 26]);
const world = (c, r) => ({ x: -HW + TILE * (c + 0.5), z: -HH + TILE * (r + 0.5) });

const scene = new THREE.Scene();

function normGeo(gltf, target, mode = 'footprint') {
  let mesh = null;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, size = bb.getSize(new THREE.Vector3());
  const dim = mode === 'footprint' ? Math.max(size.x, size.z) : size.y;
  const k = target / (dim || 1);
  geo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, -(bb.max.z + bb.min.z) / 2);
  geo.scale(k, k, k);
  geo.computeBoundingBox();
  let h = geo.boundingBox.max.y;
  if (h > MAX_H) { const k2 = MAX_H / h; geo.scale(k2, k2, k2); geo.computeBoundingBox(); }
  return { geo, mat: mesh.material };
}

// --- کف و دیواره‌ها (instanced مثل بازی) ---
const groups = {};
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const { x, z } = world(c, r);
  const key = grid[r][c] === W ? ((c % 9 === 3) ? 'Wall_4' : (Math.random() < 0.3 ? 'Wall_2' : 'Wall_1')) : (Math.random() < 0.22 ? 'FloorTile_Basic2' : 'FloorTile_Basic');
  (groups[key] ||= []).push({ x, z });
}
for (const [name, list] of Object.entries(groups)) {
  const g = await parse(`public/models/office/${name}.glb`);
  const { geo, mat } = normGeo(g, TILE, 'footprint');
  const isWall = name.startsWith('Wall');
  if (isWall) { mat.transparent = true; mat.opacity = 0.72; }
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  im.name = name;
  const m = new THREE.Matrix4();
  list.forEach((p, i) => { m.makeTranslation(p.x, 0, p.z); im.setMatrixAt(i, m); });
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
}

// --- مبلمان (همان جدول بازی) ---
const src = fs.readFileSync('src/main.js', 'utf8');
for (const mm of src.matchAll(/\{ n: '([\w]+)', x: (-?[\d.]+), z: (-?[\d.]+), r: ([^,]+), s: ([\d.]+)(?:, mode: '(\w+)')?/g)) {
  const [, n, x, z, r, s, mode] = mm;
  const g = await parse(`public/models/office/${n}.glb`);
  let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  const root = g.scene.clone(true);
  root.updateMatrixWorld(true);
  const size0 = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const dim = (mode === 'footprint') ? Math.max(size0.x, size0.z) : size0.y;
  root.scale.multiplyScalar(+s / (dim || 1));
  root.updateMatrixWorld(true);
  let h = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
  if (h > MAX_H) root.scale.multiplyScalar(MAX_H / h);
  root.position.set(+x, 0, +z);
  root.rotation.y = +r || 0;
  root.name = n;
  scene.add(root);
}

// --- دوربین بازی ---
const player = { x: -21, z: 5 };   // از پنل: x=-21 z=5
const aim = -74 * Math.PI / 180;
const camZoom = 23, back = camZoom * 0.22;
const target = new THREE.Vector3(player.x, 0.5, player.z);
const cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 260);
cam.position.set(Math.max(-27, Math.min(27, target.x)), Math.max(16, camZoom), Math.max(-19, Math.min(19, target.z + back)));
cam.lookAt(target);
cam.updateMatrixWorld(true);

// --- پرتوتابی از ۹ نقطه صفحه ---
const ray = new THREE.Raycaster();
let blocked = 0, samples = [];
const pts = [];
for (let ix = 0; ix < 7; ix++) for (let iy = 0; iy < 5; iy++) pts.push([-0.9 + ix * 0.3, -0.8 + iy * 0.4]);
for (const [sx, sy] of pts) {
  ray.setFromCamera(new THREE.Vector2(sx, sy), cam);
  const hits = ray.intersectObjects(scene.children, true);
  if (hits.length) {
    const h0 = hits[0];
    samples.push({ sx, sy, obj: h0.object.name || h0.object.parent?.name || '?', dist: h0.distance, point: h0.point });
  }
}
console.log(`=== ${samples.length} نقطه از ${pts.length} نقطه صفحه جسمی را می‌بینند ===`);

// آیا زمین/کف دیده می‌شود؟
const floorHits = samples.filter(s => s.obj.startsWith('FloorTile'));
console.log(`\nنقاطی که کف را می‌بینند: ${floorHits.length} از ${samples.length}`);
const wallHits = samples.filter(s => s.obj.startsWith('Wall'));
console.log(`نقاطی که دیوار می‌بینند: ${wallHits.length} از ${samples.length}`);
const propHits = samples.filter(s => !s.obj.startsWith('Floor') && !s.obj.startsWith('Wall'));
console.log('مدل‌های دیگر:', propHits.map(p => `${p.obj}(${p.dist.toFixed(0)}m)`).join(', ') || 'هیچ');
