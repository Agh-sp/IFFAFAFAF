/* =====================================================================
   نقشه — نسخه‌ی ساده: یک زمین صاف و خالی
   عمداً هیچ اتاق، دیوار و مبلمانی ندارد. هدف این مرحله ساختن و
   درست‌کردن «انجین» است (حرکت، دوربین، انیمیشن، شلیک)؛ نقشه بعداً.
   ===================================================================== */

export const TILE = 2;                    // مقیاس مرجع (متر)
export const COLS = 40, ROWS = 30;
export const HW = COLS * TILE / 2;        // نیم‌عرض جهان = ۴۰ متر
export const HH = ROWS * TILE / 2;        // نیم‌ارتفاع جهان = ۳۰ متر
export const WORLD_W = COLS * TILE;       // ۸۰ متر
export const WORLD_D = ROWS * TILE;       // ۶۰ متر

/* گرید خالی: هیچ دیواری نیست. ساختارش حفظ شده تا کدهای دیگر بشکنند. */
export const PLAN = Array.from({ length: ROWS }, () => '.'.repeat(COLS));
export const GRID = PLAN.map(row => Array.from(row, ch => (ch === '#' ? 1 : 0)));
export const FLOOR = 0, WALL = 1;

/* هیچ اتاق و مبلمانی نیست. */
export const ROOMS = [];
export const FURNITURE = [];

export const cellX = c => -HW + TILE * (c + 0.5);
export const cellZ = r => -HH + TILE * (r + 0.5);
export const cellCenter = (c, r) => ({ x: cellX(c), z: cellZ(r) });
export const world = cellCenter;

export const isWall = (c, r) =>
  c < 0 || r < 0 || c >= COLS || r >= ROWS || GRID[r][c] === WALL;

export const cellOf = (x, z) => ({
  c: Math.floor((x + HW) / TILE),
  r: Math.floor((z + HH) / TILE),
});

export const roomAt = () => null;

/* نقاط شروع: سوات سمت چپ، تروریست سمت راست — روی زمین صاف. */
export const SPAWNS = {
  swat: [
    { x: -22, z: -6 }, { x: -22, z: 0 }, { x: -22, z: 6 },
    { x: -16, z: -3 }, { x: -16, z: 3 },
  ],
  terror: [
    { x: 22, z: -6 }, { x: 22, z: 0 }, { x: 22, z: 6 },
    { x: 16, z: -3 }, { x: 16, z: 3 },
  ],
};

/* موانع (هیچ) — ساختار برای سازگاری با کد برخورد. */
export const PROP_COLLIDERS = [];
