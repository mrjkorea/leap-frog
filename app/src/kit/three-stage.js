// three.js stage: renderer + optional bloom post-processing, auto quality (high -> low -> ultra-low), GLB cache.
// Port-friendly: plain WebGL1/2, no desktop-only APIs; works in Capacitor/Tauri webviews.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
export { THREE };

export function createStage3D(host, { quality, bloom = { strength: 0.8, radius: 0.5, threshold: 0.78 }, shadows = true, fov = 45, clear = 0x000000 } = {}) {
  const forced = quality || null;
  const qs = ["high", "low", "ultra"];
  let level = forced === "low" ? 1 : forced === "high" ? 0 : 0;
  const coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  if (!forced && coarse && (navigator.hardwareConcurrency || 4) <= 4) level = 1;
  const renderer = new THREE.WebGLRenderer({ antialias: level === 0, powerPreference: "high-performance", alpha: false });
  renderer.setClearColor(clear, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "stage3d";
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 400);
  let composer = null, bloomPass = null;
  const st = { renderer, scene, camera, w: 1, h: 1, t: 0, fps: 60, get quality() { return qs[level]; }, get low() { return level > 0; }, onResize: null, onQuality: null };
  function buildComposer() {
    composer = null; bloomPass = null;
    if (level > 0 || !bloom) return;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(st.w, st.h), bloom.strength, bloom.radius, bloom.threshold);
      composer.addPass(bloomPass); composer.addPass(new OutputPass());
    } catch (e) { composer = null; }
  }
  function applyLevel() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, [1.75, 1, 0.75][level]));
    renderer.shadowMap.enabled = shadows && level < 2;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    buildComposer(); resize(); st.onQuality && st.onQuality(qs[level]);
  }
  function resize() {
    const r = host.getBoundingClientRect(); st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
    renderer.setSize(st.w, st.h, false); renderer.domElement.style.width = st.w + "px"; renderer.domElement.style.height = st.h + "px";
    camera.aspect = st.w / st.h; camera.updateProjectionMatrix();
    composer && composer.setSize(st.w, st.h); bloomPass && bloomPass.setSize(st.w, st.h);
    st.onResize && st.onResize(st);
  }
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
  applyLevel();
  st.setBloom = (s) => { if (bloomPass) bloomPass.strength = s; };
  st.render = () => (composer ? composer.render() : renderer.render(scene, camera));
  let frames = 0, acc = 0, slow = 0, warm = 0;
  // advance clocks + auto quality, then draw. Call once per frame (from your own loop) or use st.run().
  st.step = (dt, frame) => {
    st.t += dt; frames++; acc += dt; warm += dt;
    if (acc >= 1) { st.fps = frames / acc; frames = 0; acc = 0;
      if (!forced && warm > 3 && level < 2) { const lim = level === 0 ? 42 : 28; slow = st.fps < lim ? slow + 1 : 0; if (slow >= 3) { slow = 0; level++; applyLevel(); } } }
    frame && frame(dt, st); st.render();
  };
  st.run = (frame) => { let last = performance.now(); const loop = (now) => { const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; st.step(dt, frame); requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
  return st;
}

const loader = new GLTFLoader(), cache = new Map();
// load a GLB once, return a fresh clone each call (materials shared)
export function loadModel(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res) => loader.load(url, (g) => res(g.scene), undefined, () => res(null))));
  return cache.get(url).then((s) => (s ? s.clone(true) : null));
}
export function shadowAll(o, cast = true, recv = false) { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; }
// fit a model so its largest dimension == size, centred on the origin
export function fit(o, size) { const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); const k = size / Math.max(s.x, s.y, s.z, 1e-6); o.scale.multiplyScalar(k); o.position.sub(c.multiplyScalar(k)); const g = new THREE.Group(); g.add(o); return g; }
// text on a canvas texture -> sprite / plane (crisp labels for words)
export function textTexture(text, { font = "700 64px Fredoka, system-ui, sans-serif", color = "#fff", bg = null, pad = 28, stroke = "rgba(0,0,0,.5)", radius = 30, border = null, h = 112 } = {}) {
  const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = font;
  const w = Math.ceil(g.measureText(text).width + pad * 2); c.width = Math.max(h, w); c.height = h;
  g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
  if (bg) { g.fillStyle = bg; rr(g, 4, 4, c.width - 8, h - 8, radius); g.fill(); if (border) { g.lineWidth = 6; g.strokeStyle = border; g.stroke(); } }
  if (stroke) { g.lineWidth = 10; g.strokeStyle = stroke; g.lineJoin = "round"; g.strokeText(text, c.width / 2, h / 2 + 3); }
  g.fillStyle = color; g.fillText(text, c.width / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData = { aspect: c.width / h };
  return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(0.35, inner.replace(/[\d.]+\)$/, ".45)")); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// GPU-cheap particle system: one Points mesh, additive, per-particle colour/size/life.
export function createParticles3D(scene, { max = 1200, texture } = {}) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), P = [];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: texture || glowTexture() }, scale: { value: 300 } }, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "attribute float size; varying vec3 vC; uniform float scale; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }",
    fragmentShader: "uniform sampler2D map; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb*1.6,t.a); }" });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const tmp = new THREE.Color();
  function burst(at, { n = 30, color = 0xffffff, colors = null, speed = 6, size: sz = 0.5, life = 0.8, grav = -6, spread = 1, up = 0, drag = 0.96, low = false } = {}) {
    if (low) n = Math.ceil(n / 2.5);
    for (let i = 0; i < n; i++) {
      if (P.length >= max) P.shift();
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), v = speed * (0.3 + Math.random() * 0.8);
      tmp.set(colors ? colors[(Math.random() * colors.length) | 0] : color);
      P.push({ x: at.x, y: at.y, z: at.z, vx: Math.sin(ph) * Math.cos(th) * v * spread, vy: Math.cos(ph) * v * spread + up, vz: Math.sin(ph) * Math.sin(th) * v * spread, life: life * (0.6 + Math.random() * 0.7), max: 0, s: sz * (0.6 + Math.random() * 0.8), r: tmp.r, g: tmp.g, b: tmp.b, grav, drag });
      P[P.length - 1].max = P[P.length - 1].life;
    }
  }
  function update(dt) {
    let j = 0;
    for (let i = 0; i < P.length; i++) { const p = P[i]; p.life -= dt; if (p.life <= 0) continue; p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav * dt; p.vz *= p.drag; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; P[j++] = p; }
    P.length = j;
    for (let i = 0; i < max; i++) { const p = P[i]; if (!p) { size[i] = 0; continue; } const k = Math.min(1, (p.life / p.max) * 1.8); pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; col[i * 3] = p.r * k; col[i * 3 + 1] = p.g * k; col[i * 3 + 2] = p.b * k; size[i] = p.s * (0.5 + 0.5 * k); }
    geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
  }
  return { burst, update, setScale: (s) => (mat.uniforms.scale.value = s), count: () => P.length, points: pts };
}
// tiny tween helper (eased, frame-driven)
export function createTweens() {
  const list = [];
  return { add(dur, fn, { ease = (t) => 1 - Math.pow(1 - t, 3), done } = {}) { const T = { t: 0, dur, fn, ease, done }; list.push(T); return T; },
    update(dt) { for (let i = list.length - 1; i >= 0; i--) { const T = list[i]; T.t = Math.min(T.dur, T.t + dt); T.fn(T.ease(T.t / T.dur), T.t / T.dur); if (T.t >= T.dur) { list.splice(i, 1); T.done && T.done(); } } },
    clear() { list.length = 0; }, get size() { return list.length; } };
}
