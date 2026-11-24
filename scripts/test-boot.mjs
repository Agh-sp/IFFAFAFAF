/* =====================================================================
   تست «راه‌اندازی واقعی» — بازی را بدون مرورگر اجرا می‌کند.

   چرا لازم است؟ تست‌های دیگر کد را «تحلیل» می‌کنند (regex روی متن).
   آن‌ها نمی‌فهمند که مثلاً `camBack` حذف شده ولی یک خط دیگر هنوز از آن
   استفاده می‌کند — این خطا فقط در زمان اجرا (ReferenceError) بیرون
   می‌آید و بازیکن صفحه‌ی سیاه می‌بیند.

   این اسکریپت:
     - سه.js → سه.js + یک shim کوچک برای DOM/WebGL
     - src/main.js را واقعاً import می‌کند
     - ۶۰ فریم شبیه‌سازی می‌کند
     - هر خطای زمان اجرا را گزارش می‌دهد
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';

let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? '✅' : '❌'} ${msg}`); if (!ok) fails++; };

/* ProgressEvent در Node وجود ندارد ولی three.js برای پیشرفت بارگذاری
   از آن استفاده می‌کند. */
if (!globalThis.ProgressEvent) {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) {
      this.type = type; this.lengthComputable = !!init.lengthComputable;
      this.loaded = init.loaded || 0; this.total = init.total || 0;
    }
  };
}

/* ------------------ context جعلی canvas 2D (مینی‌مپ) ------------------ */
function ctx2d() {
  const noop = () => {};
  return new Proxy({
    canvas: { width: 300, height: 300 },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', globalAlpha: 1,
    shadowBlur: 0, shadowColor: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    putImageData: noop,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    setTransform: noop, resetTransform: noop,
  }, {
    get(t, p) {
      if (p in t) return t[p];
      return noop;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

/* ---------------------- shim حداقلی DOM ---------------------- */
const els = new Map();
function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, textContent: '', innerHTML: '', className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [], childNodes: [],
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
    querySelector: () => makeEl(id + '-q'),
    querySelectorAll: () => [],
    focus() {}, blur() {}, click() {},
    getContext: (kind) => kind === '2d' ? ctx2d() : null,
    width: 1280, height: 720,
    clientWidth: 1280, clientHeight: 720,
    offsetWidth: 1280, offsetHeight: 720,
    parentElement: null, parentNode: null,
    isConnected: true,
    contains: () => false,
    closest: () => null,
    animate: () => ({ finished: Promise.resolve(), cancel() {} }),
  };
  return el;
}
function getEl(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }

const doc = {
  documentElement: makeEl('html'),
  body: makeEl('body'),
  head: makeEl('head'),
  getElementById: getEl,
  querySelector: sel => getEl(sel.replace(/^#/, '')),
  querySelectorAll: () => [],
  createElement: tag => makeEl(tag),
  createElementNS: (ns, tag) => makeEl(tag),
  createTextNode: t => ({ nodeValue: t, textContent: t }),
  addEventListener() {}, removeEventListener() {},
  fonts: { ready: Promise.resolve(), load: () => Promise.resolve() },
  visibilityState: 'visible',
  hidden: false,
  exitPointerLock() {}, pointerLockElement: null,
  fullscreenElement: null,
  activeElement: null,
  styleSheets: [],
  cookie: '',
  title: 'test',
  location: { href: 'http://localhost/', search: '', hash: '' },
};

/* ---------------------- shim حداقلی window ---------------------- */
const listeners = new Map();
const win = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
  removeEventListener() {},
  requestAnimationFrame: fn => { queue.push(fn); return queue.length; },
  cancelAnimationFrame: () => {},
  setTimeout: (fn, t) => setTimeout(fn, t),
  clearTimeout,
  setInterval: () => 0,
  clearInterval: () => {},
  location: doc.location,
  navigator: { userAgent: 'node', maxTouchPoints: 0, languages: ['fa'] },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} }),
  performance: { now: () => Number(process.hrtime.bigint() / 1000000n) },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  alert() {}, focus() {}, blur() {},
  AudioContext: class { constructor() { this.state = 'running'; this.destination = {}; } createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; } createBufferSource() { return { buffer: null, connect() {}, start() {}, stop() {}, playbackRate: {} }; } createBuffer() { return { getChannelData: () => new Float32Array(128), duration: 1, numberOfChannels: 1, sampleRate: 44100 }; } createBiquadFilter() { return { frequency: {}, Q: {}, connect() {}, type: '' }; } createStereoPanner() { return { pan: {}, connect() {} }; } createDynamicsCompressor() { return { threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect() {} }; } createPanner() { return { positionX: {}, positionY: {}, positionZ: {}, connect() {}, setPosition() {} }; } createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {}, type: '' }; } decodeAudioData(d, ok) { ok && ok({ duration: 1, getChannelData: () => new Float32Array(128) }); return Promise.resolve({ duration: 1 }); } resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } get currentTime() { return 0; } },
  webkitAudioContext: null,
  Image: class { set src(v) { this.onload && setTimeout(() => this.onload(), 0); } },
  ResizeObserver: class { observe() {} disconnect() {} },
  IntersectionObserver: class { observe() {} disconnect() {} },
  THREE: null,
};
win.window = win;
win.document = doc;
win.self = win;
win.globalThis = win;
win.parent = win;
win.top = win;

const queue = [];

/* ---------------------- رندرر مجازی ---------------------- */
const glStub = new Proxy({}, {
  get(_, prop) {
    if (prop === 'getExtension') return () => null;
    if (prop === 'getParameter') return () => 4096;
    if (prop === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
    if (prop === 'getContextAttributes') return () => ({ alpha: true, antialias: true });
    if (prop === 'getSupportedExtensions') return () => [];
    if (prop === 'createShader' || prop === 'createProgram' || prop === 'createBuffer' ||
        prop === 'createTexture' || prop === 'createFramebuffer' || prop === 'createRenderbuffer') return () => ({});
    if (prop === 'getProgramParameter' || prop === 'getShaderParameter') return () => true;
    if (prop === 'getAttribLocation' || prop === 'getUniformLocation') return () => 0;
    if (prop === 'checkFramebufferStatus') return () => 36053;
    if (typeof prop === 'string' && /^[A-Z0-9_]+$/.test(prop)) return 1;
    return () => {};
  },
});

/* ---------------------- نصب روی globalThis ---------------------- */
for (const [k, v] of Object.entries(win)) {
  // این‌ها را دست نزن: یا در Node بهتر کار می‌کنند یا بازنویسی‌شان بازگشتی می‌شود
  if (['window','document','self','globalThis','setTimeout','clearTimeout',
       'setInterval','clearInterval','performance','fetch','XMLHttpRequest'].includes(k)) continue;
  try {
    Object.defineProperty(globalThis, k, { value: v, writable: true, configurable: true });
  } catch { /* پراپرتی فقط-خواندنی در Node (مثل navigator) — رد کن */ }
}
globalThis.window = globalThis;
globalThis.document = doc;
globalThis.self = globalThis;
globalThis.requestAnimationFrame = win.requestAnimationFrame;
globalThis.cancelAnimationFrame = win.cancelAnimationFrame;
globalThis.matchMedia = win.matchMedia;
globalThis.AudioContext = win.AudioContext;
globalThis.getComputedStyle = win.getComputedStyle;

/* ---------------------- اجرای main.js ---------------------- */
console.log('=== راه‌اندازی بازی (بدون مرورگر) ===');

// خطاهای unhandled را جمع کن
const errors = [];
process.on('uncaughtException', e => errors.push(e));
process.on('unhandledRejection', e => errors.push(e));

/* three.js FileLoader برای آدرس‌های نسبی از `new Request(url)` استفاده می‌کند
   که در Node به base نیاز دارد. با یک fetch که هر ورودی را نرمال می‌کند
   و یک Request جعلی، مشکل حل می‌شود. */
/* three.js FileLoader با `new Request(url)` آدرس نسبی می‌سازد و Node
   آن را نمی‌فهمد. Request را می‌پیچیم تا آدرس را مطلق کند. */
const RealRequest = globalThis.Request;
globalThis.Request = class extends RealRequest {
  constructor(input, init) {
    let url = typeof input === 'string' ? input : input?.url;
    const err = { value: 0 };
    try { super(input, init); return; } catch { /* آدرس نسبی */ }
    if (url && !/^[a-z]+:/i.test(url)) super('http://localhost:5181' + (url.startsWith('/') ? url : '/' + url), init);
    else super(input, init);
  }
};

// fetch برای مدل‌ها/صداها: از فایل بخوان
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => {
  const asStr = typeof url === 'string' ? url : (url && url.url) || '';
  if (/^[a-z]+:\/\//i.test(asStr)) {
    try { return await realFetch(url, opt); } catch { /* آفلاین: از دیسک */ }
  }
  let rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0];
  const p = path.join(process.cwd(), 'public', rel);
  if (fs.existsSync(p)) {
    const b = fs.readFileSync(p);
    return {
      ok: true, status: 200,
      arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      json: async () => JSON.parse(b.toString()),
      text: async () => b.toString(),
      blob: async () => b,
    };
  }
  return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0), text: async () => '' };
};

// XMLHttpRequest برای GLTFLoader (در Node از fetch استفاده می‌کند، ولی محض احتیاط)
globalThis.XMLHttpRequest = class {
  open() {} send() { this.readyState = 4; this.status = 404; this.onerror && this.onerror(new Error('no xhr')); }
  setRequestHeader() {} addEventListener() {} abort() {}
};

/* موقتاً main.js را با رندرر جعلی جایگزین کن */
const MAIN_SRC = 'src/main.js';
const TMP_SRC = 'src/_main.boot.mjs';
const srcText = fs.readFileSync(MAIN_SRC, 'utf8');
const patched = srcText.replace(
  "const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });",
  "const renderer = __makeFakeRenderer();"
);
if (patched === srcText) {
  check(false, 'الگوی ساخت رندرر در main.js پیدا نشد (تست باید به‌روز شود)');
}
fs.writeFileSync(TMP_SRC, "import { __makeFakeRenderer } from '../scripts/fake-renderer.mjs';\n" + patched);

let mainLoaded = false;
try {
  await import('../' + TMP_SRC + '?v=' + Date.now());
  mainLoaded = true;
} catch (e) {
  errors.push(e);
}
check(mainLoaded, 'src/main.js بدون خطای زمان اجرا import شد');
if (!mainLoaded) for (const e of errors) console.log('  ⚠️', String(e.message || e).slice(0, 300));

/* ------------------- فریم‌ها را شبیه‌سازی کن ------------------- */
// منتظر بمان تا init (که async است) پیش برود
await new Promise(r => setTimeout(r, 1500));

let frames = 0;
const PERF_BUDGET_MS = 3000;
const t0 = Date.now();
while (queue.length && frames < 60 && Date.now() - t0 < PERF_BUDGET_MS) {
  const fn = queue.shift();
  try { fn(performance.now()); frames++; } catch (e) { errors.push(e); break; }
}
check(frames > 0, `${frames} فریم بدون خطا اجرا شد`);

/* ------------------------- گزارش ------------------------- */
const fatal = errors.filter(e => e && !/Couldn't load texture blob|createImageBitmap|WebGL/i.test(String(e.message || e)));
if (fatal.length) {
  console.log('\n--- خطاهای زمان اجرا ---');
  for (const e of fatal.slice(0, 6)) console.log('  ⚠️', String(e.message || e).slice(0, 200));
}
check(fatal.length === 0, `${fatal.length} خطای زمان اجرا (بدون احتساب محدودیت‌های گرافیکی Node)`);

/* ------------------- بررسی صحت وضعیت بازی ------------------- */
// main.js متغیرها را صادر نمی‌کند، پس از DOM/شمارش استفاده می‌کنیم
const loadingEl = getEl('loading');
check(loadingEl.style.display === 'none', 'صفحه‌ی بارگذاری بسته شده (بازی شروع شد)');

try { fs.unlinkSync(TMP_SRC); } catch {}
console.log(fails ? `\n❌ ${fails} مورد ناموفق` : '\n✅ بازی بدون خطا بالا می‌آید');
process.exit(fails ? 1 : 0);
