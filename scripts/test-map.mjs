// تست نقشه: از همان ماژول src/map.js می‌خواند که بازی استفاده می‌کند.
import { COLS, ROWS, TILE, HW, HH, GRID, FLOOR, ROOMS, world, isWall, FURNITURE } from '../src/map.js';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

console.log(`نقشه: ${COLS}×${ROWS} خانه = ${COLS*TILE}×${ROWS*TILE} متر\n`);

// ۱) اتصال کامل کف
function reachFrom(c0, r0) {
  const seen = new Set([`${c0},${r0}`]), q = [[c0, r0]];
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c+dc, nr = r+dr, k = `${nc},${nr}`;
      if (isWall(nc, nr) || seen.has(k)) continue;
      seen.add(k); q.push([nc, nr]);
    }
  }
  return seen;
}
let free = 0;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!isWall(c, r)) free++;
const reach = reachFrom(16, 12);
check(reach.size === free, `همه ${free} خانه کف به هم وصل‌اند (${reach.size})`);

// ۲) راهروها کاملاً باز
let blocked = 0;
for (const r of [8, 9, 17, 18]) for (let c = 1; c < COLS - 1; c++) if (isWall(c, r)) blocked++;
for (const c of [16, 17]) for (let r = 1; r < ROWS - 1; r++) if (isWall(c, r)) blocked++;
check(blocked === 0, `راهروها بدون مانع (${blocked} خانه بسته)`);

// ۳) هر اتاق به راهرو وصل است
check(ROOMS.length === 18, `۱۸ اتاق تعریف شده (${ROOMS.length})`);
let roomFails = 0;
for (const [name, r0, r1, c0, c1] of ROOMS) {
  let hasDoor = false;
  for (let r = r0; r <= r1 && !hasDoor; r++)
    for (let c = c0; c <= c1 && !hasDoor; c++)
      if (!isWall(c, r)) hasDoor = true;
  if (!hasDoor) { console.log(`  ❌ اتاق ${name} بسته است`); roomFails++; }
}
check(roomFails === 0, `همه ۱۸ اتاق دست‌کم یک خانه باز دارند`);

// ۴) A* بین دو گوشه (همان الگوریتم بازی)
const DIRS8 = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
function findPath(sx, sz, tx, tz) {
  const sc = Math.floor((sx+HW)/TILE), sr = Math.floor((sz+HH)/TILE);
  const tc = Math.floor((tx+HW)/TILE), tr = Math.floor((tz+HH)/TILE);
  if (isWall(tc, tr)) return null;
  const key = (c,r) => r*COLS+c, h = (c,r) => Math.hypot(c-tc, r-tr);
  const openSet = new Map([[key(sc,sr), {c:sc,r:sr,g:0,f:h(sc,sr),parent:null}]]);
  const closed = new Set();
  let guard = 0;
  while (openSet.size && guard++ < 4000) {
    let bk=null,bf=Infinity;
    for (const [k,n] of openSet) if (n.f<bf) {bf=n.f;bk=k;}
    const cur = openSet.get(bk);
    if (bk === key(tc,tr)) {
      let len=0, prev=null;
      for (let n=cur;n;n=n.parent) { if(prev) len += Math.hypot(n.c-prev.c, n.r-prev.r); prev=n; }
      return { len, steps: closed.size };
    }
    openSet.delete(bk); closed.add(bk);
    for (const [dc,dr,cost] of DIRS8) {
      const nc=cur.c+dc, nr=cur.r+dr;
      if (isWall(nc,nr)) continue;
      if (dc&&dr&&(isWall(cur.c+dc,cur.r)||isWall(cur.c,cur.r+dr))) continue;
      const nk=key(nc,nr); if(closed.has(nk)) continue;
      const g2=cur.g+cost, ex=openSet.get(nk);
      if(!ex||g2<ex.g) openSet.set(nk,{c:nc,r:nr,g:g2,f:g2+h(nc,nr),parent:cur});
    }
  }
  return null;
}
const A = world(2, 21), B = world(31, 2);
const path = findPath(A.x, A.z, B.x, B.z);
check(!!path, path ? `A* بین دو گوشه: ${(path.len*TILE).toFixed(0)} متر` : 'A* مسیری نیافت');

// ۵) از هر اتاق به مرکز راهرو
let pf = 0;
for (const [name, r0, r1, c0, c1] of ROOMS) {
  const cx = (r0 + r1) >> 1, cy = (c0 + c1) >> 1;
  if (isWall(cy, cx)) continue;
  const p = findPath(world(cy, cx).x, world(cy, cx).z, world(16, 12).x, world(16, 12).z);
  if (!p) { console.log(`  ❌ از ${name} مسیری به مرکز نیست`); pf++; }
}
check(pf === 0, `از هر اتاق مسیر به راهروی مرکزی هست (${ROOMS.length - pf}/${ROOMS.length})`);

// ۶) مبلمان: داخل نقشه، روی کف، بیرون از راهرو
let offMap = 0, inWall = 0, inCorridor = 0;
for (const f of FURNITURE) {
  const c = Math.floor((f.x + HW) / TILE), r = Math.floor((f.z + HH) / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) { offMap++; console.log('  ❌ بیرون نقشه:', f.n); continue; }
  if (isWall(c, r)) { inWall++; console.log('  ❌ داخل دیوار:', f.n, `(${c},${r})`); continue; }
  const inCorr = [8,9,17,18].includes(r) || c === 16 || c === 17;
  if (inCorr && !f.ceiling && !f.flat) { inCorridor++; console.log('  ⚠️ در مسیر راهرو:', f.n, `(${c},${r})`); }
}
check(offMap === 0, `همه ${FURNITURE.length} قطعه مبلمان داخل نقشه‌اند`);
check(inWall === 0, `هیچ مبلمانی داخل دیوار نیست`);
check(inCorridor === 0, `راهروها از مبلمان خالی‌اند`);

// ۷) اسپاون‌ها روی کف
const SPAWNS = { swat: [[2,21],[7,21],[12,21],[2,12],[7,12]], terror: [[31,2],[26,2],[31,12],[26,12],[31,21]] };
let badSpawn = 0;
for (const [team, pts] of Object.entries(SPAWNS))
  for (const [c, r] of pts) if (isWall(c, r)) { badSpawn++; console.log('  ❌ اسپاون روی دیوار:', team, c, r); }
check(badSpawn === 0, `همه ۱۰ نقطه اسپاون روی کف‌اند`);

console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ نقشه سالم است');
process.exit(fails ? 1 : 0);
