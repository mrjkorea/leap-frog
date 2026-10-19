// Responsive canvas + fixed-step-free game loop + auto quality. No desktop-only APIs.
export function createStage(host, { quality } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "stage";
  host.appendChild(canvas);
  const g = canvas.getContext("2d");
  const forced = quality || null;
  const st = { w: 0, h: 0, dpr: 1, low: forced === "low", canvas, g, onResize: null, t: 0, fps: 60 };
  function resize() {
    const r = host.getBoundingClientRect();
    st.w = Math.max(1, r.width); st.h = Math.max(1, r.height);
    st.dpr = Math.min(window.devicePixelRatio || 1, st.low ? 1 : 2);
    canvas.width = Math.round(st.w * st.dpr); canvas.height = Math.round(st.h * st.dpr);
    canvas.style.width = st.w + "px"; canvas.style.height = st.h + "px";
    st.onResize && st.onResize(st);
  }
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
  resize();
  let last = performance.now(), frames = 0, acc = 0, slow = 0;
  st.run = (frame) => {
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt;
      frames++; acc += dt;
      if (acc >= 1) { st.fps = frames / acc; frames = 0; acc = 0;
        if (!forced && !st.low) { slow = st.fps < 40 ? slow + 1 : 0; if (slow >= 3) { st.low = true; resize(); } } }
      g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      frame(dt, st);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  return st;
}
