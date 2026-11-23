// آیا مبلمان مسیر بات‌ها را می‌بندد؟ شبیه‌سازی با در نظر گرفتن برخوردهای واقعی
import { COLS, ROWS, TILE, HW, HH, GRID, WALL, FURNITURE, ROOMS, world } from '../src/map.js';

// همان شعاع برخورد بازی
const props = FURNITURE.filter(f => !f.flat && !f.ceiling)
  .map(f => ({ x: f.x, z: f.z, r: f.s * 0.28, n: f.n }));

const gridAt = (x, z) => {
  const c = Math.floor((x + HW) / TILE), r = Math.floor((z + HH) / TILE);
  return (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? 1 : GRID[r][c];
};
function resolve(pos, radius = 0.55) {
  for (const p of props) {
    const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), min = radius + p.r;
    if (d < min && d > 0.001) { pos.x = p.x + dx/d*min; pos.z = p.z + dz/d*min; }
  }
  const c0 = Math.floor((pos.x+HW)/TILE), r0 = Math.floor((pos.z+HH)/TILE);
  for (let r=r0-1;r<=r0+1;r++) for (let c=c0-1;c<=c0+1;c++) {
    if (r<0||c<0||r>=ROWS||c>=COLS||GRID[r][c]!==WALL) continue;
    const cx=-HW+TILE*(c+0.5), cz=-HH+TILE*(r+0.5);
    const dx=pos.x-cx, dz=pos.z-cz;
    const ox=TILE/2+radius-Math.abs(dx), oz=TILE/2+radius-Math.abs(dz);
    if (ox>0&&oz>0) {
      if (ox<oz) pos.x = cx + Math.sign(dx||1)*(TILE/2+radius);
      else pos.z = cz + Math.sign(dz||1)*(TILE/2+radius);
    }
  }
}

// مسیریابی
const D8 = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
// خانه‌های اشغال‌شده توسط مبلمان (همان منطق buildNavBlockers بازی)
const navBlocked = new Set();
for (const p of props) {
  if (p.r < 0.05) continue;
  const cc = Math.floor((p.x + HW) / TILE), rr = Math.floor((p.z + HH) / TILE);
  if (cc<1||rr<1||cc>=COLS-1||rr>=ROWS-1) continue;
  if (GRID[rr][cc]!==WALL) navBlocked.add(`${cc},${rr}`);
}
for (const r of [8,9,17,18]) for (let c=1;c<COLS-1;c++) navBlocked.delete(`${c},${r}`);
for (const c of [16,17]) for (let r=1;r<ROWS-1;r++) navBlocked.delete(`${c},${r}`);

const isWall = (c,r) => c<0||r<0||c>=COLS||r>=ROWS||GRID[r][c]===WALL||navBlocked.has(`${c},${r}`);
function findPath(sx,sz,tx,tz) {
  const sc=Math.floor((sx+HW)/TILE), sr=Math.floor((sz+HH)/TILE);
  const tc=Math.floor((tx+HW)/TILE), tr=Math.floor((tz+HH)/TILE);
  if (isWall(tc,tr)) return null;
  const K=(c,r)=>r*COLS+c, H=(c,r)=>Math.hypot(c-tc,r-tr);
  const O=new Map([[K(sc,sr),{c:sc,r:sr,g:0,f:H(sc,sr),p:null}]]), C=new Set();
  let gd=0;
  while(O.size && gd++<4000){
    let bk=null,bf=Infinity;
    for(const [k,n] of O) if(n.f<bf){bf=n.f;bk=k;}
    const cur=O.get(bk);
    if(bk===K(tc,tr)){const out=[];for(let n=cur;n;n=n.p)out.push(world(n.c,n.r));out.reverse();out[out.length-1]={x:tx,z:tz};return out;}
    O.delete(bk); C.add(bk);
    for(const [dc,dr,cost] of D8){
      const nc=cur.c+dc,nr=cur.r+dr;
      if(isWall(nc,nr))continue;
      if(dc&&dr&&(isWall(cur.c+dc,cur.r)||isWall(cur.c,cur.r+dr)))continue;
      const nk=K(nc,nr); if(C.has(nk))continue;
      const g2=cur.g+cost, ex=O.get(nk);
      if(!ex||g2<ex.g) O.set(nk,{c:nc,r:nr,g:g2,f:g2+H(nc,nr),p:cur});
    }
  }
  return null;
}

console.log('شبیه‌سازی سفر بات با برخورد واقعی مبلمان:\n');
let fails = 0;
// از هر اسپاون به سه اتاق دور
const targets = [[2,1],[31,1],[2,24],[31,24],[16,12],[7,21]];
const starts = [[2,21],[31,2],[7,12]];
for (const [sc, sr] of starts) {
  for (const [tc, tr] of targets) {
    const s = world(sc, sr), t = world(tc, tr);
    const path = findPath(s.x, s.z, t.x, t.z);
    if (!path) { console.log(`  ❌ (${sc},${sr})→(${tc},${tr}): مسیر نیست`); fails++; continue; }
    // حرکت روی مسیر با برخورد
    const pos = { x: s.x, z: s.z };
    let i = 0, steps = 0, stuck = 0;
    while (steps < 12000 && Math.hypot(t.x-pos.x, t.z-pos.z) > 1.2) {
      const p = path[i] || t;
      const dx = p.x-pos.x, dz = p.z-pos.z, d = Math.hypot(dx,dz);
      if (d < 0.45) { i++; steps++; continue; }
      pos.x += dx/d*0.06; pos.z += dz/d*0.06;
      const bx = pos.x, bz = pos.z;
      resolve(pos, 0.55);
      if (Math.hypot(pos.x-bx, pos.z-bz) > 0.08) stuck++;
      steps++;
    }
    const finalD = Math.hypot(t.x-pos.x, t.z-pos.z);
    const ok = finalD < 3 && stuck < steps * 0.25;
    if (!ok) fails++;
    console.log(`  (${sc},${sr})→(${tc},${tr}): رسید؟ ${ok?'✅':'❌'} فاصله نهایی ${finalD.toFixed(1)}m | برخورد ${(stuck/steps*100).toFixed(0)}٪`);
  }
}
console.log(fails ? `\n❌ ${fails} مسیر مسدود` : '\n✅ بات‌ها به همه نقاط می‌رسند و در مبلمان گیر نمی‌کنند');
process.exit(fails ? 1 : 0);
