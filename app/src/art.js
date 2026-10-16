// Vector art for Leap Frog (drawn on canvas each frame: crisp at any size, no image downloads).
import { roundRect } from "./kit/ui.js";
const TAU = Math.PI * 2;

export function drawWater(g, w, h, t, low) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "#1fa3b8"); gr.addColorStop(0.5, "#1683a8"); gr.addColorStop(1, "#0e5b86");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // caustic shimmer
  g.globalAlpha = 0.09; g.strokeStyle = "#e9ffff"; g.lineWidth = 2;
  const n = low ? 10 : 22;
  for (let i = 0; i < n; i++) {
    const y = ((i * 97 + t * 14) % (h + 40)) - 20, x = (i * 173) % w;
    g.beginPath(); g.ellipse(x + Math.sin(t + i) * 20, y, 30 + (i % 4) * 10, 6, 0, 0, TAU); g.stroke();
  }
  g.globalAlpha = 1;
}
export function drawReeds(g, w, h, t) {
  for (let side = 0; side < 2; side++) for (let i = 0; i < 6; i++) {
    const bx = side ? w - 10 - i * 14 : 10 + i * 14, by = h * (0.62 + (i % 3) * 0.12), sway = Math.sin(t * 1.3 + i) * 6;
    g.strokeStyle = i % 2 ? "#2f8a3c" : "#3ea54a"; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(bx, by + 40); g.quadraticCurveTo(bx + sway * 0.5, by, bx + sway, by - 50 - (i % 3) * 18); g.stroke();
    if (i % 2 === 0) { g.fillStyle = "#7a4a22"; roundRect(g, bx + sway - 4, by - 66 - (i % 3) * 18, 8, 22, 4); g.fill(); }
  }
}
export function drawShore(g, w, y, t) {
  // sandy bank with grass + flowers; y = bottom edge of the shore
  g.fillStyle = "#e9cf8f"; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, y);
  for (let x = w; x >= 0; x -= 30) g.lineTo(x, y + Math.sin(x * 0.05) * 6); g.closePath(); g.fill();
  g.fillStyle = "#5cbf4a"; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, y - 22);
  for (let x = w; x >= 0; x -= 24) g.lineTo(x, y - 22 + Math.sin(x * 0.08) * 5); g.closePath(); g.fill();
  for (let i = 0; i < 5; i++) { const bx = (i + 0.3) * w / 5, by = y - 70 - (i % 2) * 20; if (by < -40) continue; g.fillStyle = "#3f9e3a"; for (const [ox, oy, r] of [[0, 0, 34], [-26, 10, 24], [26, 10, 26]]) { g.beginPath(); g.arc(bx + ox, by + oy, r, 0, TAU); g.fill(); } g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.arc(bx - 8, by - 10, 14, 0, TAU); g.fill(); }
  for (let i = 0; i < 9; i++) { const fx = (i + 0.5) * w / 9, fy = y - 40 - (i % 2) * 12; g.fillStyle = ["#ff6fa6", "#ffd23f", "#fff"][i % 3];
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(fx + Math.cos(k * 1.26 + t * 0.4) * 5, fy + Math.sin(k * 1.26 + t * 0.4) * 5, 4, 0, TAU); g.fill(); }
    g.fillStyle = "#ff9f1c"; g.beginPath(); g.arc(fx, fy, 3, 0, TAU); g.fill(); }
  g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 3; g.beginPath();
  for (let x = 0; x <= w; x += 20) g.lineTo(x, y + 8 + Math.sin(x * 0.05 + t * 2) * 3); g.stroke();
}
export function drawPad(g, x, y, r, { sink = 0, glow = 0, hue = 0, t = 0, flower = false } = {}) {
  if (r <= 1) return;
  const s = 1 - sink * 0.35;
  g.save(); g.translate(x, y); g.scale(s, s * 0.62);
  g.fillStyle = "rgba(0,40,60,.25)"; g.beginPath(); g.arc(4, 10, r, 0, TAU); g.fill();
  if (glow) { g.shadowColor = "#fffa9e"; g.shadowBlur = 30 * glow; }
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  gr.addColorStop(0, `hsl(${110 + hue},70%,58%)`); gr.addColorStop(1, `hsl(${120 + hue},62%,36%)`);
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, 0.25, TAU - 0.05); g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = `hsla(${120 + hue},60%,25%,.5)`; g.lineWidth = 2;
  for (let k = 0; k < 7; k++) { const a = 0.6 + k * 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.stroke(); }
  if (flower) { g.fillStyle = "#ffb3d1"; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(Math.cos(k + t * 0.3) * r * 0.18 - r * 0.45, Math.sin(k + t * 0.3) * r * 0.18 - r * 0.2, r * 0.12, r * 0.07, k, 0, TAU); g.fill(); } }
  if (sink > 0) { g.globalAlpha = Math.min(0.85, sink); g.fillStyle = "#1683a8"; g.beginPath(); g.arc(0, 0, r * 1.02, 0, TAU); g.fill(); g.globalAlpha = 1; }
  g.restore();
}
export function drawFrog(g, f, t) {
  const { x, y, z, size: S, sx, sy, rot, blink, tongue } = f;
  g.save();
  // shadow on the water / pad
  g.fillStyle = `rgba(0,30,40,${0.28 / (1 + z / 80)})`; g.beginPath(); g.ellipse(x, y + S * 0.3, S * 0.55 / (1 + z / 160), S * 0.18 / (1 + z / 160), 0, 0, TAU); g.fill();
  g.translate(x, y - z); g.rotate(rot); g.scale(sx, sy);
  const breathe = 1 + Math.sin(t * 3) * 0.02;
  // back legs
  g.fillStyle = "#2f9b3a";
  for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * S * 0.42, S * 0.18, S * 0.28, S * 0.17, d * 0.5, 0, TAU); g.fill();
    g.fillStyle = "#ffb347"; g.beginPath(); g.ellipse(d * S * 0.6, S * 0.32, S * 0.12, S * 0.06, 0, 0, TAU); g.fill(); g.fillStyle = "#2f9b3a"; }
  // body
  const bg = g.createRadialGradient(-S * 0.15, -S * 0.2, S * 0.05, 0, 0, S * 0.6);
  bg.addColorStop(0, "#8ef06b"); bg.addColorStop(1, "#33a83e");
  g.fillStyle = bg; g.beginPath(); g.ellipse(0, 0, S * 0.48 * breathe, S * 0.4 / breathe, 0, 0, TAU); g.fill();
  g.fillStyle = "#e6ffb8"; g.beginPath(); g.ellipse(0, S * 0.12, S * 0.3, S * 0.2, 0, 0, TAU); g.fill();
  // spots
  g.fillStyle = "rgba(30,110,40,.45)"; for (const [a, b, r] of [[-0.22, -0.18, 0.06], [0.25, -0.1, 0.05], [0.05, -0.28, 0.04]]) { g.beginPath(); g.arc(a * S, b * S, r * S, 0, TAU); g.fill(); }
  // eyes
  for (const d of [-1, 1]) {
    g.fillStyle = "#4cc24a"; g.beginPath(); g.arc(d * S * 0.22, -S * 0.36, S * 0.17, 0, TAU); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(d * S * 0.22, -S * 0.37, S * 0.12, S * 0.12 * (1 - blink), 0, 0, TAU); g.fill();
    if (blink < 0.8) { g.fillStyle = "#1b1b2b"; g.beginPath(); g.arc(d * S * 0.22 + S * 0.02, -S * 0.36, S * 0.06, 0, TAU); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(d * S * 0.22 + S * 0.045, -S * 0.39, S * 0.02, 0, TAU); g.fill(); }
  }
  // smile + cheeks
  g.strokeStyle = "#1e5e25"; g.lineWidth = Math.max(1.5, S * 0.03); g.lineCap = "round";
  g.beginPath(); g.arc(0, -S * 0.08, S * 0.2, 0.25, Math.PI - 0.25); g.stroke();
  g.fillStyle = "rgba(255,120,150,.45)"; for (const d of [-1, 1]) { g.beginPath(); g.arc(d * S * 0.3, -S * 0.04, S * 0.06, 0, TAU); g.fill(); }
  if (tongue > 0) { g.strokeStyle = "#ff5f8a"; g.lineWidth = S * 0.06; g.beginPath(); g.moveTo(0, S * 0.08); g.lineTo(0, S * 0.08 - tongue * S * 1.2); g.stroke(); }
  // front feet
  g.fillStyle = "#ffb347"; for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * S * 0.2, S * 0.36, S * 0.09, S * 0.05, 0, 0, TAU); g.fill(); }
  g.restore();
}
export function drawPiranha(g, x, y, s, open, flip) {
  g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
  g.fillStyle = "#8b5cf6"; g.beginPath(); g.moveTo(-40, 0); g.lineTo(-62, -18); g.lineTo(-58, 0); g.lineTo(-62, 18); g.closePath(); g.fill();
  const gr = g.createLinearGradient(0, -30, 0, 30); gr.addColorStop(0, "#7c3aed"); gr.addColorStop(1, "#f43f5e");
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 44, 30, 0, 0.3 * open, TAU - 0.3 * open); g.lineTo(20, 0); g.closePath(); g.fill();
  g.fillStyle = "#fff"; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(22 + k * 5, -8 * open - 2); g.lineTo(25 + k * 5, 2 - 8 * open); g.lineTo(28 + k * 5, -8 * open - 2); g.fill(); }
  g.fillStyle = "#fff"; g.beginPath(); g.arc(18, -14, 8, 0, TAU); g.fill(); g.fillStyle = "#111"; g.beginPath(); g.arc(20, -14, 4, 0, TAU); g.fill();
  g.strokeStyle = "#111"; g.lineWidth = 3; g.beginPath(); g.moveTo(10, -24); g.lineTo(26, -20); g.stroke();
  g.restore();
}
export function drawFly(g, x, y, t) {
  g.fillStyle = "rgba(255,255,255,.7)"; const fl = Math.sin(t * 40) * 3;
  g.beginPath(); g.ellipse(x - 5, y - 4 - fl, 6, 3, -0.5, 0, TAU); g.ellipse(x + 5, y - 4 - fl, 6, 3, 0.5, 0, TAU); g.fill();
  g.fillStyle = "#222"; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill();
}
