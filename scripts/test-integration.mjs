// تست یکپارچگی: همه شناسه‌های DOM که کد می‌خواهد در index.html باشند،
// و هیچ ارجاعی به عناصر حذف‌شده نمانده باشد.
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const src = fs.readFileSync('src/main.js', 'utf8');

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const used = new Set([...src.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));

let fails = 0;
console.log('=== شناسه‌های DOM ===');
const missing = [...used].filter(id => !htmlIds.has(id));
if (missing.length) { console.log('❌ در HTML نیست:', missing.join(', ')); fails += missing.length; }
else console.log(`✅ همه ${used.size} شناسه‌ای که کد می‌خواهد در HTML هست`);

// querySelector روی کلاس‌ها
for (const m of src.matchAll(/querySelectorAll\(['"]([^'"]+)['"]\)/g)) {
  const sel = m[1];
  if (sel.startsWith('.') && !html.includes(sel.slice(1))) { console.log('❌ کلاس نیست:', sel); fails++; }
  if (sel.startsWith('#bar')) console.log('  ✓', sel, html.includes('id="bar"') ? 'موجود' : '❌');
}

// متغیرهای استفاده‌شده ولی حذف‌شده (باقی‌مانده‌ی ریفکتور)
const ghosts = ['galleryOpen', 'GPOS', 'gModel', 'pedestal', 'GALLERY_NAMES', 'toggleBoard', 'closePanels', 'scoreboard', 'roundtext'];
console.log('\n=== باقی‌مانده‌های ریفکتور ===');
for (const g of ghosts) {
  if (new RegExp(`\\b${g}\\b`).test(src)) { console.log(`❌ ${g} هنوز در کد استفاده می‌شود`); fails++; }
}
if (!fails) console.log('✅ هیچ ارجاع مرده‌ای نمانده');

// CSS: نوار پایین وجود دارد
console.log('\n=== HUD ===');
for (const id of ['bar', 'hpfill', 'armorfill', 'magtext', 'wepname', 'slots', 'minimap', 'version', 'torchstate'])
  if (!htmlIds.has(id)) { console.log('❌ عنصر HUD نیست:', id); fails++; }
if (!fails) console.log('✅ نوار پایین و مینی‌مپ کامل‌اند');
const removed = ['top', 'scorebox', 'health', 'weapons', 'gallery', 'scoreboard', 'midinfo'];
const stillThere = removed.filter(id => htmlIds.has(id));
console.log(stillThere.length ? `⚠️ هنوز در HTML: ${stillThere.join(', ')}` : '✅ کارت‌های اضافی بالای صفحه حذف شده‌اند');

process.exit(fails ? 1 : 0);
