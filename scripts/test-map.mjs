// تست: نقاط اسپاون آزاد هستند؟ نقشه به هم متصل است؟
const TILE=2, COLS=30, ROWS=22, HW=COLS*TILE/2, HH=ROWS*TILE/2;
const grid = Array.from({length:ROWS},()=>new Array(COLS).fill(0));
const W=1;
for (let c=0;c<COLS;c++){grid[0][c]=W;grid[ROWS-1][c]=W;}
for (let r=0;r<ROWS;r++){grid[r][0]=W;grid[r][COLS-1]=W;}
const row=(r,c0,c1,g=[])=>{for(let c=c0;c<=c1;c++) if(!g.includes(c)) grid[r][c]=W;};
const col=(c,r0,r1,g=[])=>{for(let r=r0;r<=r1;r++) if(!g.includes(r)) grid[r][c]=W;};
grid[10].fill(0);
for(let r=1;r<ROWS-1;r++) grid[r][14]=0;
col(8,1,9,[5]); col(21,1,9,[5]); row(9,1,COLS-2,[4,14,25]);
for(let r=4;r<=6;r++) for(let c=25;c<=27;c++) grid[r][c]=W;
col(7,11,ROWS-2,[16]); col(17,11,ROWS-2,[13]); col(23,11,ROWS-2,[18]);
row(11,1,COLS-2,[3,11,20,26]);

const world=(c,r)=>({x:-HW+TILE*(c+0.5), z:-HH+TILE*(r+0.5)});
const cell=(x,z)=>[Math.floor((x+HW)/TILE), Math.floor((z+HH)/TILE)];

const spawns = {
  swat: [{x:-24,z:17},{x:-21,z:19},{x:-23,z:20},{x:-20,z:16},{x:-26,z:18}],
  terror: [{x:24,z:-17},{x:20,z:-16},{x:26,z:-15},{x:18,z:-18},{x:23,z:-13}],
};
for (const team in spawns) for (const p of spawns[team]) {
  const [c,r] = cell(p.x,p.z);
  const solid = grid[r]?.[c] === W;
  console.log(`${team} (${p.x},${p.z}) -> cell(${c},${r}) ${solid ? '❌ داخل دیوار' : '✅ آزاد'}`);
}
// BFS از اسپاون سوات
const start = cell(spawns.swat[0].x, spawns.swat[0].z);
const seen = new Set([start.join(',')]);
const q=[start];
while(q.length){
  const [c,r]=q.shift();
  for (const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nc=c+dc, nr=r+dr;
    if(nc<0||nr<0||nc>=COLS||nr>=ROWS) continue;
    if(grid[nr][nc]===W) continue;
    const k=nc+','+nr;
    if(seen.has(k)) continue;
    seen.add(k); q.push([nc,nr]);
  }
}
let free=0; for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++) if(grid[r][c]!==W) free++;
console.log(`\nخانه‌های آزاد: ${free} | قابل دسترس از اسپاون سوات: ${seen.size}`);
for (const p of spawns.terror) {
  const k = cell(p.x,p.z).join(',');
  if(!seen.has(k)) console.log('❌ تروریست در ناحیه جدا افتاده:', p);
}
// تعداد دیوارها
let walls=0; for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++) if(grid[r][c]===W) walls++;
console.log('دیوارها:', walls, '| کف:', free);

// پیشنهاد نقاط آزاد در هر ناحیه
function freeIn(c0,c1,r0,r1){
  const out=[];
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++) if(grid[r][c]!==W) out.push(world(c,r));
  return out;
}
const swatArea = freeIn(1,6,12,20).filter(p=>Math.random()<1);
const terrArea = freeIn(22,28,1,8);
console.log('\nنمونه نقاط آزاد سوات:', swatArea.slice(0,8).map(p=>`{x:${p.x.toFixed(1)},z:${p.z.toFixed(1)}}`).join(' '));
console.log('نمونه نقاط آزاد تروریست:', terrArea.slice(0,8).map(p=>`{x:${p.x.toFixed(1)},z:${p.z.toFixed(1)}}`).join(' '));
