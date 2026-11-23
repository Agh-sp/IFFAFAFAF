// تست: نقاط اسپاون سوات و تروریست از دیوار و مبلمان فاصله دارند
import fs from 'node:fs';
const src = fs.readFileSync('src/main.js', 'utf8');
const TILE = 2, COLS = 30, ROWS = 22, HW = COLS, HH = ROWS;
const W = 1;
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

const gridAt = (x, z) => {
  const c = Math.floor((x + HW) / TILE), r = Math.floor((z + HH) / TILE);
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return W;
  return grid[r][c];
};
// مبلمان با برخورد
const props = [];
for (const m of src.matchAll(/\{ n: '([\w]+)', x: (-?[\d.]+), z: (-?[\d.]+), r: [^,]+, s: ([\d.]+)/g)) {
  props.push({ n: m[1], x: +m[2], z: +m[3], r: +m[4] * 0.28 });
}
console.log('مبلمان برخورددار:', props.length);
const clearance = (x, z, rad = 0.7) => {
  let worst = Infinity;
  for (const p of props) worst = Math.min(worst, Math.hypot(x - p.x, z - p.z) - (p.r + rad));
  return worst;
};
const anchors = {
  swat: [[-19, 3], [-20, -1], [-21, 5], [-18, 6], [-17, -1]],
  terror: [[18, -19], [27, -12], [18, -16], [25, -15], [22, -19]],
};
let bad = 0;
for (const team in anchors) for (const [x, z] of anchors[team]) {
  const wall = gridAt(x, z) === W;
  const cl = clearance(x, z);
  const ok = !wall && cl > 0.3;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${team} (${x},${z}) دیوار:${wall ? 'بله' : 'خیر'} فاصله از مبلمان:${cl.toFixed(2)}m`);
}
console.log(bad === 0 ? '\n✅ همه ۱۰ نقطه اسپاون آزادند' : `\n❌ ${bad} نقطه مشکل دارد`);
