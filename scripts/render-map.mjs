// نمایش گرافیکی نقشه (PNG) با کف، دیوار، مبلمان و اسپاون‌ها
import { COLS, ROWS, TILE, HW, HH, GRID, WALL, ROOMS, FURNITURE } from '../src/map.js';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SCALE = 16;                       // پیکسل به ازای هر خانه
const W = COLS * SCALE, H = ROWS * SCALE;
const buf = Buffer.alloc(W * H * 3);

const px = (x, y, [r, g, b]) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r; buf[i+1] = g; buf[i+2] = b;
};
const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0+h; y++) for (let x = x0; x < x0+w; x++) px(x, y, c); };
const dot = (cx, cy, r, c) => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
    if (x*x + y*y <= r*r) px(cx+x, cy+y, c);
};

// کف و دیوار
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const wall = GRID[r][c] === WALL;
  rect(c*SCALE, r*SCALE, SCALE, SCALE, wall ? [58, 74, 96] : [18, 26, 36]);
}
// خطوط اتاق‌ها
for (const [name, r0, r1, c0, c1] of ROOMS) {
  const x0 = c0*SCALE, y0 = r0*SCALE, w = (c1-c0+1)*SCALE, h = (r1-r0+1)*SCALE;
  for (let x = x0; x < x0+w; x++) { px(x, y0, [40, 70, 110]); px(x, y0+h-1, [40, 70, 110]); }
  for (let y = y0; y < y0+h; y++) { px(x0, y, [40, 70, 110]); px(x0+w-1, y, [40, 70, 110]); }
}
// مبلمان
for (const f of FURNITURE) {
  const c = Math.floor((f.x + HW) / TILE), r = Math.floor((f.z + HH) / TILE);
  const cxp = c*SCALE + SCALE/2, cyp = r*SCALE + SCALE/2;
  const col = f.ceiling ? [90, 90, 60] : f.flat ? [45, 58, 40] : [190, 150, 90];
  dot(cxp, cyp, SCALE*0.32, col);
}
// اسپاون‌ها
const SP = { swat: [[2,21],[7,21],[12,21],[2,12],[7,12]], terror: [[31,2],[26,2],[31,12],[26,12],[31,21]] };
for (const [team, pts] of Object.entries(SP))
  for (const [c, r] of pts) dot(c*SCALE + SCALE/2, r*SCALE + SCALE/2, SCALE*0.45, team === 'swat' ? [60, 160, 255] : [255, 80, 60]);

// نوشتن PNG دستی
const raw = Buffer.alloc((W*3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y*(W*3+1)] = 0; buf.copy(raw, y*(W*3+1)+1, y*W*3, (y+1)*W*3); }
const crcTable = (() => { const t = []; for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;} return t; })();
const crc = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcTable[(c^x)&0xFF] ^ (c>>>8); return (c^0xFFFFFFFF)>>>0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
writeFileSync('map-preview.png', png);
console.log(`✅ map-preview.png نوشته شد (${W}×${H}) — ${FURNITURE.length} قطعه مبلمان`);
