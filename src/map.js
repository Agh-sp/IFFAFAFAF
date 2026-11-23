/* =====================================================================
   نقشه‌ی ساختمان — منبع یگانه‌ی حقیقت
   هم بازی و هم تست‌ها (scripts/test-map.mjs و test-ai.mjs) از این فایل
   می‌خوانند تا نقشه‌ی تست‌شده همان نقشه‌ای باشد که بازی می‌سازد.
   ===================================================================== */

export const TILE = 2;                      // هر خانه = ۲ متر
export const COLS = 34, ROWS = 26;
export const HW = COLS * TILE / 2, HH = ROWS * TILE / 2;

/* '#' = دیوار، '.' = کف.
   پلان: ۳ طبقه × ۶ اتاق + دو راهروی افقی (ردیف ۸-۹ و ۱۷-۱۸) و
   یک راهروی عمودی مرکزی (ستون ۱۶-۱۷). هر اتاق یک در به راهرو دارد. */
export const PLAN = [
  "##################################",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "#.#..#.#..#.#..#..#.#..#.#..#.#..#",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "##.##.#.##.#.##....#.##.#.##.#.###",
  "#................................#",
  "#................................#",
  "##.##.#.##.#.##....#.##.#.##.#.###",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "#.#..#.#..#.#..#..#.#..#.#..#.#..#",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "#####.####.####....####.####.#####",
  "#................................#",
  "#................................#",
  "##.##.#.##.#.##....#.##.#.##.#.###",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "#.#..#.#..#.#..#..#.#..#.#..#.#..#",
  "#....#....#....#..#....#....#....#",
  "#....#....#....#..#....#....#....#",
  "##################################",
];

export const GRID = PLAN.map(row => Array.from(row, ch => ch === '#' ? 1 : 0));
export const FLOOR = 0, WALL = 1;

// اتاق‌ها: [نام, ردیف شروع, ردیف پایان, ستون شروع, ستون پایان]
export const ROOMS = [["مدیریت", 1, 6, 1, 4], ["جلسات", 1, 6, 6, 9], ["پذیرش", 1, 6, 11, 14], ["سرور", 1, 6, 19, 22], ["مالی", 1, 6, 24, 27], ["منابع‌انسانی", 1, 6, 29, 32], ["عملیات", 11, 15, 1, 4], ["پشتیبانی", 11, 15, 6, 9], ["آزمایشگاه", 11, 15, 11, 14], ["امنیت", 11, 15, 19, 22], ["انبار", 11, 15, 24, 27], ["آرشیو", 11, 15, 29, 32], ["کافه", 20, 24, 1, 4], ["استراحت", 20, 24, 6, 9], ["ورزش", 20, 24, 11, 14], ["اتاق‌برق", 20, 24, 19, 22], ["تعمیرگاه", 20, 24, 24, 27], ["خروج", 20, 24, 29, 32]];

export const cellX = c => -HW + TILE * (c + 0.5);
export const cellZ = r => -HH + TILE * (r + 0.5);
export const cellCenter = (c, r) => ({ x: cellX(c), z: cellZ(r) });
export const world = (c, r) => cellCenter(c, r);

export const isWall = (c, r) =>
  c < 0 || r < 0 || c >= COLS || r >= ROWS || GRID[r][c] === WALL;

// خانه‌ی گرید برای یک نقطه‌ی جهانی
export const cellOf = (x, z) => ({
  c: Math.floor((x + HW) / TILE),
  r: Math.floor((z + HH) / TILE),
});

export const roomAt = (x, z) => {
  const { c, r } = cellOf(x, z);
  for (const [n, r0, r1, c0, c1] of ROOMS)
    if (r >= r0 && r <= r1 && c >= c0 && c <= c1) return n;
  return null;
};

/* مبلمان: هر اتاق چند قطعه. مختصات دقیقاً در محدوده‌ی داخلی اتاق
   محاسبه می‌شود و پیش از پذیرش با گرید اعتبارسنجی می‌شود تا هیچ قطعه‌ای
   داخل دیوار یا روی راهرو نیفتد. */
export const FURNITURE = (() => {
  const items = [];
  const midX = (c0, c1) => (cellX(c0) + cellX(c1)) / 2;
  const midZ = (r0, r1) => (cellZ(r0) + cellZ(r1)) / 2;

  // خانه‌ی راهرو
  const isCorr = (c, r) => [8, 9, 17, 18].includes(r) || c === 16 || c === 17;

  // ⚠️ خانه‌ی در: خانه‌ی کف که کنار راهرو است (محل عبور بات از اتاق به راهرو).
  // اگر مبلمان روی در بیفتد، بات داخل اتاق زندانی می‌شود و «تکون نمی‌خورد».
  const doorCells = new Set();
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (GRID[r][c] === WALL || isCorr(c, r)) continue;
      for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (isCorr(c + dc, r + dr) && GRID[r + dr]?.[c + dc] !== WALL) { doorCells.add(`${c},${r}`); break; }
      }
    }
  }
  const isDoor = (c, r) => doorCells.has(`${c},${r}`);

  const usable = (x, z, opts = {}) => {
    const c = Math.floor((x + HW) / TILE), r = Math.floor((z + HH) / TILE);
    if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return false;
    if (GRID[r][c] === WALL || isCorr(c, r)) return false;
    // در و همسایه‌هایش باید خالی بمانند تا راه فرار باز باشد
    if (!opts.allowDoor && (isDoor(c, r) || isDoor(c+1, r) || isDoor(c-1, r) || isDoor(c, r+1) || isDoor(c, r-1))) return false;
    return true;
  };
  // اگر نقطه آزاد نبود، نزدیک‌ترین خانه‌ی آزاد داخل همان اتاق را بده
  const place = (x, z, room) => {
    // ابتدا نزدیک دیوار را امتحان کن (مبلمان معمولاً چسبیده به دیوار است)
    if (usable(x, z)) return { x, z };
    const [, r0, r1, c0, c1] = room;
    for (let ring = 1; ring <= 3; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          const r = Math.floor((z + HH) / TILE) + dr;
          const c = Math.floor((x + HW) / TILE) + dc;
          if (r < r0 || r > r1 || c < c0 || c > c1) continue;
          const px = cellX(c), pz = cellZ(r);
          if (usable(px, pz)) return { x: px, z: pz };
        }
      }
    }
    return null;
  };

  for (const room of ROOMS) {
    const [name, r0, r1, c0, c1] = room;
    const cx = midX(c0, c1), cz = midZ(r0, r1);
    const center = place(cx, cz, room);
    if (!center) continue;                 // اتاق پر است، رد کن
    const { x: X, z: Z } = center;

    // فرش همیشه روی کف مرکز اتاق
    items.push({ n: 'Carpet_1', x: X, z: Z, r: 0, s: Math.min(3.2, (c1 - c0) * 1.2), mode: 'footprint', flat: true });

    // یک قطعه‌ی امضادار وسط اتاق
    const midPiece = {
      'مدیریت': 'Table_RoundLarge', 'جلسات': 'Table_RoundLarge', 'پذیرش': 'Table_RoundLarge',
      'مالی': 'Table_RoundLarge', 'منابع‌انسانی': 'Table_RoundLarge', 'سرور': 'Props_Shelf_Tall',
      'عملیات': 'Table_RoundLarge', 'پشتیبانی': 'Table_RoundLarge', 'آزمایشگاه': 'Props_Vessel_Tall',
      'امنیت': 'Computer_Large', 'انبار': 'Props_Crate', 'آرشیو': 'Bookshelf',
      'کافه': 'Table_RoundLarge', 'استراحت': 'Couch_Medium1', 'ورزش': 'Props_Teleporter_1',
      'اتاق‌برق': 'Props_Pod', 'تعمیرگاه': 'Props_Laser', 'خروج': 'Props_CrateLong',
    }[name] || 'Chair_1';
    const mode = /CrateLong|Couch|Table/.test(midPiece) ? 'footprint' : 'height';
    items.push({ n: midPiece, x: X, z: Z, r: 0, s: 1.9, mode });

    // دو صندلی/قطعه فرعی در دو طرف (اگر جا بود)
    const sideA = place(X - 1.6, Z, room);
    const sideB = place(X + 1.6, Z, room);
    if (sideA) items.push({ n: 'Chair_1', x: sideA.x, z: sideA.z, r: -Math.PI / 2, s: 0.9 });
    if (sideB) items.push({ n: 'Chair_3', x: sideB.x, z: sideB.z, r: Math.PI / 2, s: 0.9 });

    // گوشه‌ی اتاق: دراور/قفسه
    const corner = place(cellX(c0), cellZ(r0), room);
    if (corner) items.push({ n: 'Drawer_1', x: corner.x, z: corner.z, r: 0.2, s: 0.95 });

    // گیاه در گوشه‌ی مقابل
    const plant = place(cellX(c1), cellZ(r1), room);
    if (plant) items.push({ n: 'Houseplant_1', x: plant.x, z: plant.z, r: 0, s: 1.2 });

    // سقف در نقشه وجود ندارد، پس چراغ سقفی هم لازم نیست
    // (قبلاً به‌صورت شناور بالای دیوارها دیده می‌شد)
  }

  // راهروها عمداً خالی نگه داشته می‌شوند: هر قطعه‌ای در راهرو
  // مسیر بات‌ها را تنگ می‌کند و باعث گیر کردنشان می‌شود.

  return items;
})();
