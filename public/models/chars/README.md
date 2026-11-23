# مدل کاراکترها

## swat.glb / swat_urban.glb

- **منبع:** پکیج کاراکتر Quaternius (KayKit / «Ultimate Modular Characters») —
  از مخزن `jakubkrzysztofsikora/choyce-engine` گرفته شده است.
- **مجوز:** CC0 (پابلیک دامین). استفاده‌ی تجاری آزاد است، اسناد لازم نیست.
- **ریگ:** ۶۲ استخوان، ۲۴ کلیپ انیمیشن با نام‌های
  `CharacterArmature|Idle_Gun_Pointing`, `Run_Shoot`, `Death`, `Gun_Shoot` و …
- **جهت مدل:** رو به **+Z** است (ویزور ماسک از سمت +Z دیده می‌شود).
- **`swat_urban.glb`** همان فایل است با `baseColorFactor` خاکی/برنزه برای تیم تروریست.
- مدل تکسچر ندارد؛ رنگ از متریال می‌آید. `tintCharacter()` در `src/main.js`
  رنگ لباس را با تیم عوض می‌کند و رنگ پوست و شیشه‌ی ماسک را دست نمی‌زند.
