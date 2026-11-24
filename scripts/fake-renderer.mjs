/* رندرر جعلی برای تست راه‌اندازی در Node.
   WebGLRenderer واقعی به GPU نیاز دارد و در Node ساخته نمی‌شود؛
   این کلاس فقط همان API ای را دارد که main.js صدا می‌زند. */
function el(tag) {
  return {
    tagName: tag, style: {}, width: 1280, height: 720, clientWidth: 1280, clientHeight: 720,
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, insertBefore() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
    getContext: () => new Proxy({}, {
      get: (_, p) => {
        if (p === 'getExtension') return () => null;
        if (p === 'getParameter') return () => 4096;
        if (p === 'getShaderPrecisionFormat') return () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
        if (p === 'getContextAttributes') return () => ({ alpha: true, antialias: true });
        if (p === 'getSupportedExtensions') return () => [];
        if (/^create|^getUniformLocation|^getAttribLocation/.test(String(p))) return () => ({});
        if (p === 'getProgramParameter' || p === 'getShaderParameter') return () => true;
        if (p === 'checkFramebufferStatus') return () => 36053;
        if (typeof p === 'string' && /^[A-Z0-9_]+$/.test(p)) return 1;
        return () => {};
      },
    }),
    focus() {}, blur() {}, click() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {}, textContent: '', innerHTML: '',
  };
}

export function __makeFakeRenderer() {
  const dom = el('canvas');
  return {
    domElement: dom,
    shadowMap: { enabled: false, type: 0, autoUpdate: true, needsUpdate: false },
    outputColorSpace: '', toneMapping: 0, toneMappingExposure: 1,
    info: { render: { calls: 0, triangles: 0, frame: 0 }, memory: { geometries: 0, textures: 0 }, programs: [] },
    capabilities: { isWebGL2: true, getMaxAnisotropy: () => 1, maxTextureSize: 4096, precision: 'highp' },
    properties: { get: () => ({}) },
    xr: { enabled: false, isPresenting: false, addEventListener() {}, setAnimationLoop() {} },
    setPixelRatio() {}, setSize() {}, setClearColor() {}, setClearAlpha() {},
    setScissorTest() {}, setViewport() {}, setRenderTarget() {}, clear() {},
    render() {}, compile() {}, dispose() {}, resetState() {},
    setAnimationLoop() {}, getContext: () => dom.getContext(),
    getSize(t) { return t ? t.set(1280, 720) : { x: 1280, y: 720 }; },
    getPixelRatio() { return 1; },
    getDrawingBufferSize(t) { return t ? t.set(1280, 720) : { x: 1280, y: 720 }; },
  };
}
