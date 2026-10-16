// Juice: particles, screen shake, floating text, flashes, easing.
export const ease = {
  outBack: (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function createFx(stage) {
  const parts = [], texts = [];
  const shake = { amp: 0, t: 0 };
  let flash = { a: 0, color: "#fff" };
  function burst(x, y, { n = 20, color = ["#fff"], speed = 220, size = 5, life = 0.8, grav = 400, shape = "circle", spread = Math.PI * 2, dir = -Math.PI / 2, drag = 0.98 } = {}) {
    if (stage.low) n = Math.ceil(n / 2.5);
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * spread, v = speed * (0.35 + Math.random() * 0.75);
      if (parts.length > 500) parts.shift();
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: 0, size: size * (0.6 + Math.random() * 0.8), color: Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color, grav, shape, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, drag });
      parts[parts.length - 1].max = parts[parts.length - 1].life;
    }
  }
  function confetti(x, y, n = 60) { burst(x, y, { n, color: ["#ff5e7e", "#ffd23f", "#3ec7ff", "#7cff6b", "#c58bff"], speed: 520, size: 7, life: 1.8, grav: 520, shape: "rect", spread: Math.PI * 0.9 }); }
  function float(x, y, text, { color = "#fff", size = 30, life = 1.1 } = {}) { texts.push({ x, y, text, color, size, life, max: life }); }
  function doShake(amp = 10) { shake.amp = Math.max(shake.amp, amp); }
  function doFlash(color = "#fff", a = 0.5) { flash = { a, color }; }
  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= dt; t.y -= 50 * dt; if (t.life <= 0) texts.splice(i, 1); }
    shake.amp *= Math.pow(0.0015, dt); if (shake.amp < 0.3) shake.amp = 0;
    flash.a = Math.max(0, flash.a - dt * 2.2);
  }
  function applyShake(g) { if (shake.amp) g.translate((Math.random() - 0.5) * shake.amp * 2, (Math.random() - 0.5) * shake.amp * 2); }
  function draw(g) {
    for (const p of parts) {
      const a = Math.min(1, p.life / p.max * 1.6); g.globalAlpha = a; g.fillStyle = p.color;
      if (p.shape === "rect") { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore(); }
      else { g.beginPath(); g.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const t of texts) {
      const k = 1 - t.life / t.max, sc = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      g.globalAlpha = Math.min(1, t.life / t.max * 2.5);
      g.font = `700 ${t.size * sc}px Fredoka, system-ui, sans-serif`;
      g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,.45)"; g.strokeText(t.text, t.x, t.y); g.fillStyle = t.color; g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
  }
  function drawFlash(g, w, h) { if (flash.a > 0) { g.globalAlpha = flash.a; g.fillStyle = flash.color; g.fillRect(0, 0, w, h); g.globalAlpha = 1; } }
  return { burst, confetti, float, shake: doShake, flash: doFlash, update, applyShake, draw, drawFlash, count: () => parts.length };
}
