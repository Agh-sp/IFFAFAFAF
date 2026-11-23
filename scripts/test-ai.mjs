// شبیه‌سازی حرکت بات‌ها: آیا بات واقعاً جابه‌جا می‌شود یا سر جایش می‌چرخد؟
import { COLS, ROWS, TILE, HW, HH, GRID as grid, FURNITURE } from '../src/map.js';
const open = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && grid[r][c] === 0;
const world = (c, r) => ({ x: -HW + TILE * (c + 0.5), z: -HH + TILE * (r + 0.5) });
const gridAt = (x, z) => {
  const c = Math.floor((x + HW) / TILE), r = Math.floor((z + HH) / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 1;
  return grid[r][c];
};
const DIRS8 = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
function findPath(sx, sz, tx, tz) {
  const sc = Math.floor((sx+HW)/TILE), sr = Math.floor((sz+HH)/TILE);
  const tc = Math.floor((tx+HW)/TILE), tr = Math.floor((tz+HH)/TILE);
  if (!open(tc, tr)) return null;
  const key = (c,r) => r*COLS+c, h = (c,r) => Math.hypot(c-tc, r-tr);
  const openSet = new Map([[key(sc,sr), {c:sc,r:sr,g:0,f:h(sc,sr),parent:null}]]);
  const closed = new Set();
  let gd = 0;
  while (openSet.size && gd++ < 4000) {
    let bk=null,bf=Infinity;
    for (const [k,n] of openSet) if (n.f<bf) {bf=n.f;bk=k;}
    const cur = openSet.get(bk);
    if (bk === key(tc,tr)) {
      const out=[]; for(let n=cur;n;n=n.parent) out.push(world(n.c,n.r));
      out.reverse(); out[out.length-1]={x:tx,z:tz}; return out;
    }
    openSet.delete(bk); closed.add(bk);
    for (const [dc,dr,cost] of DIRS8) {
      const nc=cur.c+dc,nr=cur.r+dr;
      if(!open(nc,nr)) continue;
      if(dc&&dr&&(!open(cur.c+dc,cur.r)||!open(cur.c,cur.r+dr))) continue;
      const nk=key(nc,nr); if(closed.has(nk)) continue;
      const g2=cur.g+cost, ex=openSet.get(nk);
      if(!ex||g2<ex.g) openSet.set(nk,{c:nc,r:nr,g:g2,f:g2+h(nc,nr),parent:cur});
    }
  }
  return null;
}
function resolveCollision(pos, radius=0.55) {
  const c0 = Math.floor((pos.x+HW)/TILE), r0 = Math.floor((pos.z+HH)/TILE);
  for (let r=r0-1;r<=r0+1;r++) for (let c=c0-1;c<=c0+1;c++) {
    if (r<0||c<0||r>=ROWS||c>=COLS||grid[r][c]!==1) continue;
    const cx=-HW+TILE*(c+0.5), cz=-HH+TILE*(r+0.5);
    const dx=pos.x-cx, dz=pos.z-cz;
    const ox=TILE/2+radius-Math.abs(dx), oz=TILE/2+radius-Math.abs(dz);
    if (ox>0&&oz>0) {
      if (ox<oz) pos.x = cx + Math.sign(dx||1)*(TILE/2+radius);
      else pos.z = cz + Math.sign(dz||1)*(TILE/2+radius);
    }
  }
}
// شبیه‌سازی یک بات سرگردان با همان منطق بازی
function simulate(startC, startR, seconds) {
  const a = { g: { position: { x: world(startC, startR).x, z: world(startC, startR).z }, rotation: { y: 0 } },
              speed: 3.2, path: null, pathI: 0, pathCd: 0, pathAt: 0 };
  const dt = 1/60;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let movedFrames = 0, stillFrames = 0, totalDist = 0, rotChanges = 0, lastRot = 0;
  for (let f = 0; f < seconds * 60; f++) {
    a.pathCd -= dt;
    if (a.pathCd <= 0 || !a.path || a.pathI >= a.path.length) {
      a.pathCd = 2.5 + Math.random()*2;
      for (let i = 0; i < 14; i++) {
        const ang = -Math.PI + Math.random()*2*Math.PI, dist = 5 + Math.random()*9;
        const x = a.g.position.x + Math.sin(ang)*dist, z = a.g.position.z + Math.cos(ang)*dist;
        if (x < -HW+3 || x > HW-3 || z < -HH+3 || z > HH-3) continue;
        if (gridAt(x,z) === 1) continue;
        a.path = findPath(a.g.position.x, a.g.position.z, x, z); a.pathI = 0; break;
      }
    }
    const before = { ...a.g.position };
    if (a.path && a.pathI < a.path.length) {
      const p = a.path[a.pathI];
      const dx = p.x - a.g.position.x, dz = p.z - a.g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.45) a.pathI++;
      else {
        const step = Math.min(a.speed*0.55*dt, d);
        a.g.position.x += (dx/d)*step; a.g.position.z += (dz/d)*step;
        a.g.rotation.y = Math.atan2(dx, dz);
      }
    }
    resolveCollision(a.g.position, 0.55);
    const dMove = Math.hypot(a.g.position.x-before.x, a.g.position.z-before.z);
    if (dMove > 1e-4) { movedFrames++; totalDist += dMove; } else stillFrames++;
    if (Math.abs(a.g.rotation.y - lastRot) > 0.01) { rotChanges++; lastRot = a.g.rotation.y; }
    minX = Math.min(minX, a.g.position.x); maxX = Math.max(maxX, a.g.position.x);
    minZ = Math.min(minZ, a.g.position.z); maxZ = Math.max(maxZ, a.g.position.z);
    if (gridAt(a.g.position.x, a.g.position.z) === 1) return { error: 'داخل دیوار رفت' };
  }
  return {
    dist: totalDist, movedPct: movedFrames/(movedFrames+stillFrames)*100,
    area: (maxX-minX).toFixed(1) + '×' + (maxZ-minZ).toFixed(1),
    rotChanges, span: Math.hypot(maxX-minX, maxZ-minZ),
  };
}

console.log('شبیه‌سازی ۶۰ ثانیه حرکت بات (نرخ ۶۰ فریم):\n');
let fails = 0;
for (const [c, r] of [[2,21],[31,2],[16,12],[7,12]]) {
  const res = simulate(c, r, 60);
  if (res.error) { console.log(`  ❌ از (${c},${r}): ${res.error}`); fails++; continue; }
  const okDist = res.dist > 15;      // باید حداقل ۱۵ متر جابه‌جا شود
  const okArea = res.span > 8;       // باید فضای قابل توجهی را بپیماید
  const okMove = res.movedPct > 50;  // بیش از نیمِ فریم‌ها در حرکت
  if (!okDist || !okArea || !okMove) fails++;
  console.log(`  از (${c},${r}): مسافت ${res.dist.toFixed(0)}m ${okDist?'✅':'❌'} | پوشش ${res.area}m → قطر ${res.span.toFixed(0)}m ${okArea?'✅':'❌'} | در حرکت ${res.movedPct.toFixed(0)}٪ ${okMove?'✅':'❌'}`);
}
console.log(fails ? `\n❌ ${fails} بات گیر می‌کند` : '\n✅ بات‌ها واقعاً حرکت می‌کنند و در دیوار گیر نمی‌کنند');
process.exit(fails ? 1 : 0);
