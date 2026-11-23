// بررسی استفاده از متغیرهای const/let در سطح ماژول، پیش از تعریف (خطای TDZ در زمان لود)
import fs from 'node:fs';
const src = fs.readFileSync('src/main.js', 'utf8');
const lines = src.split('\n');

// عمق آکولاد در هر خط + پیدا کردن تعریف‌های سطح بالا
const depths = [];
let d = 0;
for (const line of lines) {
  depths.push(d);
  for (const ch of line) {
    if (ch === '{' || ch === '(' || ch === '[') d++;
    if (ch === '}' || ch === ')' || ch === ']') d--;
  }
}
const decls = new Map();
lines.forEach((line, i) => {
  const m = line.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
  if (m && depths[i] === 0) decls.set(m[1], i);
});

// برای هر خط سطح بالا، اگر از نامی استفاده می‌شود که بعداً تعریف شده → مشکل
const problems = [];
lines.forEach((line, i) => {
  if (depths[i] !== 0) return;                 // فقط سطح ماژول
  if (/^\s*(const|let|var|function|class|import|\/\/|\/\*|\*)/.test(line)) return;
  for (const [name, defLine] of decls) {
    if (defLine <= i) continue;
    const re = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
    if (re.test(line)) problems.push({ line: i + 1, name, usedAt: line.trim().slice(0, 70), definedAt: defLine + 1 });
  }
});

// توابع/نقشه‌هایی که در IIFE بالای فایل استفاده می‌شوند را هم چک کن
const iife = lines.findIndex(l => l.includes('(async function init()'));
if (iife > 0) {
  for (const [name, defLine] of decls) {
    if (defLine > iife) continue;
  }
  console.log(`IIFE اجرا در خط ${iife + 1}`);
}

if (!problems.length) console.log('✅ خطای TDZ پیدا نشد — هیچ متغیر سطح بالایی پیش از تعریف استفاده نشده');
else for (const p of problems) console.log(`❌ خط ${p.line}: «${p.name}» استفاده شده ولی در خط ${p.definedAt} تعریف می‌شود → ${p.usedAt}`);
