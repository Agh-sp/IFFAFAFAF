// بررسی موجود بودن همه فایل‌های دارایی که بازی ارجاع می‌دهد
import fs from 'node:fs';
import path from 'node:path';
const src = fs.readFileSync('src/main.js', 'utf8');
const missing = [];
const check = p => { if (!fs.existsSync('public' + p)) missing.push(p); };
for (const m of src.matchAll(/path: '(\/models\/[^']+)'/g)) check(m[1]);
for (const m of src.matchAll(/cat: '(\w+)',\s*model: '(\w+)'/g)) check(`/models/${m[1]}/${m[2]}.glb`);
for (const m of src.matchAll(/'(?:\/audio\/|\/models\/)[^']+\.(?:wav|ogg|mp3|glb)'/g)) check(m[0].slice(1, -1));
for (const m of src.matchAll(/'office',\s*'(\w+)'/g)) check(`/models/office/${m[1]}.glb`);
if (missing.length) { console.log('❌ فایل‌های گمشده:'); missing.forEach(m => console.log('  ', m)); process.exit(1); }
console.log('✅ همه دارایی‌ها موجودند');
